#!/usr/bin/env python3
"""
TalkingCut Transcription Engine
================================

This module provides word-level transcription using WhisperX, with:
- Hardware acceleration (MPS for Apple Silicon, CUDA for Nvidia)
- Silero VAD for silence detection
- Linguistic heuristics for filler word detection
- Structured JSON output compatible with the frontend WordSegment interface
"""

import argparse
import json
import os
import sys
import uuid
from pathlib import Path
from typing import Literal

import torch
import whisperx
from silero_vad import load_silero_vad, get_speech_timestamps, read_audio

# ============================================================================
# Configuration
# ============================================================================

# Filler words for different languages
FILLER_WORDS = {
    "en": {
        "uh", "um", "like", "you know", "basically", "actually", "literally",
        "so", "yeah", "right", "i mean", "kind of", "sort of", "well"
    },
    "zh": {
        "那个", "就是", "然后", "呃", "嗯", "这个", "什么", "对", "就",
        "其实", "反正", "所以", "但是", "可能", "应该"
    }
}

# Minimum silence duration to mark as SILENCE segment (in seconds)
MIN_SILENCE_DURATION = 0.5

# Device detection
def get_device() -> str:
    """Detect the best available device for inference."""
    if torch.backends.mps.is_available():
        return "mps"
    elif torch.cuda.is_available():
        return "cuda"
    return "cpu"

def get_compute_type(device: str) -> str:
    """Get appropriate compute type for the device."""
    if device == "cuda":
        return "float16"
    elif device == "mps":
        # MPS works best with float32 for stability
        return "float32"
    return "int8"


# ============================================================================
# Filler Word Detection
# ============================================================================

def is_filler_word(text: str, language: str = "en") -> bool:
    """Check if a word/phrase is a filler word."""
    cleaned = text.lower().strip()
    
    # Check in the appropriate language dictionary
    if language.startswith("zh"):
        return cleaned in FILLER_WORDS.get("zh", set())
    else:
        return cleaned in FILLER_WORDS.get("en", set())


# ============================================================================
# VAD-based Silence Detection
# ============================================================================

def detect_silences(audio_path: str, min_duration: float = MIN_SILENCE_DURATION) -> list[dict]:
    """
    Detect silence gaps in audio using Silero VAD.
    
    Returns a list of silence segments with start/end times.
    """
    model = load_silero_vad()
    wav = read_audio(audio_path)
    
    # Get speech timestamps
    speech_timestamps = get_speech_timestamps(
        wav,
        model,
        sampling_rate=16000,
        threshold=0.5,
        min_speech_duration_ms=250,
        min_silence_duration_ms=int(min_duration * 1000)
    )
    
    silences = []
    prev_end = 0.0
    
    for ts in speech_timestamps:
        start_sec = ts["start"] / 16000
        end_sec = ts["end"] / 16000
        
        # Gap before this speech segment
        if start_sec - prev_end >= min_duration:
            silences.append({
                "start": prev_end,
                "end": start_sec
            })
        prev_end = end_sec
    
    return silences


# ============================================================================
# Transcription
# ============================================================================

def transcribe_audio(
    audio_path: str,
    model_size: str = "base",
    language: str | None = None,
    device: str | None = None,
    batch_size: int = 16
) -> list[dict]:
    """
    Transcribe audio file using WhisperX with word-level alignment.
    
    Args:
        audio_path: Path to the audio/video file
        model_size: Whisper model size (tiny, base, small, medium, large-v3)
        language: Language code (e.g., 'en', 'zh') or None for auto-detect
        device: Device to use (mps, cuda, cpu) or None for auto-detect
        batch_size: Batch size for inference
    
    Returns:
        List of word segments with timing and type information
    """
    # Setup device
    if device is None:
        device = get_device()
    compute_type = get_compute_type(device)
    
    print(f"[TalkingCut] Using device: {device} with compute_type: {compute_type}")
    print(f"[TalkingCut] Loading model: {model_size}")
    
    # Load WhisperX model
    model = whisperx.load_model(
        model_size,
        device=device,
        compute_type=compute_type,
        language=language
    )
    
    # Load audio
    print(f"[TalkingCut] Loading audio: {audio_path}")
    audio = whisperx.load_audio(audio_path)
    
    # Transcribe
    print("[TalkingCut] Transcribing...")
    result = model.transcribe(audio, batch_size=batch_size)
    
    # Detect language if not specified
    detected_language = result.get("language", language or "en")
    print(f"[TalkingCut] Detected language: {detected_language}")
    
    # Load alignment model
    print("[TalkingCut] Loading alignment model...")
    model_a, metadata = whisperx.load_align_model(
        language_code=detected_language,
        device=device
    )
    
    # Align
    print("[TalkingCut] Aligning words...")
    aligned = whisperx.align(
        result["segments"],
        model_a,
        metadata,
        audio,
        device,
        return_char_alignments=False
    )
    
    # Process segments
    segments = []
    
    for segment in aligned.get("segments", []):
        for word_info in segment.get("words", []):
            word_text = word_info.get("word", "").strip()
            if not word_text:
                continue
            
            # Determine word type
            word_type: Literal["word", "filler", "silence"] = "word"
            if is_filler_word(word_text, detected_language):
                word_type = "filler"
            
            segments.append({
                "id": str(uuid.uuid4()),
                "text": word_text,
                "start": round(word_info.get("start", 0), 3),
                "end": round(word_info.get("end", 0), 3),
                "confidence": round(word_info.get("score", 0.0), 3),
                "type": word_type,
                "deleted": False
            })
    
    # Add silence segments
    print("[TalkingCut] Detecting silences...")
    silences = detect_silences(audio_path)
    
    for silence in silences:
        segments.append({
            "id": str(uuid.uuid4()),
            "text": "[静音]",
            "start": round(silence["start"], 3),
            "end": round(silence["end"], 3),
            "confidence": 1.0,
            "type": "silence",
            "deleted": False
        })
    
    # Sort all segments by start time
    segments.sort(key=lambda x: x["start"])
    
    print(f"[TalkingCut] Found {len(segments)} segments")
    return segments


# ============================================================================
# Main Entry Point
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="TalkingCut Transcription Engine",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    parser.add_argument(
        "--input", "-i",
        required=True,
        help="Path to the audio/video file"
    )
    
    parser.add_argument(
        "--output", "-o",
        help="Path to output JSON file (default: stdout)"
    )
    
    parser.add_argument(
        "--model", "-m",
        default="base",
        choices=["tiny", "base", "small", "medium", "large-v3"],
        help="Whisper model size (default: base)"
    )
    
    parser.add_argument(
        "--language", "-l",
        help="Language code (e.g., en, zh). Auto-detect if not specified."
    )
    
    parser.add_argument(
        "--device", "-d",
        choices=["mps", "cuda", "cpu"],
        help="Device to use. Auto-detect if not specified."
    )
    
    parser.add_argument(
        "--batch-size", "-b",
        type=int,
        default=16,
        help="Batch size for inference (default: 16)"
    )
    
    args = parser.parse_args()
    
    # Validate input file
    if not os.path.exists(args.input):
        print(f"Error: Input file not found: {args.input}", file=sys.stderr)
        sys.exit(1)
    
    try:
        # Run transcription
        segments = transcribe_audio(
            audio_path=args.input,
            model_size=args.model,
            language=args.language,
            device=args.device,
            batch_size=args.batch_size
        )
        
        # Output result
        result = {
            "segments": segments,
            "metadata": {
                "model": args.model,
                "input_file": os.path.basename(args.input)
            }
        }
        
        output_json = json.dumps(result, ensure_ascii=False, indent=2)
        
        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(output_json)
            print(f"[TalkingCut] Output written to: {args.output}")
        else:
            print(output_json)
            
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()