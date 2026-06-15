from __future__ import annotations

import csv
import json
import math
import re
import zipfile
import zlib
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np


QUESTION_EXCLUDE_PATTERNS = (
    re.compile("\ub179\ucde8"),
    re.compile("\ud588\uc5b4\\?"),
)

TARGET_VENDOR = "\ud558\ub098\uce74\ub4dc"
LABEL_DIR_1 = "1.\ub370\uc774\ud130"
LABEL_DIR_2 = "02.\ub77c\ubca8\ub9c1\ub370\uc774\ud130"
TUNING_TYPE_QA = "\uc9c8\uc758\uc751\ub2f5"


def normalize_question(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def should_exclude_question(question: str) -> bool:
    normalized = normalize_question(question)
    return any(pattern.search(normalized) for pattern in QUESTION_EXCLUDE_PATTERNS)


def iter_label_zip_paths(dataset_root: Path, vendor: str = TARGET_VENDOR) -> list[tuple[str, Path]]:
    paths: list[tuple[str, Path]] = []
    for split_dir in ("Training", "Validation"):
        label_dir = dataset_root / LABEL_DIR_1 / split_dir / LABEL_DIR_2
        for zip_path in sorted(label_dir.glob(f"*{vendor}*\uc9c8\uc758\uc751\ub2f5*.zip")):
            paths.append((split_dir.lower(), zip_path))
    return paths


def iter_question_rows(dataset_root: Path, vendor: str = TARGET_VENDOR) -> list[dict]:
    rows: list[dict] = []
    for split_name, zip_path in iter_label_zip_paths(dataset_root, vendor=vendor):
        with zipfile.ZipFile(zip_path) as archive:
            for member_name in archive.namelist():
                if not member_name.lower().endswith(".json"):
                    continue
                payload = json.loads(archive.read(member_name).decode("utf-8-sig"))
                for item in payload:
                    category = str(item.get("consulting_category", "")).strip()
                    source = str(item.get("source", "")).strip()
                    source_id = str(item.get("source_id", "")).strip()
                    for instruction_block in item.get("instructions", []):
                        if instruction_block.get("tuning_type") != TUNING_TYPE_QA:
                            continue
                        for sample in instruction_block.get("data", []):
                            question = normalize_question(sample.get("instruction", ""))
                            answer = normalize_question(sample.get("output", ""))
                            if not category or not question or not answer:
                                continue
                            if should_exclude_question(question):
                                continue
                            rows.append(
                                {
                                    "split": split_name,
                                    "category": category,
                                    "question": question,
                                    "answer": answer,
                                    "source": f"AIHub({source})/{source_id}",
                                }
                            )
    return rows


def dedupe_rows(rows: Iterable[dict]) -> list[dict]:
    deduped: dict[tuple[str, str, str], dict] = {}
    for row in rows:
        key = (row["category"], row["question"], row["answer"])
        if key not in deduped:
            deduped[key] = row
    return sorted(
        deduped.values(),
        key=lambda row: (row["category"], row["question"], row["answer"]),
    )


def save_faq_csv(rows: Iterable[dict], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["category", "question", "answer", "source"],
        )
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "category": row["category"],
                    "question": row["question"],
                    "answer": row["answer"],
                    "source": row["source"],
                }
            )


@dataclass
class HashingCentroidClassifier:
    num_features: int = 4096
    ngram_range: tuple[int, int] = (2, 4)

    def __post_init__(self) -> None:
        self.class_log_priors: dict[str, float] = {}
        self.feature_log_probs: dict[str, np.ndarray] = {}
        self.labels: list[str] = []
        self.class_totals: dict[str, float] = {}

    def _char_ngrams(self, text: str) -> list[str]:
        compact = re.sub(r"\s+", "", normalize_question(text))
        grams: list[str] = []
        for n in range(self.ngram_range[0], self.ngram_range[1] + 1):
            if len(compact) < n:
                continue
            grams.extend(compact[index : index + n] for index in range(len(compact) - n + 1))
        return grams or ([compact] if compact else [])

    def _hashed_counts(self, text: str) -> Counter:
        counts: Counter = Counter()
        for gram in self._char_ngrams(text):
            hashed = zlib.crc32(gram.encode("utf-8")) % self.num_features
            counts[hashed] += 1
        return counts

    def fit(self, rows: Iterable[tuple[str, str]]) -> None:
        rows = list(rows)
        class_feature_counts: dict[str, np.ndarray] = defaultdict(
            lambda: np.zeros(self.num_features, dtype=np.float64)
        )
        class_doc_counts: Counter = Counter()

        for category, question in rows:
            class_doc_counts[category] += 1
            counts = self._hashed_counts(question)
            for index, count in counts.items():
                class_feature_counts[category][index] += count

        total_docs = max(len(rows), 1)
        self.labels = sorted(class_feature_counts.keys())
        self.class_log_priors = {}
        self.feature_log_probs = {}
        self.class_totals = {}

        for category in self.labels:
            feature_counts = class_feature_counts[category]
            smoothed = feature_counts + 1.0
            total_count = float(smoothed.sum())
            self.class_log_priors[category] = math.log(class_doc_counts[category] / total_docs)
            self.feature_log_probs[category] = np.log(smoothed / total_count)
            self.class_totals[category] = total_count

    def predict_one(self, text: str) -> str:
        counts = self._hashed_counts(text)
        best_label = ""
        best_score = float("-inf")
        for label in self.labels:
            score = self.class_log_priors[label]
            log_probs = self.feature_log_probs[label]
            for index, count in counts.items():
                score += count * float(log_probs[index])
            if score > best_score:
                best_label = label
                best_score = score
        return best_label

    def evaluate(self, rows: Iterable[tuple[str, str]]) -> tuple[float, list[dict]]:
        samples = list(rows)
        correct = 0
        examples: list[dict] = []
        for category, question in samples:
            prediction = self.predict_one(question)
            if prediction == category:
                correct += 1
            if len(examples) < 3:
                examples.append(
                    {
                        "question": question,
                        "actual": category,
                        "predicted": prediction,
                    }
                )
        accuracy = correct / len(samples) if samples else 0.0
        return accuracy, examples

    def save(self, output_path: Path) -> None:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "num_features": self.num_features,
            "ngram_range": list(self.ngram_range),
            "labels": self.labels,
            "class_log_priors": self.class_log_priors,
            "class_totals": self.class_totals,
            "feature_log_probs": {
                label: self.feature_log_probs[label].tolist() for label in self.labels
            },
        }
        output_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
