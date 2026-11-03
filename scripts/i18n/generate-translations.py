#!/usr/bin/env python3
"""Generate static English-to-Indic catalogs with AI4Bharat IndicTrans2."""

import json
import re
from pathlib import Path

from IndicTransToolkit.processor import IndicProcessor
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

ROOT = Path(__file__).resolve().parents[2]
MESSAGES = ROOT / "src" / "i18n" / "messages"
MODEL = "ai4bharat/indictrans2-en-indic-dist-200M"
TARGETS = {
    "hi": "hin_Deva", "bn": "ben_Beng", "mr": "mar_Deva", "gu": "guj_Gujr",
    "pa": "pan_Guru", "ta": "tam_Taml", "te": "tel_Telu", "ur": "urd_Arab",
}
PROTECTED = re.compile(
    r"\{[A-Za-z_][A-Za-z0-9_.-]*\}|https?://[^\s<>]+|"
    r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|"
    r"\b(?=[A-Z0-9/-]{6,}\b)(?=[A-Z0-9/-]*[0-9])[A-Z0-9/-]+\b"
)


def leaves(value, path=()):
    if isinstance(value, dict):
        for key, child in value.items():
            if key != "_meta":
                yield from leaves(child, path + (key,))
    elif isinstance(value, str):
        yield path, value


def set_path(tree, path, value):
    cursor = tree
    for part in path[:-1]:
        cursor = cursor[part]
    cursor[path[-1]] = value


def translate_one(text, processor, tokenizer, model, target):
    markers = {}

    def mask(match):
        marker = f"ZXQPROTECTED{len(markers):04d}XZ"
        markers[marker] = match.group(0)
        return marker

    masked = PROTECTED.sub(mask, text)
    prepared = processor.preprocess_batch([masked], src_lang="eng_Latn", tgt_lang=target)
    inputs = tokenizer(prepared, return_tensors="pt", padding=True, truncation=True)
    inputs = {key: value.to(model.device) for key, value in inputs.items()}
    generated = model.generate(**inputs, num_beams=5, num_return_sequences=1, max_length=256)
    translated = processor.postprocess_batch(tokenizer.batch_decode(generated, skip_special_tokens=True), lang=target)[0]
    for marker, original in markers.items():
        translated = translated.replace(marker, original)
    return translated


def main():
    source = json.loads((MESSAGES / "en.json").read_text(encoding="utf-8"))
    tokenizer = AutoTokenizer.from_pretrained(MODEL, trust_remote_code=True)
    model = AutoModelForSeq2SeqLM.from_pretrained(MODEL, trust_remote_code=True, device_map="auto")
    processor = IndicProcessor(inference=True)
    entries = list(leaves(source))
    for code, model_code in TARGETS.items():
        target = json.loads(json.dumps(source))
        strings = [text for _, text in entries]
        translated = []
        batch_size = 16
        for offset in range(0, len(strings), batch_size):
            translated.extend(
                translate_one(text, processor, tokenizer, model, model_code)
                for text in strings[offset : offset + batch_size]
            )
        for (path, _), value in zip(entries, translated, strict=True):
            set_path(target, path, value)
        target["_meta"] = {
            "language": code,
            "generatedBy": MODEL,
            "needsHumanReview": True,
            "reviewAreas": ["legal/privacy", "certificate terminology"],
        }
        (MESSAGES / f"{code}.json").write_text(
            json.dumps(target, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"Wrote {code}.json ({len(entries)} strings); fluent review required.")


if __name__ == "__main__":
    main()
