#!/usr/bin/env python3
"""
Detailed verification of Grok Vision model and response format
"""

import requests
import json
import base64
import io
from PIL import Image, ImageDraw, ImageFont

# Backend URL
BACKEND_URL = "https://forensic-lab-test.preview.emergentagent.com/api"

def create_simple_handwriting():
    """Create a simple handwriting sample"""
    img = Image.new('RGB', (300, 150), 'white')
    draw = ImageDraw.Draw(img)
    font = ImageFont.load_default()
    
    # Simple handwritten text
    draw.text((20, 50), "Test Sample", fill='black', font=font)
    draw.line([(20, 80), (150, 85)], fill='black', width=2)  # Underline
    
    return img

def image_to_base64(img):
    """Convert PIL image to base64"""
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode()

def test_detailed_grok_response():
    """Test and analyze detailed Grok response"""
    print("Testing detailed Grok Vision response...")
    
    # Create test images
    img1 = create_simple_handwriting()
    img2 = create_simple_handwriting()
    
    request_data = {
        "questioned_image": image_to_base64(img1),
        "known_image": image_to_base64(img2),
        "use_ai_analysis": True
    }
    
    response = requests.post(
        f"{BACKEND_URL}/compare",
        json=request_data,
        headers={"Content-Type": "application/json"},
        timeout=60
    )
    
    if response.status_code == 200:
        data = response.json()
        
        print("=== DETAILED AI ANALYSIS ===")
        ai_analysis = data.get('ai_analysis', '')
        print(ai_analysis)
        print("\n=== SUB SCORES ===")
        for sub_score in data.get('sub_scores', []):
            if sub_score.get('name') == 'AI Deep Analysis':
                print(f"Name: {sub_score.get('name')}")
                print(f"Score: {sub_score.get('score')}")
                print(f"Description: {sub_score.get('description')}")
        
        print(f"\n=== COMPOSITE SCORE ===")
        print(f"Score: {data.get('composite_score')}%")
        print(f"Verdict: {data.get('verdict')}")
        
        return True
    else:
        print(f"Request failed: {response.status_code}")
        print(response.text)
        return False

if __name__ == "__main__":
    test_detailed_grok_response()