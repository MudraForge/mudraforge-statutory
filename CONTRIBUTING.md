# Contributing to MudraForge Statutory Substrate

> **Open Knowledge Format (OKF v0.2) Contribution & Practitioner Review Guide**

Thank you for your interest in contributing to `@mudraforge/statutory`. 

Our mission is to build the definitive, open, machine-readable statutory knowledge substrate for Indian and cross-border commercial finance. We welcome contributions from **software engineers, AI agent builders, Chartered Accountants (CAs), CPAs, and legal compliance practitioners**.

---

## 1. Operating Principles & Epistemic Standards

Unlike standard software libraries where code is judged primarily on execution speed, statutory knowledge repositories are judged on **statutory ground truth, temporal precision, and provenance**:

1. **Official Primary Sources Only**: All statutory thresholds, rates, and rules must be sourced directly from official Union Gazettes, Central Board of Direct Taxes (CBDT), Central Board of Indirect Taxes and Customs (CBIC), Reserve Bank of India (RBI), Ministry of Corporate Affairs (MCA), or official regulatory portals. **Citations to third-party SEO blogs or unverified discussion forums are strictly rejected.**
2. **Temporal Enforcement**: Statutory provisions must declare strict temporal boundaries (`effectivePeriod.validFrom` and `effectivePeriod.validTo` in `section.json`; `valid_from` and `valid_to` in circular YAML frontmatter, or `OPEN_ENDED` for active legislation). Sunset dates must be rigorously documented.
3. **Fail-Closed Validation**: Every submission must pass the automated schema linter (`npm run validate`) and test suite (`npm test`) with zero defects before merge.

---

## 2. Structure of an OKF Statutory Provision

All provisions reside under [`okf/<domain>/<provision_folder>/`](./okf/) and adhere to a 3-part layout:

```
okf/<domain>/<provision_code>/
├── section.json                               # Core machine-readable statutory schema
├── circulars/
│   └── <authority>_circular_<no>_<topic>.md  # Full-text official circulars (Markdown with YAML frontmatter)
└── forms/
    └── <form_name>.<json|md>                  # Return schemas, verification checklists, or declarations
```

### A. Authoring `section.json`
Every `section.json` must provide these required fields:

```json
{
  "sectionId": "ITA1961_SEC194Q",
  "sectionCode": "194Q",
  "aliases": ["194Q", "194q", "goods tds", "purchase of goods"],
  "governingStatute": "Income-tax Act, 1961 (Act No. 43 of 1961)",
  "statutorySection": "Section 194Q",
  "successorStatute": "Income-tax Act, 2025",
  "successorSection": "Section 393(1), Table 1, Sl. No. 8(ii)",
  "title": "Deduction of tax at source on payment of a certain sum for purchase of goods",
  "effectivePeriod": {
    "validFrom": "2021-07-01",
    "validTo": "2026-03-31",
    "annualReset": "Every April 1 (Cumulative Purchases Reset Annually)",
    "sunsetNotes": "Transitions to Section 393(1), Table 1, Sl. No. 8(ii) of the Income-tax Act, 2025 effective 1 April 2026."
  },
  "plainTextSummary": "Plain English summary explaining who must deduct, when, and on what base.",
  "keyStatutoryThresholds": {
    "buyerPriorYearTurnoverCr": 10,
    "annualPurchaseThresholdInr": 5000000,
    "standardDeductionRatePercent": 0.1,
    "inoperativePanPenaltyRatePercent": 5.0,
    "taxableBaseScope": "Tax is deductible strictly on the excess over ₹50 Lakhs, NOT on the aggregate gross turnover."
  },
  "officialCitations": [
    {
      "authority": "Central Board of Direct Taxes (CBDT)",
      "instrument": "Circular No. 13 of 2021 (Dated 30 June 2021)",
      "subject": "Guidelines under section 194Q - Threshold calculation & advance netting",
      "officialUrl": "https://incometaxindia.gov.in/communications/circular/circular_13_2021.pdf"
    }
  ],
  "requiredDocumentChecklist": [
    "Valid Permanent Account Number (PAN) of Seller",
    "Cumulative Purchase Ledger for current FY",
    "Tax invoice with GST separately stated"
  ],
  "tier": "PUBLIC_COMMONS_FREE",
  "version": "2.4.0"
}
```

### B. Authoring Circulars (`circulars/*.md`)
Executive circulars must include Google OKF YAML frontmatter at the top:

```markdown
---
id: cbdt_circular_13_2021
title: CBDT Circular No. 13 of 2021 - Guidelines under Section 194Q
authority: Central Board of Direct Taxes (CBDT), Department of Revenue, Ministry of Finance
date: 2021-06-30
statutory_section: Section 194Q
valid_from: 2021-07-01
valid_to: 2026-03-31
temporal_status: ACTIVE
subject: Threshold calculation, advance payment netting, and non-resident exemption
official_url: https://incometaxindia.gov.in/communications/circular/circular_13_2021.pdf
---

> [STATUTORY VALIDITY WINDOW & TEMPORAL STATUS]  
> **Valid From**: 1 July 2021  
> **Valid To**: 31 March 2026  
> **Temporal Status**: ACTIVE  

# Circular Title & Legal Guidance Body...
```

---

## 3. Step-by-Step Contribution Workflow

### Step 1: Fork and Clone the Repository
```bash
git clone https://github.com/<your-username>/mudraforge-statutory.git
cd mudraforge-statutory
npm install
```

### Step 2: Create a Dedicated Feature Branch
```bash
git checkout -b feat/add-section-194c-contractors
```

### Step 3: Implement Your Statute
Place your files in the appropriate domain folder under `./okf/`:
- `direct_tax/`
- `indirect_tax_gst/`
- `msme_commercial/`
- `international_tax/`
- `corporate_ma_restructuring/`

### Step 4: Run the Schema Linter & Validator
We provide an automated validator that verifies all fields, dates, URLs, and frontmatter:
```bash
npm run validate
```
Ensure output finishes with: `ALL OKF SCHEMAS, CIRCULARS & FORMS PASSED VALIDATION WITH ZERO DEFECTS!`

### Step 5: Run the Integration Test Suite
```bash
npm test
```

### Step 6: Developer Certificate of Origin (DCO 1.1) Sign-Off
All commits must be signed off to certify that the contributor has the right to submit the code and legal annotations under the project's open licenses (MIT for code, CC BY 4.0 for OKF data).

Use the `-s` or `--signoff` flag when committing:
```bash
git commit -s -m "feat(direct_tax): add section 194C contractor withholding"
```

By adding a `Signed-off-by:` line, you certify the following:
```
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.

By making a contribution to this project, I certify that:
(a) The contribution was created in whole or in part by me and I have the right to submit it under the open source license indicated in the file; or
(b) The contribution is based upon previous work that, to the best of my knowledge, is covered under an appropriate open source license and I have the right under that license to submit that work with modifications, whether created in whole or in part by me, under the same open source license; or
(c) The contribution was provided directly to me by some other person who certified (a), (b) or (c) and I have not modified it.
(d) I understand and agree that this project and the contribution are public and that a record of the contribution is maintained indefinitely.
```

### Step 7: Submit a Pull Request
Push your branch to GitHub and open a Pull Request against `main`. Provide:
1. The governing statute and section code.
2. Official government links (Gazette, CBDT, CBIC, or RBI notifications).
3. Any temporal effective dates or Finance Act amendments.

---

## 4. Starter Tasks & Good First Issues

Looking to contribute? Here are recommended starter areas:
- **Circular Updates**: Adding newly notified CBDT or CBIC circulars to existing direct tax provisions with standard YAML frontmatter.
- **Form Schemas**: Adding JSON return schemas or GSTR-2B reconciliation templates under `okf/indirect_tax_gst/forms/`.
- **Successor Mappings**: Adding dual-act cross-references for sections transitioning from the *Income-tax Act, 1961* to the *Income-tax Act, 2025* (taking effect 1 April 2026).
- **Cross-Border Treaties**: Adding DTAA withholding schedules (e.g. India-US Article 12, India-Singapore Article 12) under `okf/international_tax/`.

---

## 5. Chartered Accountant (CA) & Legal Practitioner Empanelment

If you are a Chartered Accountant (FCA/ACA), CPA, Company Secretary (CS), or tax attorney and wish to author, verify, or co-sign statutory rule packs:

- Co-authored statutory packs carry official attribution in `section.json` (`reviewedBy`, `practitionerRegistrationNumber`).
- Empanelled reviewers receive verification attribution in release notes and access to the MudraForge Enterprise Research network.
- To join the review panel or collaborate, reach out directly to the maintainer at **`hello@mudraforge.in`** or **`mondeepe@gmail.com`**.

---

## 6. Security & Responsible Disclosure

If you discover a vulnerability or statutory discrepancy that could lead to financial calculation errors or compliance failures, please report it privately to **`security@mudraforge.in`** or **`hello@mudraforge.in`**.
