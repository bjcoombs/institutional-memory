"""Model provider wrapper for CrediSense.

Loads the pinned model id and prompt version from config, calls the
provider API, and validates the response against the output schema.
"""

import json
from dataclasses import dataclass
from pathlib import Path

import httpx
import yaml


@dataclass
class ScoreResult:
    score: int
    reasons: list[str]
    schema_valid: bool


class ModelClient:
    def __init__(self, model_id: str, prompt_path: str, thresholds: dict,
                 api_base: str, timeout_s: float = 20.0):
        self.model_id = model_id
        self.prompt_template = Path(prompt_path).read_text()
        self.thresholds = thresholds
        self.api_base = api_base
        self.timeout_s = timeout_s

    @classmethod
    def from_config(cls, config_path: str) -> "ModelClient":
        cfg = yaml.safe_load(Path(config_path).read_text())
        return cls(
            model_id=cfg["model"]["id"],
            prompt_path=cfg["model"]["scoring_prompt"],
            thresholds=cfg["thresholds"],
            api_base=cfg["model"]["api_base"],
            timeout_s=cfg["model"].get("timeout_s", 20.0),
        )

    def score(self, applicant: dict) -> ScoreResult:
        prompt = self.prompt_template.format(applicant_json=json.dumps(applicant))
        response = httpx.post(
            f"{self.api_base}/v1/messages",
            json={
                "model": self.model_id,
                "max_tokens": 512,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=self.timeout_s,
        )
        response.raise_for_status()
        payload = self._extract_json(response.json())
        valid = (
            isinstance(payload, dict)
            and isinstance(payload.get("score"), int)
            and 0 <= payload["score"] <= 1000
            and isinstance(payload.get("reasons"), list)
        )
        if not valid:
            return ScoreResult(score=0, reasons=[], schema_valid=False)
        return ScoreResult(score=payload["score"], reasons=payload["reasons"],
                           schema_valid=True)

    def band_for(self, score: int) -> str:
        if score >= self.thresholds["approve_min"]:
            return "approve"
        if score >= self.thresholds["refer_min"]:
            return "refer"
        return "decline"

    @staticmethod
    def _extract_json(api_response: dict):
        try:
            text = api_response["content"][0]["text"]
            return json.loads(text)
        except (KeyError, IndexError, json.JSONDecodeError):
            return None
