#!/usr/bin/env python3
"""Run the feedback category eval with TypeSafe Jev (no rewrite generation)."""

from __future__ import annotations

import argparse
import json
import os
import time
import urllib.error
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from run_openrouter_models import (
    CATEGORY_DEFINITIONS, DEFAULT_INPUT, DEFAULT_OUTPUT_DIR, ProviderConfig,
    failed_result, make_log_record, post_request, read_rows, select_rows,
    write_results,
)

PROVIDER = ProviderConfig("TypeSafe", "jev-latest", "https://api.typesafe.ai/v1/systemone",
                          "TYPESAFE_API_KEY", "Bearer")
QUESTION = {
    "type": "choice",
    "instructions": CATEGORY_DEFINITIONS.split("# Writing the rewrite for category 2")[0].strip()
                    + "\nChoose only the category. Do not write or evaluate a rewrite.",
    "criteria": {
        "1": "Acceptable: show unchanged, including specific blunt criticism and praise.",
        "2": "Rewrite: specific usable criticism with a condemning verdict word.",
        "3": "Vague: empty, irrelevant, or off-topic without a harmful attack.",
        "4": "Not Acceptable: identity attack, threat, or contempt with nothing usable.",
    },
}


def build_request(campaign_prompt: str, feedback_text: str) -> dict[str, Any]:
    return {
        "model": PROVIDER.model,
        "state": {"campaign_prompt": campaign_prompt, "feedback_text": feedback_text},
        "questions": {"category": QUESTION},
    }


def parse_answer(response: dict[str, Any]) -> dict[str, Any]:
    answer = response["answers"]["category"]
    usage = response["usage"]
    return {
        "raw_output": json.dumps(answer, ensure_ascii=False),
        "parsed_output": {"category": int(answer["choice"])},
        "valid": True,
        "error": "",
        "provider": PROVIDER.name,
        "generation_id": None,
        "finish_reason": None,
        "native_finish_reason": None,
        "usage": {
            "prompt_tokens": usage["input_tokens"],
            "completion_tokens": usage["output_tokens"],
            "total_tokens": usage["input_tokens"] + usage["output_tokens"],
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    selection = parser.add_mutually_exclusive_group()
    selection.add_argument("--limit", type=int, default=0)
    selection.add_argument("--row-id", action="append")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    rows = select_rows(read_rows(args.input), args.limit, args.row_id)
    print(f"Selected {len(rows)} row(s) for Jev category evaluation")
    if args.dry_run:
        return 0
    api_key = os.environ.get(PROVIDER.api_key_env)
    if not api_key:
        raise RuntimeError(f"Set {PROVIDER.api_key_env} before running the eval.")

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run_directory = args.output_dir / f"jev_{stamp}"
    run_directory.mkdir(parents=True)
    metadata = {
        "started_utc": datetime.now(timezone.utc).isoformat(),
        "input": str(args.input.resolve()),
        "row_ids": [row["id"] for row in rows],
        "model": PROVIDER.model,
        "provider": PROVIDER.name,
        "endpoint": PROVIDER.endpoint,
        "evaluation": "category_only",
        "question": QUESTION,
    }
    (run_directory / "metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    records = []
    fatal_error = None
    with (run_directory / "responses.jsonl").open("w", encoding="utf-8") as log:
        for index, row in enumerate(rows, 1):
            started = time.perf_counter()
            for attempt in (1, 2):
                try:
                    response = post_request(build_request(row["campaign_prompt"], row["text"]),
                                            api_key, PROVIDER)
                    result = parse_answer(response)
                    result["attempts"] = attempt
                    break
                except urllib.error.HTTPError as error:
                    detail = error.read().decode("utf-8", errors="replace")[:1000]
                    if error.code == 429 and attempt == 1:
                        time.sleep(1)
                        continue
                    result = failed_result(f"TypeSafe HTTP {error.code}: {detail}", attempt)
                    if error.code in {400, 401, 402, 403, 404, 422}:
                        fatal_error = result["error"]
                    break
                except (urllib.error.URLError, TimeoutError) as error:
                    if attempt == 1:
                        time.sleep(1)
                        continue
                    result = failed_result(f"TypeSafe network error: {error}", attempt)
                    break
                except (ValueError, TypeError, KeyError) as error:
                    result = failed_result(f"TypeSafe response error: {error}", attempt)
                    break
            result.pop("json_valid", None)
            result["latency_ms"] = round((time.perf_counter() - started) * 1000)
            record = make_log_record(index, row, result, PROVIDER)
            records.append(record)
            log.write(json.dumps(record, ensure_ascii=False) + "\n")
            log.flush()
            print(f"[{index}/{len(rows)}] {row['id']}: {'ok' if result['valid'] else 'failed'}")
            if fatal_error:
                break
    write_results(run_directory / "results.csv", records)
    print(f"Run directory: {run_directory}")
    if fatal_error:
        raise RuntimeError(fatal_error)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
