from __future__ import annotations

from pathlib import Path

from minwon_pipeline import (
    HashingCentroidClassifier,
    dedupe_rows,
    iter_question_rows,
    save_faq_csv,
)


REPORT_HEADER = "\uc815\ud655\ub3c4 \ud55c \uc904: validation exact-match accuracy = "
REPORT_EXAMPLES = "\uc608\uce21 \uc608\uc2dc 3\uac1c"
DATASET_ROOT = (
    "C:\\Users\\user\\Downloads\\23."
    "\ubbfc\uac04 \ubbfc\uc6d0 \uc0c1\ub2f4 LLM \uc0ac\uc804\ud559\uc2b5 \ubc0f Instruction Tuning \ub370\uc774\ud130"
    "\\3.\uac1c\ubc29\ub370\uc774\ud130"
)


def main() -> None:
    project_root = Path(__file__).resolve().parents[1]
    dataset_root = Path(DATASET_ROOT)

    rows = dedupe_rows(iter_question_rows(dataset_root))
    faq_output = project_root / "data" / "faqs.csv"
    save_faq_csv(rows, faq_output)

    train_rows = [(row["category"], row["question"]) for row in rows if row["split"] == "training"]
    valid_rows = [(row["category"], row["question"]) for row in rows if row["split"] == "validation"]

    classifier = HashingCentroidClassifier()
    classifier.fit(train_rows)
    accuracy, examples = classifier.evaluate(valid_rows)

    model_output = project_root / "ml" / "minwon_classifier_model.json"
    classifier.save(model_output)

    report_lines = [
        f"{REPORT_HEADER}{accuracy:.4f}",
        "",
        REPORT_EXAMPLES,
    ]
    for index, example in enumerate(examples, start=1):
        report_lines.append(
            f"{index}. Q={example['question']} | actual={example['actual']} | predicted={example['predicted']}"
        )

    report_output = project_root / "ml" / "classifier_report.txt"
    report_output.write_text("\n".join(report_lines), encoding="utf-8")

    print(f"saved_faqs={faq_output}")
    print(f"saved_model={model_output}")
    print(f"saved_report={report_output}")
    print(report_lines[0])


if __name__ == "__main__":
    main()
