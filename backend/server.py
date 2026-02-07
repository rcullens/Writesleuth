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
    """Use GPT-4o Vision to analyze handwriting samples"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            logger.warning("No EMERGENT_LLM_KEY found, skipping AI analysis")
            return {'score': 0.5, 'analysis': 'AI analysis unavailable'}
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"handwriting-analysis-{uuid.uuid4()}",
            system_message="""You are an expert forensic document examiner specializing in handwriting analysis. 
Analyze the two handwriting samples provided and compare them for authorship determination.
Focus on: letter formations, slant consistency, spacing patterns, pressure indicators, baseline alignment, 
connecting strokes, unique characteristics, and overall writing style.
Provide a similarity score from 0-100 and detailed analysis."""
        ).with_model("openai", "gpt-4o")
        
        # Clean base64 strings
        if ',' in img1_base64:
            img1_base64 = img1_base64.split(',')[1]
        if ',' in img2_base64:
            img2_base64 = img2_base64.split(',')[1]
        
        # Create image contents - using file_contents approach
        # Save images temporarily for analysis
        import tempfile
        temp_dir = tempfile.gettempdir()
        
        # Write first image
        img1_path = f"{temp_dir}/img1_{uuid.uuid4()}.png"
        with open(img1_path, 'wb') as f:
            f.write(base64.b64decode(img1_base64))
        
        # Write second image  
        img2_path = f"{temp_dir}/img2_{uuid.uuid4()}.png"
        with open(img2_path, 'wb') as f:
            f.write(base64.b64decode(img2_base64))
        
        file1 = FileContentWithMimeType(file_path=img1_path, mime_type="image/png")
        file2 = FileContentWithMimeType(file_path=img2_path, mime_type="image/png")
        
        message = UserMessage(
            text="""Compare these two handwriting samples for forensic analysis.

The first image is the Questioned Document (sample to be verified).
The second image is the Known Sample (reference sample).

Provide your analysis in this exact format:
SIMILARITY_SCORE: [0-100]
CONFIDENCE: [LOW/MEDIUM/HIGH]
KEY_SIMILARITIES: [list main similar features]
KEY_DIFFERENCES: [list main different features]
DETAILED_ANALYSIS: [comprehensive analysis paragraph]""",
            file_contents=[file1, file2]
        )
        
        response = await chat.send_message(message)
        
        # Parse response
        score = 50
        if 'SIMILARITY_SCORE:' in response:
            try:
                score_str = response.split('SIMILARITY_SCORE:')[1].split('\n')[0].strip()
                score = int(''.join(filter(str.isdigit, score_str[:3])))
                score = max(0, min(100, score))
            except:
                pass
        
        return {
            'score': score / 100,
            'analysis': response
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
    
    # Determine verdict
    composite_pct = composite * 100
    if composite_pct >= 88:
        verdict = "High probability same writer"
        verdict_color = "#22c55e"  # Green
    elif composite_pct >= 70:
        verdict = "Possible / Inconclusive"
        verdict_color = "#f59e0b"  # Amber
    else:
        verdict = "Likely different writers"
        verdict_color = "#ef4444"  # Red
    
    # Build sub-scores
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
            description="GPT-4o Vision forensic analysis"
        ))
    
    return {
        'composite_score': round(composite_pct, 1),
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
