"""Validate every rulepack YAML against backend/rulepacks/schema.json."""

import json
from pathlib import Path

import pytest
import yaml
from jsonschema import Draft202012Validator

RULEPACK_DIR = Path(__file__).resolve().parent.parent / "rulepacks"
SCHEMA_PATH = RULEPACK_DIR / "schema.json"

RULEPACK_PATHS = sorted(RULEPACK_DIR.glob("*.yaml"))


@pytest.fixture(scope="module")
def validator() -> Draft202012Validator:
    schema = json.loads(SCHEMA_PATH.read_text())
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def test_rulepacks_present() -> None:
    assert RULEPACK_PATHS, f"No rulepack YAML files found in {RULEPACK_DIR}"


@pytest.mark.parametrize("path", RULEPACK_PATHS, ids=lambda p: p.name)
def test_rulepack_validates_against_schema(path: Path, validator: Draft202012Validator) -> None:
    data = yaml.safe_load(path.read_text())
    errors = sorted(validator.iter_errors(data), key=lambda e: list(e.absolute_path))
    messages = "\n".join(
        f"{'/'.join(str(p) for p in error.absolute_path) or '<root>'}: {error.message}"
        for error in errors
    )
    assert not errors, f"{path.name} failed schema validation:\n{messages}"


@pytest.mark.parametrize("path", RULEPACK_PATHS, ids=lambda p: p.name)
def test_rulepack_id_matches_filename(path: Path) -> None:
    data = yaml.safe_load(path.read_text())
    assert data["id"] == path.stem, f"{path.name}: id '{data['id']}' does not match filename"
