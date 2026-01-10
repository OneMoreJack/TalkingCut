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

# Force PyTorch 2.6+ to use the old loading behavior (weights_only=False by default)
# This is necessary for WhisperX/SileroVAD which use omegaconf in their checkpoints
import os
os.environ["TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD"] = "1"

# Selective imports to speed up initial boot feedback
import argparse
import json
import os
import re
import sys
import uuid
from pathlib import Path
from typing import Literal, Any

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
    import torch
    import sys
    
    # NOTE: As of now, WhisperX's underlying faster-whisper/ctransformers 
    # does not reliably support 'mps' (Metal Performance Shaders).
    # We default to 'cpu' on macOS for stability, which is still very fast on Apple Silicon.
    if sys.platform == "darwin":
        return "cpu"
        
    if torch.cuda.is_available():
        return "cuda"
        
    return "cpu"

def get_compute_type(device: str) -> str:
    """Get appropriate compute type for the device."""
    if device == "cuda":
        return "float16"
    # For CPU (including Mac), int8 provides 2-4x speedup with minimal accuracy loss
    return "int8"


def get_optimal_threads() -> int:
    """Get optimal thread count for CPU inference on Mac."""
    import os
    cpu_count = os.cpu_count() or 4
    # Use 80% of cores for transcription, leaving headroom for UI
    return max(1, int(cpu_count * 0.8))

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
    from silero_vad import load_silero_vad, get_speech_timestamps, read_audio
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
    batch_size: int = 16,
    break_gap: float = 1.0
) -> list[dict]:
    """
    Transcribe audio file using WhisperX with word-level alignment.
    
    Args:
        audio_path: Path to the audio/video file
        model_size: Whisper model size (tiny, base, small, medium, large-v3)
        language: Language code (e.g., 'en', 'zh') or None for auto-detect
        device: Device to use (mps, cuda, cpu) or None for auto-detect
        batch_size: Batch size for inference
        break_gap: Minimum gap (in seconds) between words to force a line break (default: 1.0)
    
    Returns:
        List of word segments with timing and type information
    """
    # Setup device and performance settings
    import torch
    import whisperx
    import time
    import gc
    
    start_time = time.time()
    
    if device is None:
        device = get_device()
    compute_type = get_compute_type(device)
    threads = get_optimal_threads()
    
    # Set threading via environment variable (more reliable than kwargs)
    os.environ["OMP_NUM_THREADS"] = str(threads)
    os.environ["MKL_NUM_THREADS"] = str(threads)
    
    print(f"[TalkingCut] Using device: {device} with compute_type: {compute_type}")
    print(f"[TalkingCut] CPU threads: {threads}")
    print(f"[TalkingCut] Loading model: {model_size}")
    
    # Load WhisperX model with optimizations
    model = whisperx.load_model(
        model_size,
        device=device,
        compute_type=compute_type,
        language=language
    )
    
    load_time = time.time() - start_time
    print(f"[TalkingCut] Model loaded in {load_time:.2f}s")
    
    # Load audio
    print(f"[TalkingCut] Loading audio: {audio_path}")
    audio = whisperx.load_audio(audio_path)
    
    # Transcribe with performance tracking
    print("[TalkingCut] Transcribing...")
    transcribe_start = time.time()
    result = model.transcribe(audio, batch_size=batch_size)
    transcribe_time = time.time() - transcribe_start
    print(f"[TalkingCut] Transcription completed in {transcribe_time:.2f}s")
    
    # Detect language if not specified
    detected_language = result.get("language", language or "en")
    print(f"[TalkingCut] Detected language: {detected_language}")
    
    # Load alignment model with optimizations
    print("[TalkingCut] Loading alignment model...")
    align_load_start = time.time()
    model_a, metadata = whisperx.load_align_model(
        language_code=detected_language,
        device=device
    )
    print(f"[TalkingCut] Alignment model loaded in {time.time() - align_load_start:.2f}s")
    
    # Align with performance tracking
    print("[TalkingCut] Aligning words...")
    align_start = time.time()
    aligned = whisperx.align(
        result["segments"],
        model_a,
        metadata,
        audio,
        device,
        return_char_alignments=False
    )
    align_time = time.time() - align_start
    print(f"[TalkingCut] Alignment completed in {align_time:.2f}s")
    
    # Process segments - first pass: collect all word segments
    word_segments = []
    
    for segment in aligned.get("segments", []):
        segment_id = segment.get("id", str(uuid.uuid4()))
        words = segment.get("words", [])
        
        for i, word_info in enumerate(words):
            word_text = word_info.get("word", "").strip()
            if not word_text:
                continue
            
            # Determine word type
            word_type: Literal["word", "filler", "silence"] = "word"
            if is_filler_word(word_text, detected_language):
                word_type = "filler"
            
            # Check if ends with punctuation (for semantic protection)
            ends_with_punctuation = bool(re.search(r'[。？！.?!]$', word_text))
            
            word_segments.append({
                "id": str(uuid.uuid4()),
                "text": word_text,
                "start": round(word_info.get("start", 0), 3),
                "end": round(word_info.get("end", 0), 3),
                "confidence": round(word_info.get("score", 0.0), 3),
                "type": word_type,
                "deleted": False,
                "segmentId": str(segment_id),
                "endsWithPunctuation": ends_with_punctuation,
                # Language info for frontend
                "language": detected_language
            })
    
    # Second pass: calculate gap-based isLastInSegment and hasTrailingSpace
    for i, word in enumerate(word_segments):
        is_last = False
        has_trailing_space = False
        
        # Check if this is the last word overall
        if i == len(word_segments) - 1:
            is_last = True
        else:
            next_word = word_segments[i + 1]
            gap = next_word["start"] - word["end"]
            
            # Gap-based break (using break_gap parameter)
            if gap >= break_gap:
                is_last = True
            
            # Semantic protection: always break after sentence-ending punctuation
            if word["endsWithPunctuation"]:
                is_last = True
            
            # Trailing space for English (add space unless it's the last word in sentence)
            if detected_language == "en" and not is_last:
                has_trailing_space = True
        
        word["isLastInSegment"] = is_last
        word["hasTrailingSpace"] = has_trailing_space
        # Remove temporary field
        del word["endsWithPunctuation"]
    
    # Add silence segments with duration info
    print("[TalkingCut] Detecting silences...")
    silences = detect_silences(audio_path)
    
    segments = word_segments.copy()
    
    for silence in silences:
        duration = round(silence["end"] - silence["start"], 1)
        segments.append({
            "id": str(uuid.uuid4()),
            "text": f"[{duration}s]",
            "start": round(silence["start"], 3),
            "end": round(silence["end"], 3),
            "confidence": 1.0,
            "type": "silence",
            "deleted": False,
            "duration": duration,
            "isLastInSegment": duration >= break_gap,  # Break after long silences
            "hasTrailingSpace": False
        })
    
    # Sort all segments by start time
    segments.sort(key=lambda x: x["start"])
    
    # Cleanup models to free memory
    del model
    del model_a
    gc.collect()
    if device == "cuda":
        torch.cuda.empty_cache()
    
    total_time = time.time() - start_time
    audio_duration = len(audio) / 16000  # 16kHz sample rate
    rtf = total_time / audio_duration if audio_duration > 0 else 0
    
    print(f"[TalkingCut] Found {len(segments)} segments")
    print(f"[TalkingCut] Total processing time: {total_time:.2f}s")
    print(f"[TalkingCut] Real-time factor (RTF): {rtf:.2f}x")
    print(f"[TalkingCut] Audio duration: {audio_duration:.2f}s")
    
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
    
    parser.add_argument(
        "--break-gap",
        type=float,
        default=1.0,
        help="Minimum gap (in seconds) between words to force a line break (default: 1.0)"
    )
    
    args = parser.parse_args()
    
    print("[TalkingCut] Python engine started")
    print("[TalkingCut] Loading AI libraries...")
    
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
            batch_size=args.batch_size,
            break_gap=args.break_gap
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