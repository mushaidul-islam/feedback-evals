#!/usr/bin/env python3
"""Score validity, accuracy, macro F1, and the 4x4 confusion matrix."""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path
from typing import Any

CATEGORIES = (1, 2, 3, 4)
CATEGORY_NAMES = {1: "Acceptable", 2: "Rewrite", 3: "Vague", 4: "Not Acceptable"}


def load_records(run_directory: Path) -> list[dict[str, Any]]:
    path = run_directory / "responses.jsonl"
    if not path.is_file():
        raise FileNotFoundError(f"No responses.jsonl in {run_directory}")
    records = []
    with path.open(encoding="utf-8") as source:
        for line_number, line in enumerate(source, start=1):
            try:
                record = json.loads(line)
            except json.JSONDecodeError as error:
                raise ValueError(f"{path}: line {line_number}: invalid JSON: {error.msg}") from error
            if record.get("event") == "response":
                records.append(record)
    if not records:
        raise ValueError(f"No response records in {path}")
    return records


def score(records: list[dict[str, Any]]) -> tuple[dict[str, Any], dict[tuple[int, int], int]]:
    confusion = {(expected, predicted): 0 for expected in CATEGORIES for predicted in CATEGORIES}
    actual_counts = {category: 0 for category in CATEGORIES}
    valid = correct = 0

    for record in records:
        expected = record["expected"]["category"]
        actual_counts[expected] += 1
        if not record.get("valid"):
            continue
        predicted = record["parsed_output"]["category"]
        valid += 1
        confusion[(expected, predicted)] += 1
        correct += expected == predicted

    f1_scores = []
    for category in CATEGORIES:
        true_positive = confusion[(category, category)]
        predicted_count = sum(confusion[(expected, category)] for expected in CATEGORIES)
        precision = true_positive / predicted_count if predicted_count else 0.0
        recall = true_positive / actual_counts[category] if actual_counts[category] else 0.0
        f1_scores.append(
            2 * precision * recall / (precision + recall) if precision + recall else 0.0
        )

    summary = {
        "event": "score",
        "requests": len(records),
        "valid": valid,
        "validity_rate": valid / len(records),
        "correct": correct,
        "accuracy": correct / len(records),
        "macro_f1": sum(f1_scores) / len(CATEGORIES),
    }
    return summary, confusion


def write_confusion(path: Path, confusion: dict[tuple[int, int], int]) -> None:
    with path.open("w", newline="", encoding="utf-8") as output:
        writer = csv.writer(output)
        writer.writerow(["expected \\ predicted", *CATEGORIES])
        for expected in CATEGORIES:
            writer.writerow([expected, *(confusion[(expected, predicted)] for predicted in CATEGORIES)])


def disagreement_row(record: dict[str, Any]) -> dict[str, Any]:
    parsed = record.get("parsed_output") or {}
    item, expected = record["input"], record["expected"]
    return {
        "id": item["id"],
        "expected_category": expected["category"],
        "category": parsed.get("category"),
        "valid": record.get("valid"),
        "error": record.get("error"),
        "campaign_prompt": item["campaign_prompt"],
        "text": item["text"],
        "expected_rewrite": expected["rewrite"],
        "rewrite": parsed.get("rewrite"),
        "provider": record.get("provider"),
        "finish_reason": record.get("finish_reason"),
        "raw_output": record.get("raw_output"),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run_directory", type=Path)
    args = parser.parse_args()
    if not args.run_directory.is_dir():
        raise FileNotFoundError(f"Not a directory: {args.run_directory}")

    records = load_records(args.run_directory)
    summary, confusion = score(records)
    (args.run_directory / "score.jsonl").write_text(
        json.dumps(summary, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    write_confusion(args.run_directory / "confusion.csv", confusion)

    disagreements = [
        disagreement_row(record)
        for record in records
        if not record.get("valid")
        or record["parsed_output"]["category"] != record["expected"]["category"]
    ]
    columns = (
        "id", "expected_category", "category", "valid", "error", "campaign_prompt",
        "text", "expected_rewrite", "rewrite", "provider", "finish_reason", "raw_output",
    )
    with (args.run_directory / "disagreements.csv").open(
        "w", newline="", encoding="utf-8"
    ) as output:
        writer = csv.DictWriter(output, fieldnames=columns)
        writer.writeheader()
        writer.writerows(disagreements)

    print(
        f"Validity {summary['validity_rate']:.1%} | Accuracy {summary['accuracy']:.1%} "
        f"| Macro F1 {summary['macro_f1']:.3f}"
    )
    print("\nExpected (rows) x predicted (columns)")
    print("       " + "".join(f"{category:>6}" for category in CATEGORIES))
    for expected in CATEGORIES:
        values = "".join(f"{confusion[(expected, predicted)]:>6}" for predicted in CATEGORIES)
        print(f"{expected} {CATEGORY_NAMES[expected]:<13}{values}")
    print(f"\nWrote score.jsonl, confusion.csv, and {len(disagreements)} disagreements.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (FileNotFoundError, ValueError) as error:
        print(f"Error: {error}", file=sys.stderr)
        raise SystemExit(1)
