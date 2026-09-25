# SIH 26035 NAWI MVP — Technical Notes

## Scope
This release targets the SIH 26035 demonstration workflow for Non-Automatic Weighing Instruments (NAWI) using OIML R 76-1:2006 and R 76-2:2007 rule-set metadata.

## Authority boundaries
- The backend metrology engine is authoritative for MPE, corrected error, and observation PASS/FAIL.
- The backend is authoritative for evaluation completeness and finalization.
- The frontend provides workflow guidance and preliminary readiness only.
- The backend-generated PDF/DOCX artifacts are the official report outputs.

## Final result
Finalized report metadata exposes `overall_result` as PASS, FAIL, or INCOMPLETE. INCOMPLETE is only a pre-finalization state because the finalization gate requires all required tests and checklist items to be resolved.

## Rule-set versioning
The API exposes `/api/v1/ruleset` with rule-set ID, version, status, and supported test types. The current rules remain code-based and are marked `prototype-verified-core`; external regulatory rule authoring is a future production enhancement.

## Signature / approval
The MVP uses authenticated officer approval plus cryptographic report integrity/sealing. It is not a PKI/DSC/USB-token signature implementation.

## Production gaps intentionally outside the SIH MVP
- externally managed/versioned regulatory rule database
- laboratory test-equipment calibration registry
- PKI/DSC signing
- full LIMS integration
- instrument communications automation (RS-232/USB)
