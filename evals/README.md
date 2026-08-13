# Feedback eval

This eval sends rows sequentially to BaseTen's model API:

- Model: `deepseek-ai/DeepSeek-V4-Flash-0731`
- Endpoint: `https://inference.baseten.co/v1/chat/completions`
- Temperature: `0`
- Maximum output: `4096` tokens
- Delay between requests: `5` seconds
- Reasoning: off
- Provider: BaseTen directly

## Why this route

BaseTen is used directly for the current experiment. Its listed price on
2026-08-13 was $0.13/M input tokens, $0.028/M cached input tokens, and $0.26/M
output tokens. BaseTen documents native Structured Outputs for its model APIs.

Features and prices can change. Recheck the
[BaseTen model page](https://www.baseten.co/library/deepseek-v4-flash-0731/)
before treating this choice as permanent.

## Run

```sh
export BASETEN_API_KEY="..."
python3 evals/run_openrouter_models.py --dry-run
python3 evals/run_openrouter_models.py
```

Use `--limit 10` for the first 10 CSV rows, or repeat `--row-id ID` to run exact
rows. There is no sampling, concurrency, repeat mode, fallback, or resume mode.
Requests start at least five seconds apart. A network error or HTTP 429 is retried
once. Other failures are recorded once.

The runner checks only what it needs: required columns, unique nonempty IDs,
nonempty prompts and feedback, and expected categories 1–4. It never repairs,
drops, or reorders data.

Each run writes:

- `metadata.json`: exact prompt, schema, model, provider, rows, and settings.
- `responses.jsonl`: raw output, parsed output, provider, finish reason, error,
  timing, and all useful token counts.
- `results.csv`: the same response data in a flat table.

Score a run with:

```sh
python3 evals/score_results.py evals/results/run_TIMESTAMP
```

This writes validity, accuracy, macro F1, a 4x4 confusion matrix, and a
disagreements CSV. Invalid responses count as incorrect and as false negatives
for macro F1.

## Structured output settings

`response_format.type = "json_schema"` asks for the declared object instead of
generic JSON. `strict = true` asks BaseTen to enforce that schema exactly; with
`false`, the schema is guidance and a valid-looking response may still violate
it. There is no provider router or fallback because BaseTen is called directly.

The schema uses `minLength: 1`, so `""` is not an allowed category-2 rewrite.
The runner also enforces the category/rewrite relationship without repairing a
bad response.

BaseTen caching is automatic. The shared prompt is small enough that caching may
not help, but `cached_tokens` and `cache_write_tokens` are logged when returned.

## Live sanity checks

```sh
python3 evals/test_openrouter_sanity.py
```

These checks use the eval's exact schema. They cover a normal response, a
conflicting `BANANA` instruction that must return category 3, minimal input,
categories 1–4, a nonempty category-2 rewrite, one repeated identical request,
and rejection of a deliberately invalid schema. Results
are written to one JSONL log. One check sends the same request twice to detect
unexpected provider or output changes. Dataset rows are evaluated only once.
If the invalid schema is accepted, the log keeps the exact schema, output,
provider, finish reason, usage, and complete BaseTen response for diagnosis.
