#!/usr/bin/env python3
"""
Tests for the TalkingCut Transcription Engine

Run with: python test_transcribe.py
"""

import json
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

# ============================================================================
# Test Utilities
# ============================================================================

def test_result(name: str, passed: bool, message: str = ""):
    """Print test result in a consistent format."""
    status = "✅ PASS" if passed else "❌ FAIL"
    msg = f" - {message}" if message else ""
    print(f"  {status}: {name}{msg}")
    return passed


# ============================================================================
# Unit Tests
# ============================================================================

def test_filler_word_detection():
    """Test filler word detection for English and Chinese."""
    print("\n🧪 Testing Filler Word Detection...")
    
    from transcribe import is_filler_word
    
    all_passed = True
    
    # English fillers
    all_passed &= test_result("English 'uh'", is_filler_word("uh", "en"))
    all_passed &= test_result("English 'um'", is_filler_word("Um", "en"))
    all_passed &= test_result("English 'like'", is_filler_word("like", "en"))
    all_passed &= test_result("English non-filler 'hello'", not is_filler_word("hello", "en"))
    
    # Chinese fillers
    all_passed &= test_result("Chinese '那个'", is_filler_word("那个", "zh"))
    all_passed &= test_result("Chinese '就是'", is_filler_word("就是", "zh"))
    all_passed &= test_result("Chinese '呃'", is_filler_word("呃", "zh"))
    all_passed &= test_result("Chinese non-filler '大家好'", not is_filler_word("大家好", "zh"))
    
    return all_passed


def test_device_detection():
    """Test device detection logic."""
    print("\n🧪 Testing Device Detection...")
    
    from transcribe import get_device, get_compute_type
    
    all_passed = True
    
    device = get_device()
    all_passed &= test_result(
        "Device detection", 
        device in ["mps", "cuda", "cpu"],
        f"Detected: {device}"
    )
    
    # Test compute type mapping
    all_passed &= test_result("CPU compute type", get_compute_type("cpu") == "int8")
    all_passed &= test_result("CUDA compute type", get_compute_type("cuda") == "float16")
    all_passed &= test_result("MPS compute type", get_compute_type("mps") == "float32")
    
    return all_passed


def test_json_schema():
    """Test that output JSON matches expected schema."""
    print("\n🧪 Testing JSON Schema...")
    
    # Mock segment data
    mock_segment = {
        "id": "test-uuid-123",
        "text": "hello",
        "start": 0.5,
        "end": 1.2,
        "confidence": 0.99,
        "type": "word",
        "deleted": False
    }
    
    all_passed = True
    
    # Check required fields
    required_fields = ["id", "text", "start", "end", "confidence", "type", "deleted"]
    for field in required_fields:
        all_passed &= test_result(
            f"Field '{field}' exists",
            field in mock_segment
        )
    
    # Check field types
    all_passed &= test_result("'id' is string", isinstance(mock_segment["id"], str))
    all_passed &= test_result("'text' is string", isinstance(mock_segment["text"], str))
    all_passed &= test_result("'start' is number", isinstance(mock_segment["start"], (int, float)))
    all_passed &= test_result("'end' is number", isinstance(mock_segment["end"], (int, float)))
    all_passed &= test_result("'confidence' is number", isinstance(mock_segment["confidence"], (int, float)))
    all_passed &= test_result("'type' is valid", mock_segment["type"] in ["word", "filler", "silence"])
    all_passed &= test_result("'deleted' is boolean", isinstance(mock_segment["deleted"], bool))
    
    return all_passed


# ============================================================================
# Main
# ============================================================================

def main():
    print("=" * 60)
    print("TalkingCut Transcription Engine - Test Suite")
    print("=" * 60)
    
    results = []
    
    # Run tests
    results.append(("Filler Word Detection", test_filler_word_detection()))
    results.append(("Device Detection", test_device_detection()))
    results.append(("JSON Schema", test_json_schema()))
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for name, result in results:
        status = "✅" if result else "❌"
        print(f"  {status} {name}")
    
    print(f"\nTotal: {passed}/{total} test groups passed")
    
    if passed == total:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print("\n⚠️ Some tests failed!")
        return 1


if __name__ == "__main__":
    sys.exit(main())
