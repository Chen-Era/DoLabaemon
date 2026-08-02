# Record standard

## Record model

Use the local record bundle as a traceable source record plus export snapshots.

| Section | Record | Do not infer |
| --- | --- | --- |
| Identity | Record ID, revision, status, recorder, performer, time with timezone, project | Missing person or time |
| Method | Technique code and revision, protocol title/version/URL, planned and actual steps | That a planned step occurred |
| Inputs | Sample IDs, reagent name/vendor/catalog/lot/expiry/amount, instrument configuration, software version | Lot, configuration, or quantity absent from a source |
| Controls and QC | Predefined criterion, observed value, acceptance state, anomalous result | Controls or a pass state that was not reported |
| Results | Observations, raw-file attachments, source hash, acquisition time, analysis method | Interpretation beyond the supplied data |
| Changes | Actor, time, reason, before/after revision link | A retroactive correction without a reason |

## Integrity rules

Apply ALCOA-style practice: make entries attributable, legible, contemporaneous, original or a verified true copy, and accurate. Keep timestamps and an append-only audit event for creation, result additions, status changes, exports, and remote publication. A later correction is an amendment, not a replacement of the earlier snapshot.

Keep original source files unchanged. Save an attachment ID, original filename, MIME type, size, SHA-256, adding time, and whether it is original or derived. Do not delete an attachment to hide a result.

Status meanings:

| Status | Meaning |
| --- | --- |
| `DRAFT` | A working record. Required facts may still be missing. |
| `ATTESTED` | The named person confirms the factual execution and attachments. |
| `REVIEWED` | A named reviewer reviewed the attested record. |
| `AMENDED` | A later factual addition or correction exists; retain both revisions and re-attest if required by the laboratory. |

An AI-created draft is not an electronic signature, regulatory validation, or proof of compliance. Apply local SOP, ethics, biosafety, data-retention, and access-control requirements.

## Sources

- FDA, *Data Integrity and Compliance With Drug CGMP: Guidance for Industry*: https://www.fda.gov/media/119570/download
- 21 CFR 11.10, controls for closed electronic-record systems: https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-11/subpart-B/section-11.10
- OECD, *Principles on Good Laboratory Practice*: https://www.oecd.org/content/dam/oecd/en/publications/reports/1998/01/oecd-principles-on-good-laboratory-practice_g1gh32e8/9789264078536-en.pdf
