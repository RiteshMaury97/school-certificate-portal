# Static translations

Public UI strings live in `src/i18n/messages/en.json`. Supported locale catalogs are `hi`, `bn`, `mr`, `gu`, `pa`, `ta`, `te`, and `ur`. The app loads only the selected non-English JSON chunk; English is part of the initial bundle and server-rendered HTML. The preference is stored in browser local storage. No page text is sent to a translation service.

## Generate catalogs

The one-time generator uses the open-source AI4Bharat IndicTrans2 distilled English-to-Indic model (`ai4bharat/indictrans2-en-indic-dist-200M`, MIT licence). It downloads the model the first time, so run it in Google Colab or on a computer with Python and internet access. In Colab, upload or clone this project, then run:

```bash
pip install torch transformers sentencepiece IndicTransToolkit
python scripts/i18n/generate-translations.py
```

For CPU-only local generation, install a CPU build of PyTorch first; generation will be slower. The model files are cached by Hugging Face after the first run. See the [AI4Bharat IndicTrans2 project](https://github.com/AI4Bharat/IndicTrans2) and [distilled model card](https://huggingface.co/ai4bharat/indictrans2-en-indic-dist-200M).

**A fluent speaker must review every generated catalog before release**, especially privacy notices, data rights, terms, student/certificate terminology, form instructions, and error messages. The generated `_meta.needsHumanReview` field is deliberately true until that review is complete. Machine output is not legal advice.

## Add a language

1. Add the language code and display name in `src/i18n/locale-provider.tsx` and its IndicTrans2 target code in the generator.
2. Add the same grouped keys as `en.json` in a new `src/i18n/messages/<code>.json`.
3. Add the dynamic import to `localeLoaders`, then run the i18n catalog test and review the translated strings with a fluent speaker.

Placeholders like `{name}`, URLs, email addresses, and certificate identifiers are masked during generation and restored unchanged.
