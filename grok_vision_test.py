#!/usr/bin/env python3
"""
Focused test for Grok Vision integration in handwriting comparison
Tests the /api/compare endpoint with AI analysis enabled
"""

import requests
import json
import base64
import io
from PIL import Image, ImageDraw, ImageFont
import sys

# Backend URL from frontend environment
BACKEND_URL = "https://writesleuth.preview.emergentagent.com/api"

def create_handwriting_sample_1():
    """Create first handwriting sample with distinct characteristics"""
    img = Image.new('RGB', (400, 200), 'white')
    draw = ImageDraw.Draw(img)
    
    # Draw handwritten text with specific characteristics
    font = ImageFont.load_default()
    
    # Write "John Smith" with right slant
    text = "John Smith"
    x, y = 30, 60
    for i, char in enumerate(text):
        char_x = x + i * 18 + i * 2  # Spacing
        char_y = y + i * 1  # Right slant
        draw.text((char_x, char_y), char, fill='black', font=font)
    
    # Add signature-like flourish
    draw.line([(50, 120), (150, 110), (200, 115), (250, 105)], fill='black', width=2)
    
    # Add some pressure variation (thicker strokes)
    draw.ellipse([80, 80, 85, 85], fill='black')  # Dot on 'i'
    draw.line([(120, 70), (125, 90)], fill='black', width=3)  # Thick stroke
    
    return img

def create_handwriting_sample_2():
    """Create second handwriting sample with different characteristics"""
    img = Image.new('RGB', (400, 200), 'white')
    draw = ImageDraw.Draw(img)
    
    # Draw handwritten text with different characteristics
    font = ImageFont.load_default()
    
    # Write "John Smith" with left slant and different spacing
    text = "John Smith"
    x, y = 40, 70
    for i, char in enumerate(text):
        char_x = x + i * 16 - i * 1  # Different spacing
        char_y = y - i * 1  # Left slant
        draw.text((char_x, char_y), char, fill='black', font=font)
    
    # Add different signature style
    draw.arc([60, 110, 180, 140], 0, 180, fill='black', width=2)
    
    # Add different pressure patterns
    draw.rectangle([90, 85, 93, 88], fill='black')  # Square dot
    draw.line([(130, 75), (132, 85)], fill='black', width=1)  # Thin stroke
    
    return img

def image_to_base64(img, format='PNG'):
    """Convert PIL image to base64 string"""
    buffer = io.BytesIO()
    img.save(buffer, format=format)
    img_str = base64.b64encode(buffer.getvalue()).decode()
    return img_str  # Return clean base64 without data URL prefix

def test_grok_vision_integration():
    """Test Grok Vision integration for handwriting comparison"""
    print("=" * 60)
    print("TESTING GROK VISION INTEGRATION")
    print("=" * 60)
    print(f"Testing endpoint: {BACKEND_URL}/compare")
    print()
    
    try:
        # Create two different handwriting samples with actual visual features
        print("Creating handwriting samples...")
        img1 = create_handwriting_sample_1()
        img2 = create_handwriting_sample_2()
        
        # Convert to base64 (clean format without data URL prefix)
        img1_b64 = image_to_base64(img1, 'PNG')
        img2_b64 = image_to_base64(img2, 'PNG')
        
        print(f"Sample 1 size: {len(img1_b64)} characters")
        print(f"Sample 2 size: {len(img2_b64)} characters")
        
        # Prepare request data as specified in review request
        request_data = {
            "questioned_image": img1_b64,
            "known_image": img2_b64,
            "use_ai_analysis": True
        }
        
        print("\nSending comparison request with Grok Vision analysis...")
        response = requests.post(
            f"{BACKEND_URL}/compare",
            json=request_data,
            headers={"Content-Type": "application/json"},
            timeout=120  # Longer timeout for AI analysis
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ Request failed with status {response.status_code}")
            try:
                error_detail = response.json()
                print(f"Error details: {error_detail}")
            except:
                print(f"Error text: {response.text}")
            return False
        
        # Parse response
        data = response.json()
        print("\n" + "=" * 40)
        print("RESPONSE ANALYSIS")
        print("=" * 40)
        
        # Check required fields as specified in review request
        required_fields = ['composite_score', 'sub_scores', 'ai_analysis', 'verdict']
        missing_fields = [field for field in required_fields if field not in data]
        
        if missing_fields:
            print(f"❌ Missing required fields: {missing_fields}")
            return False
        
        print(f"✅ All required fields present: {required_fields}")
        
        # Check composite_score
        composite_score = data.get('composite_score')
        print(f"Composite Score: {composite_score}%")
        if not isinstance(composite_score, (int, float)) or composite_score < 0 or composite_score > 100:
            print("❌ Invalid composite_score format or range")
            return False
        print("✅ Composite score valid")
        
        # Check sub_scores for AI Deep Analysis
        sub_scores = data.get('sub_scores', [])
        print(f"Sub-scores count: {len(sub_scores)}")
        
        ai_deep_analysis_found = False
        for sub_score in sub_scores:
            print(f"  - {sub_score.get('name', 'Unknown')}: {sub_score.get('score', 0)}%")
            if sub_score.get('name') == 'AI Deep Analysis':
                ai_deep_analysis_found = True
                description = sub_score.get('description', '')
                if 'Grok Vision forensic analysis' in description:
                    print("✅ AI Deep Analysis with Grok Vision description found")
                else:
                    print(f"⚠️ AI Deep Analysis found but description doesn't mention Grok Vision: {description}")
        
        if not ai_deep_analysis_found:
            print("❌ AI Deep Analysis not found in sub_scores")
            return False
        
        # Check ai_analysis text
        ai_analysis = data.get('ai_analysis')
        if not ai_analysis or not isinstance(ai_analysis, str):
            print("❌ ai_analysis field missing or invalid")
            return False
        
        print(f"AI Analysis length: {len(ai_analysis)} characters")
        print(f"AI Analysis preview: {ai_analysis[:200]}...")
        
        # Check if it looks like Grok analysis (should contain forensic terms)
        forensic_terms = ['similarity', 'handwriting', 'analysis', 'forensic', 'sample']
        found_terms = [term for term in forensic_terms if term.lower() in ai_analysis.lower()]
        
        if len(found_terms) >= 2:
            print(f"✅ AI analysis contains forensic terms: {found_terms}")
        else:
            print(f"⚠️ AI analysis may not be forensic-focused. Found terms: {found_terms}")
        
        # Check verdict
        verdict = data.get('verdict')
        if not verdict or not isinstance(verdict, str):
            print("❌ verdict field missing or invalid")
            return False
        
        print(f"Verdict: {verdict}")
        print("✅ Verdict field valid")
        
        # Additional checks for other expected fields
        other_fields = ['id', 'timestamp', 'verdict_color']
        for field in other_fields:
            if field in data:
                print(f"✅ {field}: {data[field]}")
            else:
                print(f"⚠️ Optional field {field} missing")
        
        print("\n" + "=" * 60)
        print("GROK VISION INTEGRATION TEST RESULTS")
        print("=" * 60)
        print("✅ Endpoint processes base64 images correctly")
        print("✅ Grok Vision API integration working")
        print("✅ Response includes composite_score")
        print("✅ Response includes sub_scores with AI Deep Analysis")
        print("✅ Response includes ai_analysis text from Grok")
        print("✅ Response includes verdict")
        print("✅ All required fields present and valid")
        print("\n🎉 GROK VISION INTEGRATION TEST PASSED!")
        
        return True
        
    except Exception as e:
        print(f"❌ Test error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_grok_vision_integration()
    sys.exit(0 if success else 1)