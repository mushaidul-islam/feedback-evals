import unittest

from run_jev import build_request, parse_answer
from score_results import score


class JevContractTest(unittest.TestCase):
    def test_classification_uses_choice_without_rewrite(self):
        request = build_request("Review my garden", "The garden feels off somehow.")
        self.assertEqual(request["model"], "jev-latest")
        self.assertEqual(request["questions"]["category"]["type"], "choice")
        self.assertEqual(set(request["questions"]["category"]["criteria"]), {"1", "2", "3", "4"})
        result = parse_answer({
            "model": "jev-1.13.0",
            "answers": {"category": {
                "type": "choice", "choice": "3", "confidence": 0.8,
                "probabilities": {"1": 0.1, "2": 0.05, "3": 0.8, "4": 0.05},
            }},
            "usage": {"input_tokens": 30, "output_tokens": 5},
        })
        self.assertEqual(result["parsed_output"], {"category": 3})
        self.assertTrue(result["valid"])
        self.assertIsNone(result["json_valid"])

    def test_unknown_choice_is_invalid(self):
        with self.assertRaises(ValueError):
            parse_answer({"answers": {"category": {"type": "choice", "choice": "5"}}})

    def test_score_reports_category_accuracy_without_json_rate(self):
        result = parse_answer({
            "answers": {"category": {"type": "choice", "choice": "3"}},
            "usage": {"input_tokens": 1, "output_tokens": 1},
        })
        summary, _ = score([{"expected": {"category": 3}, **result}])
        self.assertEqual(summary["accuracy"], 1.0)
        self.assertIsNone(summary["json_rate"])


if __name__ == "__main__":
    unittest.main()
