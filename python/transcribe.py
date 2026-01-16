#!/usr/bin/env python3
"""
TalkingCut Transcription Engine
================================

This module provides word-level transcription using WhisperX, with:
- Hardware acceleration (MPS for Apple Silicon, CUDA for Nvidia)
- Word-gap-based silence detection (derived from WhisperX alignment)
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

# Punctuation configuration for different languages
# Organized by category for easy maintenance and extension
PUNCTUATION_CONFIG = {
    # English punctuation
    "en": {
        # Sentence-ending punctuation
        "terminal": ".!?",
        # Pairing punctuation (quotes, brackets)
        "pairing": "\"'()[]{}<>",
        # Separating punctuation
        "separating": ",;:-–—/\\",
        # Special symbols
        "special": "@#$%^&*_+=|~`",
    },
    # Chinese punctuation
    "zh": {
        # Sentence-ending punctuation
        "terminal": "。！？",
        # Pairing punctuation (quotes, brackets)
        "pairing": '""''（）【】《》「」『』〈〉',
        # Separating punctuation  
        "separating": "，、；：—…·",
        # Special (less common)
        "special": "～￥",
    },
    # Japanese punctuation (for future extension)
    "ja": {
        "terminal": "。！？",
        "pairing": "「」『』（）【】",
        "separating": "、，：；",
        "special": "〜・",
    },
}

def get_all_punctuation() -> set:
    """Get all punctuation characters from all languages."""
    all_punct = set()
    for lang_config in PUNCTUATION_CONFIG.values():
        for category_chars in lang_config.values():
            all_punct.update(category_chars)
    return all_punct

# Pre-compute for performance
ALL_PUNCTUATION = get_all_punctuation()

# Default minimum silence duration to mark as SILENCE segment (in seconds)
# This is now a parameter, kept here for reference
DEFAULT_MIN_SILENCE_DURATION = 0.5

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


def is_latin_text(text: str) -> bool:
    """
    Check if text contains only Latin characters (no CJK).
    Used for determining word spacing in mixed-language transcripts.
    """
    # Remove punctuation for check
    cleaned = re.sub(r'[^\w]', '', text)
    if not cleaned:
        return False
    # Check if any CJK characters present
    return not bool(re.search(r'[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]', cleaned))


def is_single_latin_char(text: str) -> bool:
    """Check if text is a single Latin character (letter only, no punctuation)."""
    return len(text) == 1 and text.isalpha() and ord(text) < 128

def is_punctuation(c: str) -> bool:
    """Check if character is punctuation (supports multiple languages)."""
    return c in ALL_PUNCTUATION


def tokenize_mixed_text(text: str) -> list[str]:
    """
    Tokenize mixed CJK/Latin text by splitting on:
    1. Whitespace
    2. CJK/Latin character boundaries
    3. Case transitions in Latin text (e.g., 'lightI' -> ['light', 'I'])
    4. Punctuation boundaries (consecutive punctuation grouped together)
    
    Returns a list of tokens (individual CJK chars, Latin words, or punctuation groups).
    """
    import re
    
    tokens = []
    current_token = ""
    prev_type = None  # 'cjk', 'latin_lower', 'latin_upper', 'punct', 'other'
    
    def get_char_type(c: str) -> str:
        if re.match(r'[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]', c):
            return 'cjk'
        elif c.isupper() and c.isalpha():
            return 'latin_upper'
        elif c.islower() and c.isalpha():
            return 'latin_lower' 
        elif c.isspace():
            return 'space'
        elif is_punctuation(c):
            return 'punct'
        else:
            return 'other'
    
    for c in text:
        char_type = get_char_type(c)
        
        if char_type == 'space':
            # Finish current token
            if current_token:
                tokens.append(current_token)
                current_token = ""
            prev_type = None
            continue
        
        if char_type == 'cjk':
            # Each CJK character is its own token
            if current_token:
                tokens.append(current_token)
                current_token = ""
            tokens.append(c)
            prev_type = 'cjk'
        elif char_type in ('latin_lower', 'latin_upper'):
            # Check for word boundary
            if prev_type == 'cjk' or prev_type == 'punct':
                # Transition from CJK/punct to Latin - start new token
                if current_token:
                    tokens.append(current_token)
                current_token = c
            elif prev_type == 'latin_lower' and char_type == 'latin_upper':
                # Lowercase to uppercase transition (e.g., 'lightI')
                if current_token:
                    tokens.append(current_token)
                current_token = c
            else:
                current_token += c
            prev_type = char_type
        elif char_type == 'punct':
            # Group consecutive punctuation together (e.g., '...' or '?!')
            if prev_type == 'punct':
                # Same type, append to current
                current_token += c
            else:
                # Different type, start new token
                if current_token:
                    tokens.append(current_token)
                current_token = c
            prev_type = 'punct'
        else:
            # Other characters (numbers, etc.)
            if prev_type == 'cjk':
                if current_token:
                    tokens.append(current_token)
                    current_token = ""
                tokens.append(c)
            elif prev_type == 'punct':
                if current_token:
                    tokens.append(current_token)
                current_token = c
            elif current_token:
                current_token += c
            else:
                current_token = c
            prev_type = 'other'
    
    # Don't forget the last token
    if current_token:
        tokens.append(current_token)
    
    return tokens


def reconstruct_words_from_text(words: list[dict], original_text: str) -> list[dict]:
    """
    Reconstruct proper English words using the original segment text as reference.
    
    WhisperX's Chinese alignment model splits English words into individual
    characters. This function uses the original transcription text to reconstruct
    words by:
    1. Smart tokenization that handles CJK/Latin boundaries
    2. Matching aligned characters to tokens
    3. Creating merged word entries with proper timing
    
    Args:
        words: List of word dicts from WhisperX alignment (character-level)
        original_text: Original segment text from Whisper
    
    Returns:
        List of word dicts with proper word boundaries
    """
    if not words or not original_text:
        return words
    
    import re
    
    # Smart tokenization that handles mixed text
    tokens = tokenize_mixed_text(original_text)
    
    result = []
    word_idx = 0  # Index in the aligned words array
    
    for token in tokens:
        if word_idx >= len(words):
            break
        
        # Check if this token is a CJK character
        is_cjk_char = len(token) == 1 and bool(re.match(r'[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]', token))
        
        if is_cjk_char:
            # For CJK, match single character
            current_word = words[word_idx]
            current_text = current_word.get("word", "").strip()
            
            if current_text == token:
                result.append(current_word)
                word_idx += 1
            elif len(current_text) == 1:
                # Mismatch but still single char, add it
                result.append(current_word)
                word_idx += 1
        elif token.isalpha():
            # Latin word - collect characters
            collected_chars = []
            start_time = None
            end_time = None
            total_score = 0
            char_count = 0
            
            target_chars = token.lower()
            collected_lower = ""
            
            while word_idx < len(words) and len(collected_lower) < len(target_chars):
                current_word = words[word_idx]
                current_text = current_word.get("word", "").strip()
                
                if is_single_latin_char(current_text):
                    collected_chars.append(current_text)
                    collected_lower += current_text.lower()
                    
                    if start_time is None:
                        start_time = current_word.get("start", 0)
                    end_time = current_word.get("end", 0)
                    total_score += current_word.get("score", 0)
                    char_count += 1
                    word_idx += 1
                else:
                    # Not a single Latin char, stop collecting
                    break
            
            # Create merged word
            if collected_chars:
                result.append({
                    "word": "".join(collected_chars),
                    "start": start_time or 0,
                    "end": end_time or 0,
                    "score": total_score / char_count if char_count > 0 else 0
                })
        else:
            # Punctuation group (e.g., '...') - collect matching punctuation marks
            if all(is_punctuation(c) for c in token):
                # Collect consecutive punctuation marks
                collected_punct = []
                start_time = None
                end_time = None
                
                for expected_char in token:
                    if word_idx >= len(words):
                        break
                    current_word = words[word_idx]
                    current_text = current_word.get("word", "").strip()
                    
                    if current_text == expected_char or is_punctuation(current_text):
                        collected_punct.append(current_text)
                        if start_time is None:
                            start_time = current_word.get("start", 0)
                        end_time = current_word.get("end", 0)
                        word_idx += 1
                
                if collected_punct:
                    result.append({
                        "word": "".join(collected_punct),
                        "start": start_time or 0,
                        "end": end_time or 0,
                        "score": 1.0
                    })
            else:
                # Other tokens - try to match or skip
                current_word = words[word_idx]
                current_text = current_word.get("word", "").strip()
                
                if current_text == token or (len(token) == 1 and len(current_text) == 1):
                    result.append(current_word)
                    word_idx += 1
    
    # Add any remaining words
    while word_idx < len(words):
        result.append(words[word_idx])
        word_idx += 1
    
    return result


def merge_latin_characters(words: list[dict], max_gap: float = 0.3) -> list[dict]:
    """
    Simple fallback: merge consecutive single Latin characters based on time gaps.
    This is used when we don't have the original text available.
    """
    if not words:
        return words
    
    merged = []
    i = 0
    
    while i < len(words):
        word = words[i]
        word_text = word.get("word", "").strip()
        
        # If not a single Latin character, add as-is
        if not is_single_latin_char(word_text):
            merged.append(word)
            i += 1
            continue
        
        # Start collecting Latin characters
        collected_chars = [word_text]
        start_time = word.get("start", 0)
        end_time = word.get("end", 0)
        total_score = word.get("score", 0)
        char_count = 1
        
        # Look ahead and collect more characters
        j = i + 1
        while j < len(words):
            next_word = words[j]
            next_text = next_word.get("word", "").strip()
            next_start = next_word.get("start", 0)
            
            # Check if next is also a single Latin character
            if not is_single_latin_char(next_text):
                break
            
            # Check time gap - if too large, it's a new word
            gap = next_start - end_time
            if gap > max_gap:
                break
            
            # Add to current word
            collected_chars.append(next_text)
            end_time = next_word.get("end", 0)
            total_score += next_word.get("score", 0)
            char_count += 1
            j += 1
        
        # Create merged word
        merged_text = "".join(collected_chars)
        merged.append({
            "word": merged_text,
            "start": start_time,
            "end": end_time,
            "score": total_score / char_count if char_count > 0 else 0
        })
        
        i = j
    
    return merged


# ============================================================================
# Word-Gap-based Silence Detection
# ============================================================================

# NOTE: The previous Silero VAD-based detect_silences function has been removed.
# Silence detection is now integrated directly into transcribe_audio() using
# WhisperX word-level alignment timestamps. This eliminates timing offset issues
# caused by using two independent audio analysis systems.


# ============================================================================
# Transcription
# ============================================================================

def transcribe_audio(
    audio_path: str,
    model_size: str = "base",
    language: str | None = None,
    device: str | None = None,
    batch_size: int = 16,
    silence_threshold: float = 1.0,
    min_silence_duration: float = 0.5
) -> list[dict]:
    """
    Transcribe audio file using WhisperX with word-level alignment.
    
    Args:
        audio_path: Path to the audio/video file
        model_size: Whisper model size (tiny, base, small, medium, large-v3)
        language: Language code (e.g., 'en', 'zh') or None for auto-detect
        device: Device to use (mps, cuda, cpu) or None for auto-detect
        batch_size: Batch size for inference
        min_silence_duration: Minimum gap (in seconds) to mark as SILENCE segment (default: 0.5)
    
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
    
    # Post-process: reconstruct English words using original text as reference
    # This fixes WhisperX Chinese alignment splitting English into characters
    print("[TalkingCut] Reconstructing word boundaries...")
    for segment in aligned.get("segments", []):
        if "words" in segment:
            original_text = segment.get("text", "")
            segment["words"] = reconstruct_words_from_text(segment["words"], original_text)

    
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

    
    # Second pass: calculate temporary properties for cleanup later
    for i, word in enumerate(word_segments):
        # We will calculate is_last and has_trailing_space in a final merged pass
        pass
    
    # ===== Generate silence segments based on word gaps (no VAD) =====
    print("[TalkingCut] Detecting silences from word gaps...")
    import librosa
    
    silence_segments = []
    
    # 1. Detect opening silence (video start to first word)
    if word_segments:
        first_word_start = word_segments[0]["start"]
        if first_word_start >= min_silence_duration:
            duration = round(first_word_start, 1)
            silence_segments.append({
                "id": str(uuid.uuid4()),
                "text": f"[...{duration}s]",
                "start": 0.0,
                "end": round(first_word_start, 3),
                "confidence": 1.0,
                "type": "silence",
                "deleted": False,
                "duration": duration,
                "isLastInSegment": True,  # Silence causes line break
                "hasTrailingSpace": False
            })
    
    # 2. Detect inter-word silences (gaps between consecutive words)
    for i in range(len(word_segments) - 1):
        current_word = word_segments[i]
        next_word = word_segments[i + 1]
        
        # Calculate precise word gap
        gap = next_word["start"] - current_word["end"]
        
        # Only mark gaps that meet threshold
        if gap >= min_silence_duration:
            duration = round(gap, 1)
            silence_segments.append({
                "id": str(uuid.uuid4()),
                "text": f"[...{duration}s]",
                "start": round(current_word["end"], 3),
                "end": round(next_word["start"], 3),
                "confidence": 1.0,
                "type": "silence",
                "deleted": False,
                "duration": duration,
                "isLastInSegment": bool(gap >= silence_threshold),  # Silence causes line break if above threshold
                "hasTrailingSpace": False
            })
    
    # 3. Detect trailing silence (last word to audio end)
    if word_segments:
        audio_duration_total = librosa.get_duration(path=audio_path)
        last_word_end = word_segments[-1]["end"]
        trailing_silence = audio_duration_total - last_word_end
        
        if trailing_silence >= min_silence_duration:
            duration = round(trailing_silence, 1)
            silence_segments.append({
                "id": str(uuid.uuid4()),
                "text": f"[...{duration}s]",
                "start": round(last_word_end, 3),
                "end": round(audio_duration_total, 3),
                "confidence": 1.0,
                "type": "silence",
                "deleted": False,
                "duration": duration,
                "isLastInSegment": True,
                "hasTrailingSpace": False
            })
    
    # Merge and sort all segments by start time
    all_segments = word_segments + silence_segments
    all_segments.sort(key=lambda x: x["start"])

    # Final pass: Determine line breaks and trailing spaces
    for i in range(len(all_segments)):
        seg = all_segments[i]
        is_last = False
        has_trailing_space = False
        
        is_final_seg = (i == len(all_segments) - 1)
        next_seg = None if is_final_seg else all_segments[i+1]
        
        if seg["type"] == "silence":
            # Silence breaks if above threshold OR if it's the very last segment
            if seg["duration"] >= silence_threshold or is_final_seg:
                is_last = True
        else:
            # It's a word
            if is_final_seg:
                is_last = True
            else:
                # Break if punctuation, but NOT if next is silence (silence will handle the break for us)
                if seg.get("endsWithPunctuation") and (next_seg is None or next_seg["type"] != "silence"):
                    is_last = True
                
                # Trailing space for Latin words if not breaking
                if not is_last and is_latin_text(seg["text"]):
                    has_trailing_space = True
            
            # Clean up temporary field
            if "endsWithPunctuation" in seg:
                del seg["endsWithPunctuation"]
        
        seg["isLastInSegment"] = is_last
        seg["hasTrailingSpace"] = has_trailing_space

    segments = all_segments
    
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
    print(f"[TalkingCut] - Words: {len(word_segments)}")
    print(f"[TalkingCut] - Silences: {len(silence_segments)}")
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
        "--min-silence",
        type=float,
        default=0.5,
        help="Minimum silence duration (in seconds) to mark as SILENCE segment (default: 0.5)"
    )

    parser.add_argument(
        "--offline",
        action="store_true",
        help="Force offline mode (disable HF online checks)"
    )

    parser.add_argument(
        "--mirror",
        help="Hugging Face mirror URL (e.g. https://hf-mirror.com)"
    )
    
    args = parser.parse_args()
    
    print("[TalkingCut] Python engine started")
    
    # Handle network configuration
    if args.mirror:
        print(f"[TalkingCut] Setting HF_ENDPOINT to: {args.mirror}")
        os.environ["HF_ENDPOINT"] = args.mirror

    if args.offline:
        print("[TalkingCut] Forcing offline mode (HF_HUB_OFFLINE=1)")
        os.environ["HF_HUB_OFFLINE"] = "1"
        os.environ["TRANSFORMERS_OFFLINE"] = "1"

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
            silence_threshold=args.min_silence, # Re-using min-silence arg for silence_threshold in CLI for now, or I should rename it.
            min_silence_duration=0.5
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