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
BACKEND_URL = "https://crop-zoom-app.preview.emergentagent.com/api"

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

def test_pdf_generation_endpoint():
    """Test POST /generate-pdf endpoint"""
    print("\nTesting POST /generate-pdf endpoint...")
    try:
        # Create test images as specified in the review request
        img1 = create_test_handwriting_image("Test Sample 1", 300, 150)
        img2 = create_test_handwriting_image("Test Sample 2", 300, 150)
        img3 = create_test_handwriting_image("Processed 1", 300, 150)
        img4 = create_test_handwriting_image("Processed 2", 300, 150)
        img5 = create_test_handwriting_image("Heatmap", 300, 150)
        
        # Convert to base64 (without data URL prefix for the request)
        def img_to_base64_clean(img):
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            return base64.b64encode(buffer.getvalue()).decode()
        
        questioned_thumb = img_to_base64_clean(img1)
        known_thumb = img_to_base64_clean(img2)
        processed_questioned = img_to_base64_clean(img3)
        processed_known = img_to_base64_clean(img4)
        difference_heatmap = img_to_base64_clean(img5)
        
        # Prepare request data as specified in the review request
        request_data = {
            "comparison_id": "test-123",
            "questioned_thumb": questioned_thumb,
            "known_thumb": known_thumb,
            "processed_questioned": processed_questioned,
            "processed_known": processed_known,
            "difference_heatmap": difference_heatmap,
            "composite_score": 85.5,
            "sub_scores": [
                {"name": "Macro Geometry", "score": 84.0, "description": "Test description"},
                {"name": "Stroke Distribution", "score": 78.5, "description": "Stroke width similarity"}
            ],
            "verdict": "High probability same writer",
            "ai_analysis": "This is a test AI analysis text."
        }
        
        print("Sending PDF generation request...")
        response = requests.post(
            f"{BACKEND_URL}/generate-pdf",
            json=request_data,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("Response keys:", list(data.keys()))
            
            # Check required fields as specified in review request
            required_fields = ['pdf_base64', 'filename']
            missing_fields = [field for field in required_fields if field not in data]
            if missing_fields:
                print(f"❌ PDF generation endpoint missing fields: {missing_fields}")
                return False
            
            # Validate the response format
            pdf_base64 = data.get('pdf_base64', '')
            filename = data.get('filename', '')
            
            if not pdf_base64:
                print("❌ PDF generation endpoint returned empty pdf_base64")
                return False
            
            if not filename.startswith('forensic_report_') or not filename.endswith('.pdf'):
                print(f"❌ PDF generation endpoint returned invalid filename: {filename}")
                return False
            
            # Check if the base64 is valid PDF content
            try:
                pdf_bytes = base64.b64decode(pdf_base64)
                if not pdf_bytes.startswith(b'%PDF'):
                    print("❌ PDF generation endpoint returned invalid PDF content")
                    return False
            except Exception as e:
                print(f"❌ PDF generation endpoint returned invalid base64: {e}")
                return False
            
            print(f"PDF filename: {filename}")
            print(f"PDF size: {len(pdf_bytes)} bytes")
            print("✅ PDF generation endpoint working correctly")
            return True
        else:
            print(f"❌ PDF generation endpoint failed with status {response.status_code}")
            try:
                error_detail = response.json()
                print(f"Error details: {error_detail}")
            except:
                print(f"Error text: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ PDF generation endpoint error: {e}")
        return False

def test_crop_region_endpoint():
    """Test POST /crop-region endpoint"""
    print("\nTesting POST /crop-region endpoint...")
    try:
        # Create a test image with visual features (handwriting)
        img = create_test_handwriting_image("Sample handwriting for cropping test", 400, 200)
        
        # Convert to base64 (without data URL prefix)
        def img_to_base64_clean(img):
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            return base64.b64encode(buffer.getvalue()).decode()
        
        image_base64 = img_to_base64_clean(img)
        
        # Prepare request data as specified in review request
        request_data = {
            "image_base64": image_base64,
            "crop_x": 50,
            "crop_y": 50,
            "crop_width": 100,
            "crop_height": 80
        }
        
        print("Sending crop region request...")
        response = requests.post(
            f"{BACKEND_URL}/crop-region",
            json=request_data,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("Response keys:", list(data.keys()))
            
            # Check required fields as specified in review request
            required_fields = ['cropped_image', 'cropped_solid', 'width', 'height', 'original_x', 'original_y']
            missing_fields = [field for field in required_fields if field not in data]
            if missing_fields:
                print(f"❌ Crop region endpoint missing fields: {missing_fields}")
                return False
            
            # Validate the response values
            if data.get('width') != 100 or data.get('height') != 80:
                print(f"❌ Crop region endpoint returned incorrect dimensions: {data.get('width')}x{data.get('height')}")
                return False
            
            if data.get('original_x') != 50 or data.get('original_y') != 50:
                print(f"❌ Crop region endpoint returned incorrect position: ({data.get('original_x')}, {data.get('original_y')})")
                return False
            
            # Validate base64 images
            cropped_image = data.get('cropped_image', '')
            cropped_solid = data.get('cropped_solid', '')
            
            if not cropped_image or not cropped_solid:
                print("❌ Crop region endpoint returned empty image data")
                return False
            
            print(f"Cropped dimensions: {data['width']}x{data['height']}")
            print(f"Original position: ({data['original_x']}, {data['original_y']})")
            print("✅ Crop region endpoint working correctly")
            return True
        else:
            print(f"❌ Crop region endpoint failed with status {response.status_code}")
            try:
                error_detail = response.json()
                print(f"Error details: {error_detail}")
            except:
                print(f"Error text: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Crop region endpoint error: {e}")
        return False

def test_local_comparison_endpoint():
    """Test POST /local-comparison endpoint"""
    print("\nTesting POST /local-comparison endpoint...")
    try:
        # Create test images with visual features
        base_img = create_test_handwriting_image("Base document with handwriting", 400, 200)
        overlay_img = create_test_handwriting_image("Overlay sample text", 150, 100)
        
        # Convert to base64 (without data URL prefix)
        def img_to_base64_clean(img):
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            return base64.b64encode(buffer.getvalue()).decode()
        
        base_image_b64 = img_to_base64_clean(base_img)
        overlay_image_b64 = img_to_base64_clean(overlay_img)
        
        # Prepare request data as specified in review request
        request_data = {
            "base_image": base_image_b64,
            "overlay_image": overlay_image_b64,
            "overlay_x": 50,
            "overlay_y": 50,
            "overlay_width": 100,
            "overlay_height": 80
        }
        
        print("Sending local comparison request...")
        response = requests.post(
            f"{BACKEND_URL}/local-comparison",
            json=request_data,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("Response keys:", list(data.keys()))
            
            # Check required fields as specified in review request
            required_fields = ['local_ssim', 'difference_heatmap', 'edge_overlap', 'edge_visualization']
            missing_fields = [field for field in required_fields if field not in data]
            if missing_fields:
                print(f"❌ Local comparison endpoint missing fields: {missing_fields}")
                return False
            
            # Validate the response values
            local_ssim = data.get('local_ssim')
            edge_overlap = data.get('edge_overlap')
            difference_heatmap = data.get('difference_heatmap', '')
            edge_visualization = data.get('edge_visualization', '')
            
            if local_ssim is None or not isinstance(local_ssim, (int, float)):
                print(f"❌ Local comparison endpoint returned invalid local_ssim: {local_ssim}")
                return False
            
            if edge_overlap is None or not isinstance(edge_overlap, (int, float)):
                print(f"❌ Local comparison endpoint returned invalid edge_overlap: {edge_overlap}")
                return False
            
            if not difference_heatmap or not edge_visualization:
                print("❌ Local comparison endpoint returned empty visualization data")
                return False
            
            print(f"Local SSIM: {local_ssim}%")
            print(f"Edge Overlap: {edge_overlap}%")
            print("✅ Local comparison endpoint working correctly")
            return True
        else:
            print(f"❌ Local comparison endpoint failed with status {response.status_code}")
            try:
                error_detail = response.json()
                print(f"Error details: {error_detail}")
            except:
                print(f"Error text: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Local comparison endpoint error: {e}")
        return False

def test_generate_overlay_pdf_endpoint():
    """Test POST /generate-overlay-pdf endpoint"""
    print("\nTesting POST /generate-overlay-pdf endpoint...")
    try:
        # Create test images with visual features
        base_img = create_test_handwriting_image("Base document for PDF", 400, 200)
        overlay_img = create_test_handwriting_image("Overlay for PDF", 150, 100)
        
        # Convert to base64 (without data URL prefix)
        def img_to_base64_clean(img):
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            return base64.b64encode(buffer.getvalue()).decode()
        
        base_image_b64 = img_to_base64_clean(base_img)
        overlay_image_b64 = img_to_base64_clean(overlay_img)
        
        # Prepare request data as specified in review request
        request_data = {
            "base_image": base_image_b64,
            "overlay_image": overlay_image_b64,
            "overlay_x": 50,
            "overlay_y": 50,
            "overlay_width": 100,
            "overlay_height": 80,
            "overlay_alpha": 0.7,
            "local_ssim": 75.5,
            "edge_overlap": 45.2
        }
        
        print("Sending generate overlay PDF request...")
        response = requests.post(
            f"{BACKEND_URL}/generate-overlay-pdf",
            json=request_data,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("Response keys:", list(data.keys()))
            
            # Check required fields as specified in review request
            required_fields = ['pdf_base64', 'filename']
            missing_fields = [field for field in required_fields if field not in data]
            if missing_fields:
                print(f"❌ Generate overlay PDF endpoint missing fields: {missing_fields}")
                return False
            
            # Validate the response format
            pdf_base64 = data.get('pdf_base64', '')
            filename = data.get('filename', '')
            
            if not pdf_base64:
                print("❌ Generate overlay PDF endpoint returned empty pdf_base64")
                return False
            
            if not filename.startswith('overlay_comparison_') or not filename.endswith('.pdf'):
                print(f"❌ Generate overlay PDF endpoint returned invalid filename: {filename}")
                return False
            
            # Check if the base64 is valid PDF content
            try:
                pdf_bytes = base64.b64decode(pdf_base64)
                if not pdf_bytes.startswith(b'%PDF'):
                    print("❌ Generate overlay PDF endpoint returned invalid PDF content")
                    return False
            except Exception as e:
                print(f"❌ Generate overlay PDF endpoint returned invalid base64: {e}")
                return False
            
            print(f"PDF filename: {filename}")
            print(f"PDF size: {len(pdf_bytes)} bytes")
            print("✅ Generate overlay PDF endpoint working correctly")
            return True
        else:
            print(f"❌ Generate overlay PDF endpoint failed with status {response.status_code}")
            try:
                error_detail = response.json()
                print(f"Error details: {error_detail}")
            except:
                print(f"Error text: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Generate overlay PDF endpoint error: {e}")
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
    
    # Test PDF generation endpoint
    test_results['pdf_generation'] = test_pdf_generation_endpoint()
    
    # Test NEW Crop & Overlay endpoints
    test_results['crop_region'] = test_crop_region_endpoint()
    test_results['local_comparison'] = test_local_comparison_endpoint()
    test_results['generate_overlay_pdf'] = test_generate_overlay_pdf_endpoint()
    
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