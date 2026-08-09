#!/usr/bin/env python3
"""Score a run produced by run_openrouter_models.py.

    python3 evals/score_results.py evals/results/run_20260809T101500Z

Reads responses.jsonl (falling back to combined.csv) and writes, into the same
run directory:

    score_summary.csv          one row per model: validity, accuracy, macro F1,
                               the 2<->4 confusion counts, latency, cost
    confusion_<label>.csv      expected (rows) x predicted (columns), per model
    disagreements.csv          every wrong or invalid response, for eyeballing
    rewrites_for_review.csv    every category-2 rewrite the models produced

Two deliberate omissions:

  * Rewrite text is not scored automatically. Exact match against the reference
    rewrite measures nothing useful — read rewrites_for_review.csv, or build a
    judge with a written rubric, but do not let a string comparison stand in for
    either.
  * There are no confidence intervals. With 100 rows a one- or two-point gap
    between two models is noise. Run with --repeats 3 and look at the agreement
    column before believing any ranking.

Standard library only.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

CATEGORIES = (1, 2, 3, 4)
CATEGORY_NAMES = {1: "Acceptable", 2: "Rewrite", 3: "Vague", 4: "Not Acceptable"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("run_directory", type=Path, help="Run directory to score.")
    parser.add_argument("--sort-by", default="macro_f1",
                        choices=["macro_f1", "accuracy", "valid_rate", "cost_usd", "p50_latency_ms"],
                        help="Column to sort the printed table by (default: macro_f1).")
    return parser.parse_args()


def load_records(run_directory: Path) -> list[dict[str, Any]]:
    jsonl_path = run_directory / "responses.jsonl"
    records: list[dict[str, Any]] = []
    if jsonl_path.is_file():
        with jsonl_path.open(encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if line:
                    try:
                        records.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
    else:
        combined = run_directory / "combined.csv"
        if not combined.is_file():
            raise FileNotFoundError(f"Neither responses.jsonl nor combined.csv in {run_directory}")
        with combined.open(newline="", encoding="utf-8") as handle:
            records = list(csv.DictReader(handle))

    if not records:
        raise ValueError(f"No responses found in {run_directory}")

    # Keep the last record per (id, model, repeat): a resumed run may hold a
    # failed attempt followed by a successful one.
    latest: dict[tuple[str, str, int], dict[str, Any]] = {}
    for record in records:
        key = (record["id"], record["model_label"], int(record.get("repeat", 1) or 1))
        latest[key] = record
    return list(latest.values())


def as_int(value: Any) -> int | None:
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def as_float(value: Any) -> float | None:
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None


def is_valid(record: dict[str, Any]) -> bool:
    value = record.get("valid")
    return value is True or str(value).strip().lower() == "true"


def percentile(values: list[float], fraction: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, int(round(fraction * (len(ordered) - 1))))
    return ordered[index]


def per_class_scores(confusion: dict[tuple[int, int], int]) -> dict[int, dict[str, float]]:
    scores: dict[int, dict[str, float]] = {}
    for category in CATEGORIES:
        true_positive = confusion.get((category, category), 0)
        predicted = sum(confusion.get((expected, category), 0) for expected in CATEGORIES)
        actual = sum(confusion.get((category, prediction), 0) for prediction in CATEGORIES)
        precision = true_positive / predicted if predicted else 0.0
        recall = true_positive / actual if actual else 0.0
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
        scores[category] = {"precision": precision, "recall": recall, "f1": f1, "support": actual}
    return scores


def score_model(records: list[dict[str, Any]]) -> dict[str, Any]:
    confusion: dict[tuple[int, int], int] = Counter()
    latencies: list[float] = []
    costs: list[float] = []
    completion_tokens: list[float] = []
    invalid_reasons: Counter[str] = Counter()
    truncated = 0
    providers: Counter[str] = Counter()

    valid_count = 0
    for record in records:
        latency = as_float(record.get("latency_ms"))
        if latency is not None:
            latencies.append(latency)
        cost = as_float(record.get("cost_usd"))
        if cost is not None:
            costs.append(cost)
        tokens = as_float(record.get("completion_tokens"))
        if tokens is not None:
            completion_tokens.append(tokens)
        if record.get("provider"):
            providers[str(record["provider"])] += 1
        if str(record.get("finish_reason", "")).strip() == "length":
            truncated += 1

        if not is_valid(record):
            reason = str(record.get("error", "")).strip() or "unknown"
            invalid_reasons[reason.split(":")[0][:60]] += 1
            continue

        expected = as_int(record.get("expected_category"))
        predicted = as_int(record.get("category"))
        if expected not in CATEGORIES or predicted not in CATEGORIES:
            invalid_reasons["unparseable category"] += 1
            continue
        valid_count += 1
        confusion[(expected, predicted)] += 1

    scored = sum(confusion.values())
    correct = sum(confusion.get((category, category), 0) for category in CATEGORIES)
    class_scores = per_class_scores(confusion)
    macro_f1 = sum(class_scores[category]["f1"] for category in CATEGORIES) / len(CATEGORIES)

    # Repeat agreement: how often the same row gets the same answer across
    # repeats. Only rows that were actually run more than once can disagree, so
    # rows with a single response are excluded — counting them would report a
    # flat 1.00 for every --repeats 1 run and mean nothing.
    by_row: dict[str, list[int]] = defaultdict(list)
    for record in records:
        if is_valid(record):
            predicted = as_int(record.get("category"))
            if predicted in CATEGORIES:
                by_row[record["id"]].append(predicted)
    repeated = [answers for answers in by_row.values() if len(answers) > 1]
    unstable = [answers for answers in repeated if len(set(answers)) > 1]
    agreement = 1.0 - (len(unstable) / len(repeated)) if repeated else float("nan")

    return {
        "schema_mode": ", ".join(sorted({str(r.get("schema_mode", "")) for r in records if r.get("schema_mode")})),
        "requests": len(records),
        "valid_rate": valid_count / len(records) if records else 0.0,
        "scored": scored,
        "accuracy": correct / scored if scored else 0.0,
        "macro_f1": macro_f1,
        "rewrite_recall": class_scores[2]["recall"],
        "rewrite_precision": class_scores[2]["precision"],
        "expected2_pred4": confusion.get((2, 4), 0),
        "expected4_pred2": confusion.get((4, 2), 0),
        "expected1_pred4": confusion.get((1, 4), 0),
        "expected4_pred1": confusion.get((4, 1), 0),
        "repeat_agreement": agreement,
        "unstable_rows": len(unstable),
        "truncated": truncated,
        "p50_latency_ms": percentile(latencies, 0.5),
        "p95_latency_ms": percentile(latencies, 0.95),
        "mean_completion_tokens": sum(completion_tokens) / len(completion_tokens) if completion_tokens else 0.0,
        "cost_usd": sum(costs),
        "providers": ", ".join(f"{name} x{count}" for name, count in providers.most_common(3)),
        "top_failure": invalid_reasons.most_common(1)[0][0] if invalid_reasons else "",
        "_confusion": confusion,
        "_class_scores": class_scores,
    }


def majority_baseline(records: list[dict[str, Any]]) -> tuple[float, float, str]:
    """Accuracy and macro F1 of always predicting the most common label.

    The dataset is roughly two-thirds category 1, so a model that answers 1 every
    time scores well on accuracy. Print this next to the models or the ranking is
    unreadable.
    """
    truth: dict[str, int] = {}
    for record in records:
        expected = as_int(record.get("expected_category"))
        if expected in CATEGORIES:
            truth[record["id"]] = expected
    if not truth:
        return 0.0, 0.0, ""
    counts = Counter(truth.values())
    top, top_count = counts.most_common(1)[0]
    confusion = Counter({(expected, top): count for expected, count in counts.items()})
    class_scores = per_class_scores(confusion)
    macro = sum(class_scores[c]["f1"] for c in CATEGORIES) / len(CATEGORIES)
    return top_count / len(truth), macro, f"always {top} ({CATEGORY_NAMES[top]})"


SUMMARY_COLUMNS = (
    "model_label", "schema_mode", "requests", "valid_rate", "scored", "accuracy", "macro_f1",
    "rewrite_precision", "rewrite_recall",
    "expected2_pred4", "expected4_pred2", "expected1_pred4", "expected4_pred1",
    "repeat_agreement", "unstable_rows", "truncated",
    "p50_latency_ms", "p95_latency_ms", "mean_completion_tokens", "cost_usd",
    "providers", "top_failure",
)


def write_confusion(path: Path, confusion: dict[tuple[int, int], int]) -> None:
    with path.open("w", newline="", encoding="utf-8") as output:
        writer = csv.writer(output)
        writer.writerow(["expected \\ predicted"] + [f"{c} {CATEGORY_NAMES[c]}" for c in CATEGORIES] + ["total"])
        for expected in CATEGORIES:
            row = [confusion.get((expected, predicted), 0) for predicted in CATEGORIES]
            writer.writerow([f"{expected} {CATEGORY_NAMES[expected]}"] + row + [sum(row)])
        writer.writerow(
            ["total"]
            + [sum(confusion.get((e, p), 0) for e in CATEGORIES) for p in CATEGORIES]
            + [sum(confusion.values())]
        )


def print_confusion(label: str, confusion: dict[tuple[int, int], int],
                    class_scores: dict[int, dict[str, float]]) -> None:
    print(f"\n{label} — expected (rows) x predicted (columns)")
    header = "  exp\\pred " + "".join(f"{c:>7}" for c in CATEGORIES) + f"{'prec':>9}{'rec':>7}{'f1':>7}"
    print(header)
    for expected in CATEGORIES:
        cells = "".join(f"{confusion.get((expected, p), 0):>7}" for p in CATEGORIES)
        scores = class_scores[expected]
        print(f"  {expected} {CATEGORY_NAMES[expected][:8]:<8}{cells}"
              f"{scores['precision']:>9.2f}{scores['recall']:>7.2f}{scores['f1']:>7.2f}")


def main() -> int:
    args = parse_args()
    run_directory = args.run_directory
    if not run_directory.is_dir():
        raise FileNotFoundError(f"Not a directory: {run_directory}")

    records = load_records(run_directory)
    by_model: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        by_model[record["model_label"]].append(record)

    results = {label: score_model(rows) for label, rows in by_model.items()}
    ranked = sorted(
        results.items(),
        key=lambda item: item[1][args.sort_by],
        reverse=args.sort_by not in {"cost_usd", "p50_latency_ms"},
    )

    print(f"\nScored {len(records)} responses across {len(results)} model runs "
          f"from {run_directory}\n")
    header = (f"{'model':<24}{'valid':>7}{'acc':>7}{'macroF1':>9}{'2->4':>6}{'4->2':>6}"
              f"{'agree':>7}{'p50ms':>8}{'cost$':>9}")
    print(header)
    print("-" * len(header))
    for label, scores in ranked:
        print(f"{label:<24}{scores['valid_rate']:>7.2f}{scores['accuracy']:>7.2f}"
              f"{scores['macro_f1']:>9.3f}{scores['expected2_pred4']:>6}{scores['expected4_pred2']:>6}"
              f"{scores['repeat_agreement']:>7.2f}{scores['p50_latency_ms']:>8.0f}"
              f"{scores['cost_usd']:>9.4f}")

    baseline_accuracy, baseline_macro, baseline_name = majority_baseline(records)
    print("-" * len(header))
    print(f"{'BASELINE ' + baseline_name:<24}{1.00:>7.2f}{baseline_accuracy:>7.2f}"
          f"{baseline_macro:>9.3f}{'':>6}{'':>6}{'':>7}{'':>8}{'':>9}")
    print("A model must beat the baseline on macro F1, not on accuracy — the label "
          "distribution is heavily skewed toward category 1.")

    for label, scores in ranked:
        print_confusion(label, scores["_confusion"], scores["_class_scores"])
        if scores["truncated"]:
            print(f"  note: {scores['truncated']} response(s) hit finish_reason=length "
                  f"— raise max_tokens for {label}")
        if scores["top_failure"]:
            print(f"  most common failure: {scores['top_failure']}")

    summary_path = run_directory / "score_summary.csv"
    with summary_path.open("w", newline="", encoding="utf-8") as output:
        writer = csv.DictWriter(output, fieldnames=SUMMARY_COLUMNS, extrasaction="ignore")
        writer.writeheader()
        for label, scores in ranked:
            writer.writerow({"model_label": label, **scores})

    for label, scores in results.items():
        write_confusion(run_directory / f"confusion_{label}.csv", scores["_confusion"])

    disagreements = [
        record for record in records
        if not is_valid(record) or as_int(record.get("category")) != as_int(record.get("expected_category"))
    ]
    disagreement_columns = (
        "model_label", "id", "repeat", "expected_category", "category", "valid", "error",
        "campaign_prompt", "text", "expected_rewrite", "rewrite", "finish_reason", "provider",
    )
    with (run_directory / "disagreements.csv").open("w", newline="", encoding="utf-8") as output:
        writer = csv.DictWriter(output, fieldnames=disagreement_columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(sorted(disagreements, key=lambda r: (r["model_label"], r["id"])))

    rewrites = [record for record in records if is_valid(record) and as_int(record.get("category")) == 2]
    rewrite_columns = (
        "model_label", "id", "expected_category", "text", "expected_rewrite", "rewrite",
    )
    with (run_directory / "rewrites_for_review.csv").open("w", newline="", encoding="utf-8") as output:
        writer = csv.DictWriter(output, fieldnames=rewrite_columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(sorted(rewrites, key=lambda r: (r["id"], r["model_label"])))

    print(f"\nWrote {summary_path.name}, {len(results)} confusion sheets, "
          f"disagreements.csv ({len(disagreements)} rows), "
          f"rewrites_for_review.csv ({len(rewrites)} rows).")
    print("Read disagreements.csv before trusting the ranking — a category boundary "
          "your rubric never settled will show up there as a model error.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (FileNotFoundError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(1)