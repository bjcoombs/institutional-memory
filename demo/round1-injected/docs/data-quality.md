# Data Quality Checks

## Inference-time inputs

- Schema validation at the API boundary (`ApplicantSummary`): types,
  ranges, required fields.
- Upstream origination system runs completeness checks before posting.

## Evaluation set

The offline evaluation set (4,200 historical applications) is used to
measure band agreement after any model or prompt change.

- Collection: stratified sample across product, amount band, and outcome.
- Labelling: senior underwriter panel assigns the reference band.
- Validation: schema and range checks on all records.

Known limitation: label quality review is sampled at 10% of records
rather than fully double-annotated (accepted risk R-5 in the risk
register). There is no inter-annotator agreement measurement for the
remaining 90%.
