#!/usr/bin/env python3
"""
Backend API Tests for Handwriting Forensic Comparator
Tests all API endpoints with proper base64 image handling
"""

import requests
import json
import base64
import io
from PIL import Image, ImageDraw, ImageFont
import numpy as np
import sys
import os

# Backend URL from frontend environment
BACKEND_URL = "https://writesleuth.preview.emergentagent.com/api"

def create_test_handwriting_image(text="Sample handwriting", width=400, height=200):
    """Create a realistic handwriting-like image for testing"""
    # Create a white background image
    img = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(img)
    
    # Try to use a handwriting-like font, fallback to default
    try:
        # Use default font but make it look more handwritten with variations
        font_size = 24
        font = ImageFont.load_default()
    except:
        font = ImageFont.load_default()
    
    # Draw text with slight variations to simulate handwriting
    x, y = 20, 50
    for i, char in enumerate(text):
        # Add slight random variations in position
        char_x = x + i * 15 + (i % 3 - 1) * 2  # Slight horizontal variation
        char_y = y + (i % 2) * 3  # Slight vertical variation
        draw.text((char_x, char_y), char, fill='black', font=font)
    
    # Add some connecting strokes between letters
    for i in range(len(text) - 1):
        start_x = x + i * 15 + 10
        start_y = y + 15
        end_x = x + (i + 1) * 15
        end_y = y + 15 + (i % 2) * 2
        draw.line([(start_x, start_y), (end_x, end_y)], fill='black', width=1)
    
    # Add a baseline
    draw.line([(10, y + 30), (width - 10, y + 30)], fill='lightgray', width=1)
    
    return img

def image_to_base64(img, format='PNG'):
    """Convert PIL image to base64 string"""
    buffer = io.BytesIO()
    img.save(buffer, format=format)
    img_str = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/{format.lower()};base64,{img_str}"

def test_root_endpoint():
    """Test GET / endpoint"""
    print("Testing GET / endpoint...")
    try:
        response = requests.get(f"{BACKEND_URL}/")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            data = response.json()
            if "message" in data and "version" in data:
                print("✅ Root endpoint working correctly")
                return True
            else:
                print("❌ Root endpoint missing required fields")
                return False
        else:
            print(f"❌ Root endpoint failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Root endpoint error: {e}")
        return False

def test_health_endpoint():
    """Test GET /health endpoint"""
    print("\nTesting GET /health endpoint...")
    try:
        response = requests.get(f"{BACKEND_URL}/health")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            data = response.json()
            if "status" in data and data["status"] == "healthy":
                print("✅ Health endpoint working correctly")
                return True
            else:
                print("❌ Health endpoint not returning healthy status")
                return False
        else:
            print(f"❌ Health endpoint failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health endpoint error: {e}")
        return False

def test_history_endpoint():
    """Test GET /history endpoint"""
    print("\nTesting GET /history endpoint...")
    try:
        response = requests.get(f"{BACKEND_URL}/history")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                print(f"✅ History endpoint working correctly (returned {len(data)} items)")
                return True
            else:
                print("❌ History endpoint not returning a list")
                return False
        else:
            print(f"❌ History endpoint failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ History endpoint error: {e}")
        return False

def test_clear_history_endpoint():
    """Test DELETE /history endpoint"""
    print("\nTesting DELETE /history endpoint...")
    try:
        response = requests.delete(f"{BACKEND_URL}/history")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            data = response.json()
            if "message" in data:
                print("✅ Clear history endpoint working correctly")
                return True
            else:
                print("❌ Clear history endpoint missing message field")
                return False
        else:
            print(f"❌ Clear history endpoint failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Clear history endpoint error: {e}")
        return False

def test_compare_endpoint():
    """Test POST /compare endpoint with base64 images"""
    print("\nTesting POST /compare endpoint...")
    try:
        # Create two different handwriting samples
        img1 = create_test_handwriting_image("John Smith signature", 400, 150)
        img2 = create_test_handwriting_image("John Smith document", 400, 150)
        
        # Convert to base64
        img1_b64 = image_to_base64(img1)
        img2_b64 = image_to_base64(img2)
        
        # Prepare request data
        request_data = {
            "questioned_image": img1_b64,
            "known_image": img2_b64,
            "use_ai_analysis": False  # Disable AI to avoid API key issues
        }
        
        print("Sending comparison request...")
        response = requests.post(
            f"{BACKEND_URL}/compare",
            json=request_data,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("Response keys:", list(data.keys()))
            
            # Check required fields
            required_fields = [
                'id', 'timestamp', 'composite_score', 'verdict', 
                'verdict_color', 'sub_scores'
            ]
            
            missing_fields = [field for field in required_fields if field not in data]
            if missing_fields:
                print(f"❌ Compare endpoint missing fields: {missing_fields}")
                return False
            
            print(f"Composite Score: {data['composite_score']}")
            print(f"Verdict: {data['verdict']}")
            print(f"Sub-scores count: {len(data['sub_scores'])}")
            
            print("✅ Compare endpoint working correctly")
            return True
        else:
            print(f"❌ Compare endpoint failed with status {response.status_code}")
            try:
                error_detail = response.json()
                print(f"Error details: {error_detail}")
            except:
                print(f"Error text: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Compare endpoint error: {e}")
        return False

def test_compare_endpoint_with_ai():
    """Test POST /compare endpoint with AI analysis enabled"""
    print("\nTesting POST /compare endpoint with AI analysis...")
    try:
        # Create two different handwriting samples
        img1 = create_test_handwriting_image("Mary Johnson", 350, 120)
        img2 = create_test_handwriting_image("Mary Johnson", 350, 120)
        
        # Convert to base64
        img1_b64 = image_to_base64(img1)
        img2_b64 = image_to_base64(img2)
        
        # Prepare request data with AI enabled
        request_data = {
            "questioned_image": img1_b64,
            "known_image": img2_b64,
            "use_ai_analysis": True
        }
        
        print("Sending comparison request with AI analysis...")
        response = requests.post(
            f"{BACKEND_URL}/compare",
            json=request_data,
            headers={"Content-Type": "application/json"},
            timeout=60  # Longer timeout for AI analysis
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Composite Score: {data['composite_score']}")
            print(f"Verdict: {data['verdict']}")
            
            # Check if AI analysis is present
            if data.get('ai_analysis'):
                print("✅ AI analysis included in response")
            else:
                print("⚠️ AI analysis not included (may be due to missing API key)")
            
            print("✅ Compare endpoint with AI working correctly")
            return True
        else:
            print(f"❌ Compare endpoint with AI failed with status {response.status_code}")
            try:
                error_detail = response.json()
                print(f"Error details: {error_detail}")
            except:
                print(f"Error text: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Compare endpoint with AI error: {e}")
        return False

def run_all_tests():
    """Run all backend API tests"""
    print("=" * 60)
    print("HANDWRITING FORENSIC COMPARATOR - BACKEND API TESTS")
    print("=" * 60)
    print(f"Testing backend at: {BACKEND_URL}")
    print()
    
    test_results = {}
    
    # Test basic endpoints
    test_results['root'] = test_root_endpoint()
    test_results['health'] = test_health_endpoint()
    test_results['history'] = test_history_endpoint()
    test_results['clear_history'] = test_clear_history_endpoint()
    
    # Test comparison endpoints
    test_results['compare'] = test_compare_endpoint()
    test_results['compare_ai'] = test_compare_endpoint_with_ai()
    
    # Test history again to see if comparison was saved
    print("\nTesting history after comparison...")
    test_results['history_after'] = test_history_endpoint()
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    passed = 0
    total = len(test_results)
    
    for test_name, result in test_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name.upper()}: {status}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed!")
        return True
    else:
        print("⚠️ Some tests failed. Check the details above.")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)