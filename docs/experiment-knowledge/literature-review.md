# Literature Review: Experimental Technique Knowledge Base

## Summary

The upgraded knowledge base should use a stable internal taxonomy while mapping entries to
external controlled vocabularies. OBI provides the investigation/assay/material/device model,
CHMO provides deeper analytical-method and instrument terminology, and MeSH provides broad
biomedical subject headings and multilingual search terms. Mappings must retain their exact,
broad, narrow, or related relationship and the source release; a mapping is terminology
evidence, not evidence for an operational or performance claim.

Operational guidance should be stored as original structured summaries linked to immutable,
versioned protocols. A protocols.io citation must point to an exact `/vN` version rather than
`latest`. Restricted or unclear licenses permit bibliographic metadata, short factual claims,
and links, but not copied protocol prose, figures, or tables.

Reporting standards are technique-specific and versioned. MDAR supplies a general baseline;
ARRIVE 2.0 applies to in-vivo animal work; MIQE/dMIQE to qPCR and digital PCR; MIFlowCyt to
flow cytometry; REMBI to bioimaging; MIxS to sequence/environmental metadata; STRENDA to
enzyme kinetics; and PDBx/mmCIF/wwPDB validation to structural biology. Reporting
completeness, methodological quality, and inventory readiness are separate conclusions.

## Key Findings

### Terminology and ontology

- OBI and CHMO use stable OBO PURLs and CC BY 4.0; store the ontology term, relationship,
  release/version IRI, retrieval date, and checksum.
- MeSH 2026 is the current production vocabulary. Store the production year and acknowledge
  NLM; do not label MeSH as Creative Commons content.
- Do not invent ontology identifiers. An explicit `unmapped` state is valid when no exact term
  exists.

### Protocol and evidence provenance

- A published technique needs a fixed-version operational source and at least one authority,
  consensus, or peer-reviewed validation source appropriate to the claim.
- Numerical performance claims require claim-level evidence with conditions, units, locator,
  and a `vendorReported` marker when applicable.
- Safety claims require an SDS, regulator/public-health source, institutional biosafety
  standard, or device manual.
- Source tiers are A1/A2 (normative/official), B1/B2 (consensus/peer-reviewed methods),
  C1/C2 (versioned protocol/supporting SOP), and D (discovery lead). D cannot publish alone.

### Reporting standards

- REQUIRED fields block a compliance claim when missing. CONDITIONAL fields alone may be
  marked not applicable and require a rationale. RECOMMENDED omissions produce warnings.
- Standards must be stored by stable ID and version, not flattened into free text.
- Standards define minimum reporting information; they do not prove that an experiment is
  well designed or that its result is valid.

## Methodological Consensus

Use a single versioned technique model with structured requirements, workflow, controls, QC,
safety, ontology mappings, profiles, evidence sources, and claim bindings. Keep the complete
catalog server-side, validate it before synchronization, and publish runtime changes only
through a lab-scoped draft and reviewer approval workflow.

## References

- OBI: https://obofoundry.org/ontology/obi
- CHMO: https://obofoundry.org/ontology/chmo.html
- MeSH data and terms: https://www.nlm.nih.gov/databases/download/mesh.html
- protocols.io API and version metadata: https://apidoc.protocols.io/
- MDAR framework: https://pmc.ncbi.nlm.nih.gov/articles/PMC8092464/
- ARRIVE 2.0: https://arriveguidelines.org/arrive-guidelines
- MIQE 2.0: https://doi.org/10.1093/clinchem/hvaf043
- dMIQE 2020: https://doi.org/10.1093/clinchem/hvaa125
- MIFlowCyt 1.0: https://isac-net.org/resource/resmgr/docs/miflowcyt1-0.pdf
- REMBI: https://www.ebi.ac.uk/bioimage-archive/rembi-help-overview/
- MIxS: https://github.com/GenomicsStandardsConsortium/mixs
- STRENDA: https://www.beilstein-institut.de/en/projects/strenda/guidelines/
- PDBx/mmCIF: https://mmcif.wwpdb.org/
