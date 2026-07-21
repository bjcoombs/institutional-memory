"""Human review queue integration.

Refer/decline outcomes are enqueued here and picked up by qualified
reviewers per docs/human-review-process.md.
"""

import json
import logging

logger = logging.getLogger("credisense.review")


def enqueue_for_human_review(application_id: str, band: str, reasons: list[str]) -> None:
    message = {
        "application_id": application_id,
        "band": band,
        "reasons": reasons,
        "queue": "credisense-review",
    }
    # In production this publishes to the review queue; the reviewer must
    # sign off before any outcome is communicated to the applicant.
    logger.info("queued for human review: %s", json.dumps(message))
