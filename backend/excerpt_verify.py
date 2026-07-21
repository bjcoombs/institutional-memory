"""Deterministic evidence-excerpt verification (leai-spec 10.12).

Before a finding is committed, this validator confirms that every quoted
``evidence_excerpt`` appears verbatim in the referenced artifact - an exact
substring match after whitespace normalization, preferring the cited file when
the ``evidence_location`` resolves to one. It judges nothing and involves no
LLM: it is a data-integrity check that verifies quotes exist.

A finding whose excerpt cannot be located is malformed. The scanner re-derives
that clause once (leai-spec 10.13) and, if it still fails, records the clause as
``unscored - system error`` - never as Gap or N/A - counted in the scan's
coverage notes (leai-spec 10.19). That control flow lives in ``scanner.py``;
this module only answers the yes/no verification question.
"""

from __future__ import annotations

import re

from backend.models import ClauseFinding

_WHITESPACE = re.compile(r"\s+")


def normalize_whitespace(text: str) -> str:
    """Collapse every run of whitespace to a single space and strip the ends.

    Deterministic and pure: the same input always yields the same output, with
    no locale or unicode-folding surprises beyond ``str.split`` semantics."""
    return _WHITESPACE.sub(" ", text).strip()


def excerpt_matches(excerpt: str, artifact_text: str) -> bool:
    """True when ``excerpt`` appears in ``artifact_text`` as an exact substring
    after whitespace normalization. An empty or whitespace-only excerpt never
    matches - there is nothing to verify."""
    needle = normalize_whitespace(excerpt)
    if not needle:
        return False
    haystack = normalize_whitespace(artifact_text)
    return needle in haystack


class Artifact:
    """A parsed artifact: a mapping of relative file path to file text plus a
    combined blob. ``evidence_location`` is matched against file paths so a
    citation is verified within its cited file when resolvable, and against the
    whole artifact otherwise (leai-spec 10.12)."""

    def __init__(self, ref: str, files: dict[str, str]) -> None:
        self.ref = ref
        self.files = dict(files)
        self.combined = "\n".join(files.values())

    def _file_for_location(self, location: str | None) -> str | None:
        if not location:
            return None
        # Match the longest file path whose name appears in the location
        # string (locations look like "app/service.py:40-52").
        candidates = [
            path for path in self.files if path and path in location
        ]
        if not candidates:
            # fall back to basename match
            candidates = [
                path
                for path in self.files
                if path and path.split("/")[-1] in location
            ]
        if not candidates:
            return None
        best = max(candidates, key=len)
        return self.files[best]

    def contains_excerpt(self, excerpt: str, location: str | None) -> bool:
        """Verify an excerpt, preferring the file named by ``location`` and
        falling back to the whole artifact."""
        scoped = self._file_for_location(location)
        if scoped is not None and excerpt_matches(excerpt, scoped):
            return True
        return excerpt_matches(excerpt, self.combined)


def verify_finding(finding: ClauseFinding, artifact: Artifact) -> bool:
    """True when the finding's excerpt is verified, or when the finding quotes
    no excerpt at all.

    A finding with no ``evidence_excerpt`` has nothing to verify and passes: a
    Gap with no evidence is legitimate. A finding that quotes an excerpt must
    have that excerpt located in the artifact, or it is malformed."""
    if finding.evidence_excerpt is None:
        return True
    return artifact.contains_excerpt(
        finding.evidence_excerpt, finding.evidence_location
    )
