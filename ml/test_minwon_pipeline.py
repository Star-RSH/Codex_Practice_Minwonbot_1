import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from minwon_pipeline import (
    HashingCentroidClassifier,
    normalize_question,
    should_exclude_question,
)


Q_EXCLUDE_1 = "\ub179\ucde8\ud588\uc5b4? \uc5b4\ub5a4 \uc0c1\ud669\uc774\uc57c?"
Q_EXCLUDE_2 = "\uace0\uac1d\uc774 \ucde8\uc18c\ud588\uc5b4?"
Q_KEEP = "\uce74\ub4dc \uc815\uc9c0 \ud574\uc81c\ub294 \uc5b4\ub5bb\uac8c \ud558\ub098\uc694?"
Q_NORMALIZED = "\uce74\ub4dc \uc815\uc9c0 \ud574\uc81c"
CAT_LOST = "\ubd84\uc2e4/\ud574\uc81c"
CAT_LIMIT = "\uc774\uc6a9\ud55c\ub3c4"
Q_LOST_1 = "\uce74\ub4dc \uc815\uc9c0 \ud574\uc81c\ub294 \uc5b4\ub5bb\uac8c \ud558\ub098\uc694"
Q_LOST_2 = "\ubd84\uc2e4 \uce74\ub4dc \ud574\uc81c \uc694\uccad \ubc29\ubc95\uc774 \uad81\uae08\ud574\uc694"
Q_LIMIT_1 = "\uce74\ub4dc \ud55c\ub3c4\ub97c \uc62c\ub9ac\uace0 \uc2f6\uc5b4\uc694"
Q_LIMIT_2 = "\uc774\uc6a9 \ud55c\ub3c4 \uc99d\uc561\uc774 \uac00\ub2a5\ud55c\uac00\uc694"
Q_PREDICT = "\uce74\ub4dc \uc815\uc9c0 \ud574\uc81c \ubc29\ubc95\uc774 \uad81\uae08\ud574\uc694"


class MinwonPipelineTests(unittest.TestCase):
    def test_should_exclude_question_filters_recording_and_hasseo(self):
        self.assertTrue(should_exclude_question(Q_EXCLUDE_1))
        self.assertTrue(should_exclude_question(Q_EXCLUDE_2))
        self.assertFalse(should_exclude_question(Q_KEEP))

    def test_normalize_question_strips_spacing(self):
        self.assertEqual(normalize_question(f"  {Q_NORMALIZED}  "), Q_NORMALIZED)

    def test_hashing_centroid_classifier_predicts_seen_pattern(self):
        model = HashingCentroidClassifier(num_features=4096, ngram_range=(2, 4))
        train_rows = [
            (CAT_LOST, Q_LOST_1),
            (CAT_LOST, Q_LOST_2),
            (CAT_LIMIT, Q_LIMIT_1),
            (CAT_LIMIT, Q_LIMIT_2),
        ]
        model.fit(train_rows)
        prediction = model.predict_one(Q_PREDICT)
        self.assertEqual(prediction, CAT_LOST)


if __name__ == "__main__":
    unittest.main()
