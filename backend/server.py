from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
import base64
import io
import numpy as np
from PIL import Image
import cv2
from scipy import ndimage, stats
from skimage import filters, morphology, measure, feature
from skimage.metrics import structural_similarity as ssim
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'handwriting_forensic')]

# Create the main app
app = FastAPI(title="Handwriting Forensic Comparator API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============== MODELS ==============

class ComparisonRequest(BaseModel):
    questioned_image: str  # base64
    known_image: str  # base64
    use_ai_analysis: bool = True

class SubScore(BaseModel):
    name: str
    score: float
    description: str

class ComparisonResult(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    questioned_image_thumb: str  # base64 thumbnail
    known_image_thumb: str  # base64 thumbnail
    processed_questioned: str  # base64 processed image
    processed_known: str  # base64 processed image
    difference_heatmap: str  # base64 heatmap
    composite_score: float
    sub_scores: List[SubScore]
    verdict: str
    verdict_color: str
    ai_analysis: Optional[str] = None

class ComparisonHistory(BaseModel):
    id: str
    timestamp: datetime
    composite_score: float
    verdict: str
    verdict_color: str
    questioned_thumb: str
    known_thumb: str

# ============== IMAGE PROCESSING ==============

def base64_to_image(base64_str: str) -> np.ndarray:
    """Convert base64 string to numpy array (OpenCV format)"""
    try:
        # Remove data URL prefix if present
        if ',' in base64_str:
            base64_str = base64_str.split(',')[1]
        
        img_data = base64.b64decode(base64_str)
        img = Image.open(io.BytesIO(img_data))
        img = img.convert('RGB')
        return np.array(img)
    except Exception as e:
        logger.error(f"Error decoding base64 image: {e}")
        raise HTTPException(status_code=400, detail="Invalid image data")

def image_to_base64(img: np.ndarray, format='PNG') -> str:
    """Convert numpy array to base64 string"""
    if len(img.shape) == 2:  # Grayscale
        pil_img = Image.fromarray(img.astype(np.uint8), mode='L')
    else:
        pil_img = Image.fromarray(img.astype(np.uint8))
    
    buffer = io.BytesIO()
    pil_img.save(buffer, format=format, quality=85)
    return base64.b64encode(buffer.getvalue()).decode()

def create_thumbnail(img: np.ndarray, max_size: int = 150) -> str:
    """Create a thumbnail of the image"""
    h, w = img.shape[:2]
    scale = min(max_size / w, max_size / h)
    new_w, new_h = int(w * scale), int(h * scale)
    resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
    return image_to_base64(resized, 'JPEG')

def preprocess_image(img: np.ndarray) -> Dict[str, Any]:
    """Apply all preprocessing steps to handwriting image"""
    # 1. Convert to grayscale
    if len(img.shape) == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    else:
        gray = img.copy()
    
    # 2. High-pass sharpening / unsharp mask
    blurred = cv2.GaussianBlur(gray, (0, 0), 3)
    sharpened = cv2.addWeighted(gray, 1.5, blurred, -0.5, 0)
    
    # 3. Adaptive binarization (Sauvola-like using OpenCV)
    binary = cv2.adaptiveThreshold(
        sharpened, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, 21, 10
    )
    
    # 4. Basic deskew using moments
    coords = np.column_stack(np.where(binary > 0))
    if len(coords) > 100:
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = 90 + angle
        if abs(angle) > 0.5 and abs(angle) < 15:  # Only correct reasonable angles
            (h, w) = binary.shape
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            binary = cv2.warpAffine(binary, M, (w, h), flags=cv2.INTER_CUBIC,
                                   borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    
    # 5. Size normalization (preserve aspect ratio)
    target_height = 400
    h, w = binary.shape
    scale = target_height / h
    new_w = int(w * scale)
    normalized = cv2.resize(binary, (new_w, target_height), interpolation=cv2.INTER_AREA)
    
    # Create skeleton for stroke analysis
    skeleton = morphology.skeletonize(normalized > 0).astype(np.uint8) * 255
    
    return {
        'gray': gray,
        'sharpened': sharpened,
        'binary': binary,
        'normalized': normalized,
        'skeleton': skeleton
    }

# ============== ANALYSIS FUNCTIONS ==============

def calculate_slant_angle(binary: np.ndarray) -> float:
    """Calculate overall slant angle of handwriting"""
    try:
        # Find contours and calculate average angle
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        angles = []
        for cnt in contours:
            if cv2.contourArea(cnt) > 50:
                rect = cv2.minAreaRect(cnt)
                angle = rect[-1]
                if angle < -45:
                    angle = 90 + angle
                angles.append(angle)
        return np.mean(angles) if angles else 0
    except:
        return 0

def calculate_letter_ratio(binary: np.ndarray) -> float:
    """Calculate average width/height ratio of characters"""
    try:
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        ratios = []
        for cnt in contours:
            x, y, w, h = cv2.boundingRect(cnt)
            if w > 5 and h > 10 and h < binary.shape[0] * 0.8:
                ratios.append(w / h)
        return np.mean(ratios) if ratios else 0.5
    except:
        return 0.5

def calculate_line_spacing(binary: np.ndarray) -> float:
    """Calculate average line spacing from projection profile"""
    try:
        projection = np.sum(binary, axis=1)
        # Find peaks (text lines)
        peaks = []
        threshold = np.max(projection) * 0.1
        in_peak = False
        peak_start = 0
        for i, val in enumerate(projection):
            if val > threshold and not in_peak:
                in_peak = True
                peak_start = i
            elif val <= threshold and in_peak:
                in_peak = False
                peaks.append((peak_start + i) // 2)
        
        if len(peaks) > 1:
            spacings = np.diff(peaks)
            return np.mean(spacings) / binary.shape[0]
        return 0.1
    except:
        return 0.1

def calculate_stroke_width_distribution(skeleton: np.ndarray, binary: np.ndarray) -> np.ndarray:
    """Calculate stroke width distribution using distance transform"""
    try:
        dist_transform = cv2.distanceTransform(binary, cv2.DIST_L2, 5)
        skeleton_points = skeleton > 0
        stroke_widths = dist_transform[skeleton_points]
        stroke_widths = stroke_widths[stroke_widths > 0]
        if len(stroke_widths) > 10:
            hist, _ = np.histogram(stroke_widths, bins=20, range=(0, 20), density=True)
            return hist
        return np.zeros(20)
    except:
        return np.zeros(20)

def calculate_curvature_stats(skeleton: np.ndarray) -> Dict[str, float]:
    """Calculate stroke curvature statistics"""
    try:
        contours, _ = cv2.findContours(skeleton, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
        all_curvatures = []
        
        for cnt in contours:
            if len(cnt) > 10:
                cnt = cnt.squeeze()
                if len(cnt.shape) == 2:
                    # Calculate curvature at each point
                    for i in range(2, len(cnt) - 2):
                        p1 = cnt[i-2]
                        p2 = cnt[i]
                        p3 = cnt[i+2]
                        v1 = p2 - p1
                        v2 = p3 - p2
                        angle = np.arctan2(v2[1], v2[0]) - np.arctan2(v1[1], v1[0])
                        all_curvatures.append(abs(angle))
        
        if all_curvatures:
            return {
                'mean': float(np.mean(all_curvatures)),
                'std': float(np.std(all_curvatures)),
                'max': float(np.max(all_curvatures))
            }
        return {'mean': 0, 'std': 0, 'max': 0}
    except:
        return {'mean': 0, 'std': 0, 'max': 0}

def calculate_connectivity_features(skeleton: np.ndarray) -> Dict[str, float]:
    """Calculate connectivity and branch point features"""
    try:
        # Label connected components
        labeled, num_components = measure.label(skeleton > 0, return_num=True)
        
        # Count branch points (pixels with more than 2 neighbors)
        kernel = np.ones((3, 3), dtype=np.uint8)
        neighbors = cv2.filter2D((skeleton > 0).astype(np.uint8), -1, kernel) - 1
        branch_points = np.sum((skeleton > 0) & (neighbors > 2))
        end_points = np.sum((skeleton > 0) & (neighbors == 1))
        
        total_pixels = np.sum(skeleton > 0)
        
        return {
            'num_components': num_components,
            'branch_ratio': branch_points / max(total_pixels, 1),
            'end_ratio': end_points / max(total_pixels, 1)
        }
    except:
        return {'num_components': 0, 'branch_ratio': 0, 'end_ratio': 0}

def calculate_ssim_score(img1: np.ndarray, img2: np.ndarray) -> float:
    """Calculate Structural Similarity Index"""
    try:
        # Ensure same size
        h = min(img1.shape[0], img2.shape[0])
        w = min(img1.shape[1], img2.shape[1])
        img1_resized = cv2.resize(img1, (w, h))
        img2_resized = cv2.resize(img2, (w, h))
        
        score, _ = ssim(img1_resized, img2_resized, full=True)
        return float(score)
    except Exception as e:
        logger.error(f"SSIM error: {e}")
        return 0.5

def calculate_cross_correlation(img1: np.ndarray, img2: np.ndarray) -> float:
    """Calculate normalized cross-correlation"""
    try:
        # Ensure same size
        h = min(img1.shape[0], img2.shape[0])
        w = min(img1.shape[1], img2.shape[1])
        img1_resized = cv2.resize(img1, (w, h)).astype(np.float64)
        img2_resized = cv2.resize(img2, (w, h)).astype(np.float64)
        
        # Normalize
        img1_norm = (img1_resized - np.mean(img1_resized)) / (np.std(img1_resized) + 1e-8)
        img2_norm = (img2_resized - np.mean(img2_resized)) / (np.std(img2_resized) + 1e-8)
        
        # Calculate correlation
        correlation = np.mean(img1_norm * img2_norm)
        return float(max(0, min(1, (correlation + 1) / 2)))  # Normalize to 0-1
    except:
        return 0.5

def create_difference_heatmap(img1: np.ndarray, img2: np.ndarray) -> np.ndarray:
    """Create a heatmap showing differences between two images"""
    try:
        # Ensure same size
        h = min(img1.shape[0], img2.shape[0])
        w = min(img1.shape[1], img2.shape[1])
        img1_resized = cv2.resize(img1, (w, h))
        img2_resized = cv2.resize(img2, (w, h))
        
        # Calculate absolute difference
        diff = cv2.absdiff(img1_resized, img2_resized)
        
        # Apply Gaussian blur to smooth
        diff_blurred = cv2.GaussianBlur(diff, (11, 11), 0)
        
        # Normalize to 0-255
        diff_norm = cv2.normalize(diff_blurred, None, 0, 255, cv2.NORM_MINMAX)
        
        # Apply colormap (red = high difference)
        heatmap = cv2.applyColorMap(diff_norm.astype(np.uint8), cv2.COLORMAP_JET)
        heatmap = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)
        
        # Overlay on original
        img1_rgb = cv2.cvtColor(img1_resized, cv2.COLOR_GRAY2RGB) if len(img1_resized.shape) == 2 else img1_resized
        overlay = cv2.addWeighted(img1_rgb, 0.5, heatmap, 0.5, 0)
        
        return overlay
    except Exception as e:
        logger.error(f"Heatmap error: {e}")
        return np.zeros((100, 100, 3), dtype=np.uint8)

def compare_distributions(hist1: np.ndarray, hist2: np.ndarray) -> float:
    """Compare two histograms using Earth Mover's Distance approximation"""
    try:
        # Normalize histograms
        hist1_norm = hist1 / (np.sum(hist1) + 1e-8)
        hist2_norm = hist2 / (np.sum(hist2) + 1e-8)
        
        # Use Bhattacharyya coefficient (1 = identical, 0 = completely different)
        bc = np.sum(np.sqrt(hist1_norm * hist2_norm))
        return float(bc)
    except:
        return 0.5

# ============== AI ANALYSIS ==============

async def perform_ai_analysis(img1_base64: str, img2_base64: str) -> Dict[str, Any]:
    """Use Grok Vision to analyze handwriting samples"""
    try:
        from openai import OpenAI
        
        api_key = os.environ.get('XAI_API_KEY')
        if not api_key:
            logger.warning("No XAI_API_KEY found, skipping AI analysis")
            return {'score': 0.5, 'analysis': 'AI analysis unavailable - No Grok API key'}
        
        # Initialize xAI client (OpenAI compatible)
        client = OpenAI(
            api_key=api_key,
            base_url="https://api.x.ai/v1"
        )
        
        # Clean base64 strings
        if ',' in img1_base64:
            img1_base64 = img1_base64.split(',')[1]
        if ',' in img2_base64:
            img2_base64 = img2_base64.split(',')[1]
        
        # Create message with images for Grok Vision
        messages = [
            {
                "role": "system",
                "content": """You are an expert forensic document examiner specializing in handwriting analysis. 
Analyze the two handwriting samples provided and compare them for authorship determination.
Focus on: letter formations, slant consistency, spacing patterns, pressure indicators, baseline alignment, 
connecting strokes, unique characteristics, and overall writing style.
Provide a similarity score from 0-100 and detailed analysis."""
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": """Compare these two handwriting samples for forensic analysis.

The first image is the Questioned Document (sample to be verified).
The second image is the Known Sample (reference sample).

Provide your analysis in this exact format:
SIMILARITY_SCORE: [0-100]
CONFIDENCE: [LOW/MEDIUM/HIGH]
KEY_SIMILARITIES: [list main similar features]
KEY_DIFFERENCES: [list main different features]
DETAILED_ANALYSIS: [comprehensive analysis paragraph]"""
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{img1_base64}"
                        }
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{img2_base64}"
                        }
                    }
                ]
            }
        ]
        
        # Call Grok Vision API
        response = client.chat.completions.create(
            model="grok-2-vision-1212",
            messages=messages,
            max_tokens=2000
        )
        
        analysis_text = response.choices[0].message.content
        
        # Parse response
        score = 50
        if 'SIMILARITY_SCORE:' in analysis_text:
            try:
                score_str = analysis_text.split('SIMILARITY_SCORE:')[1].split('\n')[0].strip()
                score = int(''.join(filter(str.isdigit, score_str[:3])))
                score = max(0, min(100, score))
            except:
                pass
        
        logger.info(f"Grok analysis complete, score: {score}")
        
        return {
            'score': score / 100,
            'analysis': analysis_text
        }
        
    except Exception as e:
        logger.error(f"AI analysis error: {e}")
        return {'score': 0.5, 'analysis': f'AI analysis error: {str(e)}'}

# ============== MAIN COMPARISON ==============

async def perform_comparison(questioned_img: np.ndarray, known_img: np.ndarray, use_ai: bool = True) -> Dict[str, Any]:
    """Perform complete handwriting comparison"""
    
    # Preprocess both images
    q_processed = preprocess_image(questioned_img)
    k_processed = preprocess_image(known_img)
    
    # 1. MACRO FEATURES
    q_slant = calculate_slant_angle(q_processed['binary'])
    k_slant = calculate_slant_angle(k_processed['binary'])
    slant_diff = abs(q_slant - k_slant)
    slant_score = max(0, 1 - slant_diff / 30)  # 30 degree max difference
    
    q_ratio = calculate_letter_ratio(q_processed['binary'])
    k_ratio = calculate_letter_ratio(k_processed['binary'])
    ratio_diff = abs(q_ratio - k_ratio)
    ratio_score = max(0, 1 - ratio_diff / 0.5)
    
    q_spacing = calculate_line_spacing(q_processed['binary'])
    k_spacing = calculate_line_spacing(k_processed['binary'])
    spacing_diff = abs(q_spacing - k_spacing)
    spacing_score = max(0, 1 - spacing_diff / 0.2)
    
    macro_score = (slant_score + ratio_score + spacing_score) / 3
    
    # 2. STROKE/MICRO FEATURES
    q_stroke_hist = calculate_stroke_width_distribution(q_processed['skeleton'], q_processed['normalized'])
    k_stroke_hist = calculate_stroke_width_distribution(k_processed['skeleton'], k_processed['normalized'])
    stroke_score = compare_distributions(q_stroke_hist, k_stroke_hist)
    
    q_curvature = calculate_curvature_stats(q_processed['skeleton'])
    k_curvature = calculate_curvature_stats(k_processed['skeleton'])
    curvature_diff = abs(q_curvature['mean'] - k_curvature['mean'])
    curvature_score = max(0, 1 - curvature_diff / 0.5)
    
    q_connectivity = calculate_connectivity_features(q_processed['skeleton'])
    k_connectivity = calculate_connectivity_features(k_processed['skeleton'])
    branch_diff = abs(q_connectivity['branch_ratio'] - k_connectivity['branch_ratio'])
    connectivity_score = max(0, 1 - branch_diff * 50)
    
    micro_score = (stroke_score + curvature_score + connectivity_score) / 3
    
    # 3. IMAGE-BASED SIMILARITY
    ssim_score = calculate_ssim_score(q_processed['normalized'], k_processed['normalized'])
    correlation_score = calculate_cross_correlation(q_processed['normalized'], k_processed['normalized'])
    
    image_score = (ssim_score + correlation_score) / 2
    
    # 4. AI ANALYSIS (optional)
    ai_score = 0.5
    ai_analysis = None
    if use_ai:
        q_base64 = image_to_base64(questioned_img)
        k_base64 = image_to_base64(known_img)
        ai_result = await perform_ai_analysis(q_base64, k_base64)
        ai_score = ai_result['score']
        ai_analysis = ai_result['analysis']
    
    # 5. COMPOSITE SCORE (weighted average)
    weights = {
        'macro': 0.20,
        'micro': 0.25,
        'image': 0.20,
        'ai': 0.35 if use_ai else 0
    }
    
    if not use_ai:
        weights['macro'] = 0.30
        weights['micro'] = 0.35
        weights['image'] = 0.35
    
    composite = (
        macro_score * weights['macro'] +
        micro_score * weights['micro'] +
        image_score * weights['image'] +
        ai_score * weights['ai']
    )
    
    # Create heatmap
    heatmap = create_difference_heatmap(q_processed['normalized'], k_processed['normalized'])
    
    # Calculate match probability
    # The composite score represents similarity - we use it directly as match probability
    match_probability = composite * 100
    
    # Determine verdict based on 50% threshold
    if match_probability >= 50:
        verdict = "Match Likely"
        verdict_color = "#22c55e"  # Green
    else:
        verdict = "Match Unlikely"
        verdict_color = "#ef4444"  # Red
    
    # Build sub-scores (converted to match probability format)
    sub_scores = [
        SubScore(name="Macro Geometry", score=round(macro_score * 100, 1), 
                description=f"Slant: {q_slant:.1f}° vs {k_slant:.1f}°, Letter ratio: {q_ratio:.2f} vs {k_ratio:.2f}"),
        SubScore(name="Stroke Distribution", score=round(stroke_score * 100, 1),
                description="Stroke width histogram similarity"),
        SubScore(name="Curvature Match", score=round(curvature_score * 100, 1),
                description=f"Mean curvature: {q_curvature['mean']:.3f} vs {k_curvature['mean']:.3f}"),
        SubScore(name="Structural Similarity", score=round(ssim_score * 100, 1),
                description="SSIM index between processed images"),
        SubScore(name="Correlation", score=round(correlation_score * 100, 1),
                description="Normalized cross-correlation score"),
    ]
    
    if use_ai:
        sub_scores.append(SubScore(
            name="AI Deep Analysis", 
            score=round(ai_score * 100, 1),
            description="Grok Vision forensic analysis"
        ))
    
    return {
        'composite_score': round(match_probability, 1),
        'sub_scores': sub_scores,
        'verdict': verdict,
        'verdict_color': verdict_color,
        'processed_questioned': image_to_base64(q_processed['normalized']),
        'processed_known': image_to_base64(k_processed['normalized']),
        'skeleton_questioned': image_to_base64(q_processed['skeleton']),
        'skeleton_known': image_to_base64(k_processed['skeleton']),
        'heatmap': image_to_base64(heatmap),
        'ai_analysis': ai_analysis
    }

# ============== API ROUTES ==============

@api_router.get("/")
async def root():
    return {"message": "Handwriting Forensic Comparator API", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

@api_router.post("/compare", response_model=ComparisonResult)
async def compare_handwriting(request: ComparisonRequest):
    """Compare two handwriting samples"""
    try:
        logger.info("Starting handwriting comparison...")
        
        # Decode images
        questioned_img = base64_to_image(request.questioned_image)
        known_img = base64_to_image(request.known_image)
        
        logger.info(f"Images loaded: Q={questioned_img.shape}, K={known_img.shape}")
        
        # Perform comparison
        result = await perform_comparison(questioned_img, known_img, request.use_ai_analysis)
        
        # Create thumbnails
        q_thumb = create_thumbnail(questioned_img)
        k_thumb = create_thumbnail(known_img)
        
        # Build response
        comparison_result = ComparisonResult(
            questioned_image_thumb=q_thumb,
            known_image_thumb=k_thumb,
            processed_questioned=result['processed_questioned'],
            processed_known=result['processed_known'],
            difference_heatmap=result['heatmap'],
            composite_score=result['composite_score'],
            sub_scores=result['sub_scores'],
            verdict=result['verdict'],
            verdict_color=result['verdict_color'],
            ai_analysis=result['ai_analysis']
        )
        
        # Save to history
        history_doc = {
            'id': comparison_result.id,
            'timestamp': comparison_result.timestamp,
            'composite_score': comparison_result.composite_score,
            'verdict': comparison_result.verdict,
            'verdict_color': comparison_result.verdict_color,
            'questioned_thumb': q_thumb,
            'known_thumb': k_thumb,
            'sub_scores': [s.dict() for s in comparison_result.sub_scores],
            'ai_analysis': comparison_result.ai_analysis
        }
        await db.comparisons.insert_one(history_doc)
        
        logger.info(f"Comparison complete: {comparison_result.composite_score}%")
        return comparison_result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Comparison error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/history", response_model=List[ComparisonHistory])
async def get_history(limit: int = 20):
    """Get comparison history"""
    try:
        cursor = db.comparisons.find().sort('timestamp', -1).limit(limit)
        history = await cursor.to_list(length=limit)
        return [
            ComparisonHistory(
                id=h['id'],
                timestamp=h['timestamp'],
                composite_score=h['composite_score'],
                verdict=h['verdict'],
                verdict_color=h['verdict_color'],
                questioned_thumb=h['questioned_thumb'],
                known_thumb=h['known_thumb']
            )
            for h in history
        ]
    except Exception as e:
        logger.error(f"History error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/comparison/{comparison_id}")
async def get_comparison(comparison_id: str):
    """Get a specific comparison by ID"""
    try:
        comparison = await db.comparisons.find_one({'id': comparison_id})
        if not comparison:
            raise HTTPException(status_code=404, detail="Comparison not found")
        comparison['_id'] = str(comparison['_id'])
        return comparison
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get comparison error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/history/{comparison_id}")
async def delete_comparison(comparison_id: str):
    """Delete a comparison from history"""
    try:
        result = await db.comparisons.delete_one({'id': comparison_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Comparison not found")
        return {"message": "Comparison deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/history")
async def clear_history():
    """Clear all comparison history"""
    try:
        result = await db.comparisons.delete_many({})
        return {"message": f"Deleted {result.deleted_count} comparisons"}
    except Exception as e:
        logger.error(f"Clear history error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============== CROP & OVERLAY ENDPOINTS ==============

class CropRequest(BaseModel):
    image_base64: str
    crop_x: int
    crop_y: int
    crop_width: int
    crop_height: int

class LocalComparisonRequest(BaseModel):
    base_image: str  # base64
    overlay_image: str  # base64 cropped region
    overlay_x: int
    overlay_y: int
    overlay_width: int
    overlay_height: int

@api_router.post("/crop-region")
async def crop_region(request: CropRequest):
    """Crop a region from an image and return it with transparent background"""
    try:
        # Decode image
        img = base64_to_image(request.image_base64)
        
        # Validate crop bounds
        h, w = img.shape[:2]
        x = max(0, min(request.crop_x, w - 1))
        y = max(0, min(request.crop_y, h - 1))
        crop_w = max(10, min(request.crop_width, w - x))
        crop_h = max(10, min(request.crop_height, h - y))
        
        # Crop the region
        cropped = img[y:y+crop_h, x:x+crop_w]
        
        # Convert to RGBA (with alpha channel for transparency)
        if len(cropped.shape) == 2:  # Grayscale
            cropped_rgba = cv2.cvtColor(cropped, cv2.COLOR_GRAY2RGBA)
        else:
            cropped_rgba = cv2.cvtColor(cropped, cv2.COLOR_RGB2RGBA)
        
        # Create alpha mask based on content (make background transparent)
        gray = cv2.cvtColor(cropped, cv2.COLOR_RGB2GRAY) if len(cropped.shape) == 3 else cropped
        _, alpha_mask = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY_INV)
        
        # Apply alpha mask
        cropped_rgba[:, :, 3] = alpha_mask
        
        # Also create a version with solid background for fallback
        cropped_solid = image_to_base64(cropped, 'PNG')
        
        # Convert RGBA to base64
        pil_img = Image.fromarray(cropped_rgba)
        buffer = io.BytesIO()
        pil_img.save(buffer, format='PNG')
        cropped_transparent = base64.b64encode(buffer.getvalue()).decode()
        
        logger.info(f"Cropped region: {crop_w}x{crop_h} from position ({x}, {y})")
        
        return {
            "cropped_image": cropped_transparent,
            "cropped_solid": cropped_solid,
            "width": crop_w,
            "height": crop_h,
            "original_x": x,
            "original_y": y
        }
        
    except Exception as e:
        logger.error(f"Crop error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/local-comparison")
async def local_comparison(request: LocalComparisonRequest):
    """Compare overlay region with the corresponding area in base image"""
    try:
        # Decode images
        base_img = base64_to_image(request.base_image)
        overlay_img = base64_to_image(request.overlay_image)
        
        # Get dimensions
        base_h, base_w = base_img.shape[:2]
        overlay_h, overlay_w = overlay_img.shape[:2]
        
        # Calculate the region in base image that corresponds to overlay position
        x = max(0, min(request.overlay_x, base_w - 1))
        y = max(0, min(request.overlay_y, base_h - 1))
        
        # Resize overlay to match requested dimensions
        target_w = min(request.overlay_width, base_w - x)
        target_h = min(request.overlay_height, base_h - y)
        
        if target_w < 10 or target_h < 10:
            return {"local_ssim": 0, "difference_heatmap": "", "edge_overlap": 0}
        
        # Resize overlay
        overlay_resized = cv2.resize(overlay_img, (target_w, target_h))
        
        # Extract corresponding region from base
        base_region = base_img[y:y+target_h, x:x+target_w]
        
        # Convert to grayscale for comparison
        if len(overlay_resized.shape) == 3:
            overlay_gray = cv2.cvtColor(overlay_resized, cv2.COLOR_RGB2GRAY)
        else:
            overlay_gray = overlay_resized
            
        if len(base_region.shape) == 3:
            base_gray = cv2.cvtColor(base_region, cv2.COLOR_RGB2GRAY)
        else:
            base_gray = base_region
        
        # Calculate local SSIM
        local_ssim_score = calculate_ssim_score(overlay_gray, base_gray)
        
        # Create difference heatmap
        diff = cv2.absdiff(overlay_gray, base_gray)
        diff_blurred = cv2.GaussianBlur(diff, (5, 5), 0)
        diff_norm = cv2.normalize(diff_blurred, None, 0, 255, cv2.NORM_MINMAX)
        heatmap = cv2.applyColorMap(diff_norm.astype(np.uint8), cv2.COLORMAP_JET)
        heatmap_rgb = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)
        
        # Calculate edge overlap
        overlay_edges = cv2.Canny(overlay_gray, 50, 150)
        base_edges = cv2.Canny(base_gray, 50, 150)
        edge_intersection = np.logical_and(overlay_edges > 0, base_edges > 0)
        edge_union = np.logical_or(overlay_edges > 0, base_edges > 0)
        edge_overlap = np.sum(edge_intersection) / (np.sum(edge_union) + 1e-8)
        
        # Create edge overlay visualization
        edge_viz = np.zeros((target_h, target_w, 3), dtype=np.uint8)
        edge_viz[overlay_edges > 0] = [255, 0, 0]  # Red for overlay edges
        edge_viz[base_edges > 0] = [0, 255, 0]  # Green for base edges
        edge_viz[edge_intersection] = [255, 255, 0]  # Yellow for matching
        
        logger.info(f"Local comparison: SSIM={local_ssim_score:.3f}, Edge overlap={edge_overlap:.3f}")
        
        return {
            "local_ssim": round(local_ssim_score * 100, 1),
            "difference_heatmap": image_to_base64(heatmap_rgb, 'PNG'),
            "edge_overlap": round(edge_overlap * 100, 1),
            "edge_visualization": image_to_base64(edge_viz, 'PNG'),
            "region_width": target_w,
            "region_height": target_h
        }
        
    except Exception as e:
        logger.error(f"Local comparison error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class OverlayReportRequest(BaseModel):
    base_image: str
    overlay_image: str
    overlay_x: int
    overlay_y: int
    overlay_width: int
    overlay_height: int
    overlay_alpha: float
    local_ssim: float
    edge_overlap: float
    notes: Optional[str] = None

@api_router.post("/generate-overlay-pdf")
async def generate_overlay_pdf(request: OverlayReportRequest):
    """Generate PDF report for overlay comparison"""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import inch, mm
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as RLImage, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER, TA_LEFT
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=20*mm, bottomMargin=20*mm)
        
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=20, alignment=TA_CENTER, spaceAfter=15)
        heading_style = ParagraphStyle('Heading', parent=styles['Heading2'], fontSize=12, spaceAfter=8, spaceBefore=12)
        normal_style = ParagraphStyle('Normal', parent=styles['Normal'], fontSize=10, spaceAfter=6)
        
        elements = []
        
        # Title
        elements.append(Paragraph("Detail Overlay Comparison Report", title_style))
        elements.append(Paragraph(f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}", normal_style))
        elements.append(Spacer(1, 15))
        
        # Overlay Settings
        elements.append(Paragraph("OVERLAY SETTINGS", heading_style))
        settings_data = [
            ["Position (X, Y)", f"({request.overlay_x}, {request.overlay_y})"],
            ["Size (W × H)", f"{request.overlay_width} × {request.overlay_height} px"],
            ["Transparency", f"{int(request.overlay_alpha * 100)}%"],
        ]
        settings_table = Table(settings_data, colWidths=[2*inch, 3*inch])
        settings_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#1e293b')),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('BACKGROUND', (1, 0), (1, -1), colors.HexColor('#f8fafc')),
        ]))
        elements.append(settings_table)
        elements.append(Spacer(1, 15))
        
        # Local Comparison Scores
        elements.append(Paragraph("LOCAL COMPARISON METRICS", heading_style))
        
        ssim_color = colors.HexColor('#22c55e') if request.local_ssim >= 85 else (
            colors.HexColor('#f59e0b') if request.local_ssim >= 70 else colors.HexColor('#ef4444')
        )
        edge_color = colors.HexColor('#22c55e') if request.edge_overlap >= 50 else (
            colors.HexColor('#f59e0b') if request.edge_overlap >= 30 else colors.HexColor('#ef4444')
        )
        
        scores_data = [
            ["Metric", "Score", "Interpretation"],
            ["Local SSIM", f"{request.local_ssim:.1f}%", "Structural similarity in overlay region"],
            ["Edge Overlap", f"{request.edge_overlap:.1f}%", "Stroke edge alignment match"],
        ]
        scores_table = Table(scores_data, colWidths=[1.5*inch, 1*inch, 3*inch])
        scores_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f1f5f9')]),
        ]))
        elements.append(scores_table)
        elements.append(Spacer(1, 15))
        
        # Notes
        if request.notes:
            elements.append(Paragraph("EXAMINER NOTES", heading_style))
            elements.append(Paragraph(request.notes, normal_style))
        
        # Build PDF
        doc.build(elements)
        
        pdf_bytes = buffer.getvalue()
        pdf_base64 = base64.b64encode(pdf_bytes).decode()
        
        return {
            "pdf_base64": pdf_base64,
            "filename": f"overlay_comparison_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.pdf"
        }
        
    except Exception as e:
        logger.error(f"Overlay PDF error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============== PDF REPORT GENERATION ==============

class PDFReportRequest(BaseModel):
    comparison_id: str
    questioned_thumb: str
    known_thumb: str
    processed_questioned: str
    processed_known: str
    difference_heatmap: str
    composite_score: float
    sub_scores: List[Dict[str, Any]]
    verdict: str
    ai_analysis: Optional[str] = None

from fastapi.responses import Response

@api_router.post("/generate-pdf")
async def generate_pdf_report(request: PDFReportRequest):
    """Generate PDF report for a comparison"""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import inch, mm
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as RLImage, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER, TA_LEFT
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=20*mm, bottomMargin=20*mm)
        
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=24, alignment=TA_CENTER, spaceAfter=20)
        heading_style = ParagraphStyle('Heading', parent=styles['Heading2'], fontSize=14, spaceAfter=10, spaceBefore=15)
        normal_style = ParagraphStyle('Normal', parent=styles['Normal'], fontSize=10, spaceAfter=6)
        score_style = ParagraphStyle('Score', parent=styles['Normal'], fontSize=36, alignment=TA_CENTER, textColor=colors.HexColor('#3b82f6'))
        verdict_style = ParagraphStyle('Verdict', parent=styles['Normal'], fontSize=16, alignment=TA_CENTER, spaceAfter=20)
        
        elements = []
        
        # Title
        elements.append(Paragraph("Handwriting Forensic Analysis Report", title_style))
        elements.append(Spacer(1, 10))
        
        # Timestamp and ID
        elements.append(Paragraph(f"Report ID: {request.comparison_id}", normal_style))
        elements.append(Paragraph(f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}", normal_style))
        elements.append(Paragraph("App Version: 1.0.0", normal_style))
        elements.append(Spacer(1, 20))
        
        # Composite Score
        elements.append(Paragraph("COMPOSITE FORENSIC SCORE", heading_style))
        
        # Determine verdict color
        if request.composite_score >= 88:
            verdict_color = colors.HexColor('#22c55e')
        elif request.composite_score >= 70:
            verdict_color = colors.HexColor('#f59e0b')
        else:
            verdict_color = colors.HexColor('#ef4444')
        
        score_style_colored = ParagraphStyle('ScoreColored', parent=score_style, textColor=verdict_color)
        elements.append(Paragraph(f"{request.composite_score:.1f}%", score_style_colored))
        
        verdict_style_colored = ParagraphStyle('VerdictColored', parent=verdict_style, textColor=verdict_color)
        elements.append(Paragraph(request.verdict, verdict_style_colored))
        elements.append(Spacer(1, 10))
        
        # Sample Images
        elements.append(Paragraph("SAMPLE IMAGES", heading_style))
        
        def base64_to_rl_image(b64_str: str, width: float, height: float) -> RLImage:
            if ',' in b64_str:
                b64_str = b64_str.split(',')[1]
            img_data = base64.b64decode(b64_str)
            img_buffer = io.BytesIO(img_data)
            return RLImage(img_buffer, width=width, height=height)
        
        try:
            q_img = base64_to_rl_image(request.questioned_thumb, 2*inch, 2*inch)
            k_img = base64_to_rl_image(request.known_thumb, 2*inch, 2*inch)
            
            img_table = Table([
                [Paragraph("Questioned Document", normal_style), Paragraph("Known Sample", normal_style)],
                [q_img, k_img]
            ], colWidths=[3*inch, 3*inch])
            img_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ]))
            elements.append(img_table)
        except Exception as e:
            logger.warning(f"Could not add images to PDF: {e}")
            elements.append(Paragraph("(Images could not be rendered)", normal_style))
        
        elements.append(Spacer(1, 15))
        
        # Sub-Scores Table
        elements.append(Paragraph("ANALYSIS BREAKDOWN", heading_style))
        
        score_data = [["Metric", "Score", "Details"]]
        for sub in request.sub_scores:
            score_data.append([
                sub.get('name', ''),
                f"{sub.get('score', 0):.1f}%",
                sub.get('description', '')
            ])
        
        score_table = Table(score_data, colWidths=[1.8*inch, 1*inch, 3.2*inch])
        score_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('TOPPADDING', (0, 0), (-1, 0), 10),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f1f5f9')]),
        ]))
        elements.append(score_table)
        elements.append(Spacer(1, 15))
        
        # AI Analysis (if available)
        if request.ai_analysis:
            elements.append(Paragraph("AI DEEP ANALYSIS", heading_style))
            # Truncate if too long
            ai_text = request.ai_analysis[:2000] + "..." if len(request.ai_analysis) > 2000 else request.ai_analysis
            # Clean up for PDF
            ai_text = ai_text.replace('\n', '<br/>')
            elements.append(Paragraph(ai_text, normal_style))
        
        # Build PDF
        doc.build(elements)
        
        pdf_bytes = buffer.getvalue()
        pdf_base64 = base64.b64encode(pdf_bytes).decode()
        
        logger.info(f"PDF generated successfully, size: {len(pdf_bytes)} bytes")
        
        return {
            "pdf_base64": pdf_base64,
            "filename": f"forensic_report_{request.comparison_id[:8]}.pdf"
        }
        
    except Exception as e:
        logger.error(f"PDF generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
