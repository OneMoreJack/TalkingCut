#!/usr/bin/env python3
"""
Debug script to examine raw WhisperX output
"""

import os
os.environ["TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD"] = "1"

import sys
import json
import whisperx

# Import our merge function
sys.path.insert(0, os.path.dirname(__file__))
from transcribe import reconstruct_words_from_text

def debug_transcribe(audio_path: str, model_size: str = "base"):
    """Debug transcription to see raw output."""
    
    print(f"[DEBUG] Loading model: {model_size}")
    model = whisperx.load_model(model_size, device="cpu", compute_type="int8")
    
    print(f"[DEBUG] Loading audio: {audio_path}")
    audio = whisperx.load_audio(audio_path)
    
    print("[DEBUG] Transcribing...")
    result = model.transcribe(audio, batch_size=16)
    
    detected_language = result.get("language", "en")
    print(f"[DEBUG] Detected language: {detected_language}")
    
    print("\n" + "="*60)
    print("RAW TRANSCRIPTION SEGMENTS (before alignment)")
    print("="*60)
    for i, seg in enumerate(result.get("segments", [])[:5]):  # First 5 segments
        print(f"\n--- Segment {i} ---")
        print(f"  text: {seg.get('text', '')}")
        print(f"  start: {seg.get('start', 0):.2f}s")
        print(f"  end: {seg.get('end', 0):.2f}s")
    
    # Load alignment model
    print("\n[DEBUG] Loading alignment model...")
    model_a, metadata = whisperx.load_align_model(
        language_code=detected_language,
        device="cpu"
    )
    
    print("[DEBUG] Aligning...")
    aligned = whisperx.align(
        result["segments"],
        model_a,
        metadata,
        audio,
        "cpu",
        return_char_alignments=False
    )
    
    print("\n" + "="*60)
    print("ALIGNED SEGMENTS (with word-level timing)")
    print("="*60)
    for i, seg in enumerate(aligned.get("segments", [])[:3]):  # First 3 segments
        print(f"\n--- Segment {i} ---")
        print(f"  text: {seg.get('text', '')[:80]}...")
        words = seg.get("words", [])
        print(f"  word count (raw): {len(words)}")
        print("  first 10 words (raw):")
        for j, w in enumerate(words[:10]):
            print(f"    [{j}] '{w.get('word', '')}' ({w.get('start', 0):.2f}-{w.get('end', 0):.2f}s)")
    
    # Now reconstruct words using original text
    print("\n" + "="*60)
    print("AFTER RECONSTRUCT_WORDS_FROM_TEXT")
    print("="*60)
    for i, seg in enumerate(aligned.get("segments", [])[:3]):
        words = seg.get("words", [])
        original_text = seg.get("text", "")
        merged = reconstruct_words_from_text(words, original_text)
        print(f"\n--- Segment {i} ---")
        print(f"  word count (merged): {len(merged)} (was {len(words)})")
        print("  first 20 words (merged):")
        for j, w in enumerate(merged[:20]):
            print(f"    [{j}] '{w.get('word', '')}' ({w.get('start', 0):.2f}-{w.get('end', 0):.2f}s)")
    
    print("\n✅ Reconstruction complete!")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python debug_whisperx.py <video_or_audio_path> [model_size]")
        sys.exit(1)
    
    audio_path = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else "base"
    
    debug_transcribe(audio_path, model_size)
