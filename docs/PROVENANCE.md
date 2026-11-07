# Published Release & Provenance Ledger

This document records the cryptographic provenance, normative specifications, and formal assurance artifacts for `@mudraforge/statutory`.

---

## Release Baseline Ledger

| Item | Value |
|---|---|
| **Package Release** | **`v2.13.0`** (Production Release) |
| **Knowledge Specification** | **Google Open Knowledge Format (OKF v0.2) + MudraForge Statutory Schema Extension** |
| **Regulatory Snapshot** | **CBDT / CBIC / MCA / MSME Baseline: November 2026** |
| **Corpus Quality Card** | 100% Primary Citation Resolution (125/125 URLs verified; 182 citations across 46 provisions) in [`docs/CORPUS_QUALITY.md`](./CORPUS_QUALITY.md) |
| **Architecture Decision Records** | 7 Normative ADRs documented in [`docs/ARCHITECTURE_DECISIONS.md`](./ARCHITECTURE_DECISIONS.md) |
| **Vendor Conformance Suite** | 12/12 Passing Fixture Tests in [`conformance/`](../conformance/) |
| **End-to-End Execution Trace** | Audited 7-stage AP lifecycle in [`examples/`](../examples/) (`npm run example:trace`) |
| **Enterprise Assurance Preview** | Formal TLA+ & mutation defenses in [`docs/ADESHA_ASSURANCE_OVERVIEW.md`](./ADESHA_ASSURANCE_OVERVIEW.md) |
| **Integrity Root** | SHA-256 root manifest in [`okf/manifest.json`](../okf/manifest.json) (`sha256-7ffc75e8611a9c966eea756dd544fdae9144e2318d3478633232bb876d05e364` across 191 files) |
| **Temporal Framework** | Dual-Act Bridge: *Income-tax Act, 1961* & *Income-tax Act, 2025* |
| **Verification Gate** | 100% Pass across all 166 test suites (cumulative thresholds, legislative sunsets, and excess math) |

---

## Cryptographic & Epistemic Scope

The SHA-256 root hash in `okf/manifest.json` provides mathematical verification of **byte-level integrity** (ensuring local files have not been corrupted, altered, or partially written). A hash certifies that bytes match the published release; it does not by itself constitute legal or statutory authority. 

Epistemic authority is established strictly via:
1. Primary gazette citations and statutory text enacted by Parliament.
2. Executive circulars and notifications issued by the CBDT, CBIC, MCA, and Ministry of MSME.
3. Cryptographic Ed25519 signatures anchored to the MudraForge Root Authority.
4. Independent legal ground-truth test suites parameterizing effective dates and cumulative turnover thresholds.
