# MudraForge Adesha — Statutory Knowledge & Governance Substrate (`@mudraforge/statutory`)

> **The Open Trust Anchor for Autonomous Finance AI**  
> *MudraForge Adesha is an autonomous organizational AI for commercial finance and accounts payable. Its statutory knowledge and deterministic calculation layer is open-sourced here as `@mudraforge/statutory` so engineering teams, Chief Financial Officers, and tax practitioners can independently inspect, verify, and trust the legal and computational foundation it runs on.*

[![npm version](https://img.shields.io/npm/v/@mudraforge/statutory.svg)](https://www.npmjs.com/package/@mudraforge/statutory)
[![CI](https://github.com/mondeep0123/mudraforge-statutory/actions/workflows/ci.yml/badge.svg)](https://github.com/mondeep0123/mudraforge-statutory/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0%20(Pure%20Node.js)-success.svg)](https://nodejs.org)
[![Specification: OKF 0.2](https://img.shields.io/badge/Specification-Google%20OKF%20v0.2-green.svg)](https://cloud.google.com/blog)

---

## 30-Second Quick Start (100% Offline, Zero Dependencies)

Install and run locally in any Node.js 18+, Bun, or Deno environment with **zero network requests and zero API keys required**:

```bash
npm install @mudraforge/statutory
```

```javascript
import { 
  lookupStatute, 
  calculateCorporateTaxMatVsConcessional, 
  evaluatePlaceOfSupplyAndLut,
  isStatuteActive 
} from '@mudraforge/statutory';

// 1. Instant offline statutory lookup (sub-1ms, zero network calls, zero API keys)
// Note: lookupStatute() is async and returns the full temporal envelope: { status, temporalStatus, statute, source }
const section = await lookupStatute('194Q');
console.log(section.statute.title);
// => "Deduction of tax at source on payment of a certain sum for purchase of goods"

// 2. Deterministic Corporate Tax: MAT (Sec 115JB) vs Concessional (Sec 115BAA)
const tax = calculateCorporateTaxMatVsConcessional({
  turnoverPrecedingFyInr: 300000000, // ₹30 Cr turnover
  netProfitBeforeTaxInr: 100000000,  // ₹10 Cr NPBT
  normalTaxAdditionsInr: 10000000,   // ₹1 Cr additions
  normalTaxDeductionsInr: 2000000    // ₹20 Lakhs deductions
});
console.log(tax.comparisonSummary.recommendedRegime); // "SECTION_115BAA"
console.log(tax.comparisonSummary.netCashSavingsInr); // 3764800 (Net savings ₹37.64L)

// 3. Place of Supply & Zero-Rated Export of Services under LUT (IGST Sec 16)
const exportEvaluation = evaluatePlaceOfSupplyAndLut({
  supplierStateCode: '27',                     // Maharashtra
  recipientCountryCode: 'US',                  // United States
  hasValidLut: true,                           // Letter of Undertaking in Form GST RFD-11
  isConvertibleForexReceivedOrRbiInr: true,    // Sec 2(6)(iv) FIRC/e-BRC
  invoiceAmountInr: 500000                     // ₹5,00,000 export invoice
});
console.log(exportEvaluation.statutoryDetermination); // "ZERO_RATED_EXPORT_UNDER_LUT"
console.log(exportEvaluation.igstPayableInr);         // 0 (0% IGST)

// 4. Temporal Legislative Sunset Check
const isActive = await isStatuteActive('206C(1H)', '2025-06-01');
console.log(isActive); // false (Omitted w.e.f. 1 April 2025 by Finance Act, 2025)

// 5. Universal Statutory Virtual Machine (USVM) Subpath (<15µs latency, ~12 kB GZIP bundle)
import { evaluateStatutoryAst, getStatutoryAst } from '@mudraforge/statutory/usvm';

const ast194Q = getStatutoryAst('194Q');
const voucher = evaluateStatutoryAst(ast194Q, {
  invoiceAmount: 2000000,
  priorFyPurchases: 4500000,
  hasPan: true,
  transactionDate: '2026-03-15'
});
console.log(voucher.calculatedTdsInr); // 1500 (TDS on incremental excess)
console.log(voucher.isAuthorizedToDisburse); // false (Fiduciary invariant)
```

---

## Overview: Why We Open-Source Adesha's Statutory Substrate

In enterprise finance, no CFO, audit committee, or enterprise risk officer will permit an autonomous AI agent to propose payment instructions or touch the corporate general ledger if its tax withholding and regulatory logic is an opaque, black-box prompt. Large language models hallucinate tax rates, invert statutory obligations, and defend computational errors (*Rule 11: Agreement with the Engine ≠ Agreement with the Law*).

**MudraForge Adesha** resolves this through deliberate architectural separation:

1. **The Open Trust Anchor (This Package — `@mudraforge/statutory`)**: The deterministic statutory substrate. It structures 29 primary laws across 5 regulatory domains under Google's Open Knowledge Format (OKF v0.2), provides 7 pure mathematical calculators, and verifies legal ground truth with cryptographic Merkle integrity—100% offline with zero dependencies. Anyone can inspect, test, fork, or embed this layer freely in their own financial applications.
2. **The Governed Execution Platform (Adesha Enterprise Runtime)**: When an organization deploys Adesha, it receives the complete autonomous finance AI system: multimodal invoice interpretation, 3-way PO matching, deterministic statutory validation, single-use cryptographic payment leases, CFO biometric approval, host-to-host bank rail settlement, and balanced double-entry ERP general ledger writebacks (Zoho Books, SAP S/4HANA, NetSuite).

> **The Core Thesis of Autonomous Finance**:  
> *Reasoning can be probabilistic, but financial execution needs deterministic boundaries.*  
> Knowing what the law says is not the same as having authority to disburse funds. This package guarantees statutory truth; Adesha governs consequential execution.

> For cryptographic root digests, normative specifications, and formal assurance artifacts, see [docs/PROVENANCE.md](./docs/PROVENANCE.md).  
> For the enterprise execution platform architecture, see [docs/ENTERPRISE_GOVERNANCE.md](./docs/ENTERPRISE_GOVERNANCE.md).  
> To test Adesha against your historical accounting records in read-only shadow mode, see [docs/PILOT_EVALUATION_GUIDE.md](./docs/PILOT_EVALUATION_GUIDE.md).

---

## Table of Contents

- [30-Second Quick Start (100% Offline, Zero Dependencies)](#30-second-quick-start-100-offline-zero-dependencies)
- [Overview: Why We Open-Source Adesha's Statutory Substrate](#overview-why-we-open-source-adeshas-statutory-substrate)
- [Supported Application Patterns](#supported-application-patterns)
  - [1. AI Agents & LLM Tooling](#1-ai-agents--llm-tooling)
  - [2. Finance Software & Accounts-Payable Workflows](#2-finance-software--accounts-payable-workflows)
  - [3. Developer Tooling & Audit Verification](#3-developer-tooling--audit-verification)
- [Separation of Statutory Knowledge from Autonomous Execution](#separation-of-statutory-knowledge-from-autonomous-execution)
- [Statutory Authority & Epistemic Boundary](#statutory-authority--epistemic-boundary)
- [Project Identity, Audience & Non-Goals](#project-identity-audience--non-goals)
- [Published Inventory Metrics](#published-inventory-metrics)
- [Rationale: Authoritative Knowledge Substrate vs. Probabilistic Web RAG](#rationale-authoritative-knowledge-substrate-vs-probabilistic-web-rag)
- [Architectural Principle: Separation of Law & Deterministic Computation](#architectural-principle-separation-of-law--deterministic-computation)
- [System Origin & Validation Baseline](#system-origin--validation-baseline)
- [Legal Domains Currently Covered](#legal-domains-currently-covered)
- [Product Capability Status & Operational Boundaries](#product-capability-status--operational-boundaries)
- [Architectural Boundaries: Open Substrate vs. Hosted Edge vs. Adesha Platform](#architectural-boundaries-open-substrate-vs-hosted-edge-vs-adesha-platform)
- [Free OKF Sync and Maintenance Policy](#free-okf-sync-and-maintenance-policy)
- [Structured OKF Domain Hierarchy (Zero-Token Discovery)](#structured-okf-domain-hierarchy-zero-token-discovery)
- [Canonical Edge Synchronization (Full Statutory Universe)](#canonical-edge-synchronization-full-statutory-universe)
- [Agent Skills, CLI Tooling & CI/CD Verification](#agent-skills-cli-tooling--cicd-verification)
  - [1. Initialize AI Agent Skill](#1-initialize-ai-agent-skill)
  - [2. Direct Synchronous Local Read (lookupLocalStatute)](#2-direct-synchronous-local-read-lookuplocalstatute)
  - [3. CLI Verification, Auditing & Pipeline Integration](#3-cli-verification-auditing--pipeline-integration)
- [Commercial & Enterprise Platform Ecosystem](#commercial--enterprise-platform-ecosystem)
- [Developer Tooling & Verification Gates](#developer-tooling--verification-gates)
- [A Note from the Maintainer](#a-note-from-the-maintainer)
- [Institutional Documentation & Architecture](#institutional-documentation--architecture)
- [License](#license)

---

## Supported Application Patterns

`@mudraforge/statutory` serves as an authoritative reference layer and computation client across three distinct environments:

### 1. AI Agents & LLM Tooling
- **Current Implementation**: Generates a self-contained [`SKILL.md`](./SKILL.md) skill definition (`npx @mudraforge/statutory init-skill`) that connects agent runtimes directly to the local filesystem without external API calls or token bloat from search queries.
- **Integration Boundary**: Agents can read structured section definitions (`okf/**/section.json`) to discover rates, thresholds, and return filing schemas deterministically rather than relying on model parameter memory.

### 2. Finance Software & Accounts-Payable Workflows
- **Current Implementation**: Provides offline threshold logic (such as Section 194Q cumulative purchases exceeding ₹50 Lakhs) and legislative sunsets (Section 206C(1H) omission on 1 April 2025). The hosted enterprise tier provides deterministic calculation via `client.calculate()`.
- **Integration Boundary**: Custom accounting engines or enterprise middleware can invoke these functions via Node.js or REST endpoints. *(Note: This package exposes standard programmatic and JSON interfaces; it does not ship pre-packaged ERP plugins for third-party platforms).*

### 3. Developer Tooling & Audit Verification
- **Current Implementation**: CLI commands (`browse`, `lookup`, `list`, `check-update`) allow developers and tax compliance teams to inspect verified primary citations, download statutory checklists (such as Form 3CEA slump sale audit requirements), and verify dual-act forward crosswalks between the 1961 and 2025 Income-tax Acts.
- **Integration Boundary**: Usable standalone in terminal environments, continuous integration (CI) compliance checks, or custom tax tooling.

---

## Separation of Statutory Knowledge from Autonomous Execution

A fundamental design invariant of MudraForge is: **Knowing what the law says is not the same as having authority to disburse corporate funds.**

- **The Open-Source Commons (`@mudraforge/statutory`)**: Provides declarative statutory truth, temporal boundaries, and pure deterministic calculators. All functions enforce `isAuthorizedToDisburse: false`. Calculation never authorizes autonomous money movement.
- **The Governed Execution Platform (Adesha)**: Manages consequential real-world operations—single-use payment authorization leases, dual-custody mobile authorization, banking rail integration, and balanced ERP general ledger writebacks.

> For complete enterprise architecture specifications, TLC model checking proofs, and the 7-stage AP governance lifecycle, see [docs/ENTERPRISE_GOVERNANCE.md](./docs/ENTERPRISE_GOVERNANCE.md).  
> To run a local simulation of the modeled 7-stage AP trace: `npm run example:trace`.

---

## Statutory Authority & Epistemic Boundary

- **Primary Legislation & Official Circulars**: Statutory texts, executive circulars, notifications, and compliance forms in this repository are structured transpositions of official publications issued by the Ministry of Finance (CBDT/CBIC), Ministry of MSME, Ministry of Corporate Affairs (MCA), and the US Internal Revenue Service (IRS). Official government source material remains the sole statutory authority.
- **Open Knowledge Format (OKF v0.2) & Companion Model**: This repository implements Google's Open Knowledge Format (OKF v0.2) for portable knowledge publication (Markdown circulars, YAML frontmatter, trust anchors, and `okf.publication.json`). It extends the format with the **MudraForge Statutory Schema Extension** (`section.json`, `forms/*.json`) to capture strict transactional threshold parameters, tax rate determinants, and dual-act mappings needed by accounting software and autonomous agents.
- **Deterministic Runtime Separation**: Mathematical execution (cumulative threshold deductions, multi-interval monthly compound interest, double-entry ledger writebacks, and single-use payment leases) is evaluated independently by the MudraForge Adesha Governance Engine on Cloudflare Anycast Edge. Reference metadata published in this package does not constitute formal legal counsel or statutory audit certification.

---

## Project Identity, Audience & Non-Goals

### Purpose & Intended Audience
`@mudraforge/statutory` publishes an open, machine-readable statutory knowledge substrate for software engineers building financial AI agents (Antigravity, Cursor, Claude Code, Copilot), ERP integration teams (Tally, SAP, Zoho Books, NetSuite), Chartered Accountants, and compliance automation engineers.

### What OKF Compatibility Means
Provisions in this repository adhere to the **Open Knowledge Format (OKF v0.2)** specification:
- **Declarative Knowledge**: Legal rules are structured into clean, machine-readable JSON (`section.json`), official administrative circulars with YAML frontmatter (`.md`), and compliance return schemas.
- **Companion Extension**: While Google's OKF v0.2 standardizes Markdown-based knowledge with YAML frontmatter, MudraForge provides a companion data model (`section.json`) to express transactional tax thresholds, rate structures, and dual-act cross-compilation maps.
- **Temporal State Machines**: Strict `validFrom`, `validTo`, and `annualReset` boundaries preventing retrospective hallucination and catching legislative sunsets (e.g. Section 206C(1H) sunset on 1 April 2025).
- **Trust Anchors**: Every provision binds to authoritative primary sources: the Gazette of India, CBDT/CBIC executive circulars, or Ministry notifications (`incometax.gov.in`, `cbic-gst.gov.in`, `msme.gov.in`, `irs.gov.in`).
- **Cryptographic Provenance**: Bundled files are verifiable against a deterministic SHA-256 Merkle root hash.

### Explicit Non-Goals
1. **Not Legal or Tax Advice**: This package structures public legal instruments into machine-readable data. It does not provide formal legal counsel, tax opinions, or statutory audit certification.
2. **Not a Universal Legal Library**: Unlike broad legal repositories (*IndiaCode*, *Open India Law*), this project does not compile general civil, criminal, or constitutional case law. It focuses strictly on **transactional finance, direct/indirect taxation, and commercial AP compliance**.
3. **Not an ERP or Payment Rail**: This package provides declarative ground truth to AI agents and software pipelines; it does not store accounting ledgers, move money, or replace enterprise ERPs.

---

## Published Inventory Metrics

The repository currently publishes a verified inventory across five regulatory domains, accompanied by official executive guidance, compliance schemas, and deterministic calculation engines:

- **5 Foundational Regulatory Domains**: Direct Tax (TDS/TCS & Corporate Tax), Indirect Tax (GST & Export LUT), MSME & Working Capital, International Tax & Transfer Pricing, Corporate M&A Restructuring & Ind AS.
- **29 Indexed Core Provisions**: Section 194Q, Section 194J, Section 194C, Section 194I, Section 194H, Section 206C(1H) sunset, Section 393 (Act 2025 crosswalk), Section 115BAA & 115JB (Corporate Tax MAT vs Concessional Regime), CGST Section 16(2) (ITC conditions & 180-day rule), CGST Section 17(5) (blocked credits), IGST Section 16 & Section 2(6) (Zero-Rated Export under LUT), MSMED Act Sections 15 & 16, US IRC §§ 901 & 904, Section 92C & Rule 10CA (Transfer Pricing ALP), Section 79 & Section 32(2) (Loss Carry-Forward & Virmani Doctrine), Section 50B (Slump Sale & Successor Liability), and Ind AS 21 & Ind AS 109 (Foreign Exchange Revaluation).
- **30 Official Executive Circulars & Memoranda**: CBDT Circular 13/2021, CBDT Circular 23/2017, CBDT Circular 03/2020, CBDT Circular 29/2019, CBDT Circular 09/2020, CBDT Notification 86/2015, Finance Act 2024 Rate Cut Memo, Finance Act 2025 Sunset Memorandum, CBIC Circular 170/02/2022-GST, CBIC Circular 172/04/2022-GST, CBIC Circular 161/17/2021-GST, Ministry of MSME OM 1/4(1)/2021-P&G/Policy, MCA Ind AS 21 Rules, CBDT Notification 68/2021 (Rule 11UAE FMV), CBIC Notification 12/2017 Entry 2.
- **27 Compliance Form Schemas & Verification Checklists**: Form 26Q quarterly TDS return, Form 16A certificate, Form 10-IC concessional tax election, Form GST RFD-11 LUT declaration, Form 3CEB transfer pricing report, Section 79 continuity schedule, Ind AS 109 hedge reserve schedule, Transporter declaration, GSTR-3B Table 4 reversal/reclaim reconciliation, GSTR-2B Table 4(B) ineligible ITC reconciliation, UDYAM portal registration verification, Companies Act Schedule III corporate balance sheet notes, Form 67 (Rule 128), US IRS Schedule K-3, Form 3CEA CA slump sale report schema, Section 281 & Section 313 M&A tax due diligence checklist, and Vendor PAN / Section 206AB declarations.
- **7 Zero-Dependency Deterministic Calculators**: Pure, mathematical computation engines for: (1) Corporate Tax MAT vs 115BAA (`calculateCorporateTaxMatVsConcessional`), (2) Place of Supply & LUT Export (`evaluatePlaceOfSupplyAndLut`), (3) Transfer Pricing ALP & Rule 10CA (`calculateTransferPricingArmLength`), (4) Section 79 Loss Carry-Forward & Virmani Doctrine (`evaluateSection79LossContinuity`), (5) Ind AS 21 & 109 Forex Revaluation (`calculateForexRevaluationIndAs`), (6) Section 16 MSMED Compound Interest (`calculateMsmeCompoundInterest`), and (7) Section 288B Tax Rounding (`roundTaxSection288B`) — accompanied by 27 core TDS/TCS statutory withholding calculators in `@mudraforge/statutory/calculators`.
- **100% Corpus Verification Suite**: Validated with 88/88 test suites passing, 108 primary citations with deep semantic integrity, and cryptographically pinned Merkle root.

---

## Rationale: Authoritative Knowledge Substrate vs. Probabilistic Web RAG

When autonomous AI agents and developer applications (Cursor, Claude, Copilot, Antigravity, or custom enterprise finance systems) evaluate Indian and cross-border tax compliance, they typically face two systemic failure modes:

1. **Frozen, Outdated Model Weights**: Foundation models hallucinate rates, cite provisions repealed in prior Finance Acts, or invert statutory withholding obligations (such as continuing to mandate Section 206C(1H) collection following its statutory omission on 1 April 2025).
2. **Unstructured Web Search (Web RAG)**: When agents search the public web for statutory sections, they ingest conflicting third-party summaries: commercial search-engine-optimized blogs from 2018–2022, unverified discussion forums, and marketing writeups that omit crucial legislative provisos (such as CBDT Circular 13/2021 unbundling GST from the TDS base, or Ministry of MSME OM 2/1(5)/2021 strictly excluding retail and wholesale traders). This consumes excessive context tokens, introduces 3–5 seconds of latency, and feeds noisy, contradictory context into the reasoning loop.

`@mudraforge/statutory` resolves this by providing an **unambiguous, structured, offline-capable statutory knowledge vault** under Google's Open Knowledge Format (OKF v0.2). Provisions are organized with definitive section codes, operative dates, legislative sunset boundaries, primary citations, thresholds, and audit checklists.

---

## Architectural Principle: Separation of Law & Deterministic Computation

A foundational rule of financial systems: **Providing an LLM with the raw text of a statute does NOT ensure the model will compute or enforce it correctly.**

Large Language Models are probabilistic token sequence predictors, not deterministic arithmetic processors. When an LLM evaluates Section 194Q ("deduct 0.1% on purchase of goods exceeding ₹50 Lakhs"):
- It frequently computes 0.1% on the aggregate transaction value rather than the incremental excess over ₹50 Lakhs.
- It fails to calculate monthly compound penal interest at 3 times the RBI Bank Rate under MSMED Act Sections 15 & 16 across multi-quarter intervals.
- When challenged on computational mistakes, generative models defend erroneous figures due to the **Epistemic Confirmation Loop** (*"Agreement is not truth"*).

**To resolve this, MudraForge enforces a strict Separation of Powers**:
- **The Free OKF Commons (This Package)** provides the declarative knowledge representation: verified statutory thresholds, legal summaries, executive circulars, and compliance return schemas.
- **The Paid Cloud Engine** provides the **deterministic calculation engines**, System-1 semantic intent discovery, and multi-step statutory verification on Cloudflare Anycast Edge. Statutory arithmetic is never delegated to generative token prediction.

---

## System Origin & Validation Baseline

`@mudraforge/statutory` publishes the declarative statutory rules, executive circulars, and return schemas developed internally at MudraForge to feed its autonomous finance engine (Adesha). 

It is currently released as a **Public Beta**. The bundled schemas and temporal state machines have been verified internally against synthetic mutation suites, historical enterprise AP audit samples, and Chartered Accountant peer reviews before publication. It has not yet been subjected to third-party high-volume client production workloads, which is why we invite independent evaluation, verification, and community contributions.

---

## Legal Domains Currently Covered

> **Full 11-Domain Roadmap & Lifecycle Matrix**:  
> For the complete architectural matrix comparing the 5 starter domains against the full 11-domain sovereign roadmap (including Indian Accounting Standards [Ind AS], MCA Corporate Governance, and SEBI LODR), see [`docs/DOMAIN_BREADTH_AND_DEPTH_COMPARISON.md`](./docs/DOMAIN_BREADTH_AND_DEPTH_COMPARISON.md).

The OKF substrate currently indexes and enforces ground truth across five major regulatory domains:

### 1. Direct Tax (Income Tax & TDS/TCS)
- **Section 194Q**: 0.1% TDS on purchase of goods exceeding ₹50 Lakhs cumulative annual threshold (calculating strictly on the excess).
- **Section 206C(1H)**: TCS on sale of goods, with automated temporal interception of its **1 April 2025 sunset** under the Finance Act, 2025.
- **Section 194C**: Payments to contractors and sub-contractors (1% individuals, 2% companies/LLPs), single-invoice ₹30,000 / aggregate ₹1,00,000 thresholds, transporter 10-carriage exemption.
- **Section 194J**: Fees for Technical Services (2% FTS) vs. Professional Fees (10%), enforcing standard 20% non-PAN penalty rate under Section 206AA(1)(iii) / Section 397(2)(a).
- **Section 194I**: Rent withholding (2% plant & machinery, 10% land & building) exceeding ₹2.4 Lakhs annual threshold.
- **Section 194H**: Commission and brokerage withholding (2% amended rate w.e.f. 1 October 2024) exceeding ₹15,000 threshold.
- **Dual-Act Forward Mapping**: Complete cross-compilation bridge from the legacy *Income-tax Act, 1961* to the *Income-tax Act, 2025* (which took effect 1 April 2026), mapping historical provisions seamlessly (e.g., Section 194Q $\rightarrow$ Section 393(1), Table 1, Sl. No. 8(ii)).

### 2. Indirect Tax (Goods & Services Tax - GST)
- **CGST Section 8**: Composite and mixed supplies—naturally bundled supplies taxed at the principal supply rate under Section 8(a); unbundled supplies billed for a single price taxed at the highest rate under Section 8(b).
- **CGST Section 9(3)**: Reverse Charge Mechanism (RCM)—mandatory tax discharge by recipient strictly via Electronic Cash Ledger for notified categories (GTA, legal services, directors, security), self-invoicing under Section 31(3)(f), payment vouchers under Section 31(3)(g), and subsequent Section 16(2) ITC re-availment.
- **CGST Section 16(2)**: Core statutory conditions for availing Input Tax Credit (clauses a-d), mandatory supplier communication under Section 37/38 (GSTR-2B), Rule 37 180-day vendor payment reversal with Section 50 interest reported in Table 4(B)(2), subsequent re-availment in Table 4(A)(5) and Table 4(D)(1), RCM statutory exceptions, and Section 16(4) annual cutoff.
- **CGST Section 17(5)**: Comprehensive statutory negative list for Blocked Input Tax Credit (ITC)—including motor vehicles, catering, employee benefits, and the statutory employer obligation proviso under CBIC Circular 172/04/2022-GST.

### 3. Micro, Small & Medium Enterprises (MSME & Commercial)
- **MSMED Act, 2006 (Sections 15 & 16)**: Strict statutory payment clock (15 days without agreement, max 45 days with written agreement) and non-negotiable compound penal interest at **3 times the RBI Bank Rate** (compounded monthly).
- **Trader Exclusion Rule**: Automated enforcement of Ministry of MSME OM No. 1/4(1)/2021-P&G/Policy, strictly excluding wholesale and retail traders (NIC 45, 46, 47) from delayed payment protections and Section 43B(h) addbacks.
- **MCA Form MSME-1**: Companies Act, 2013 Section 405 mandatory half-yearly return (due October 31 & April 30) for trade payables outstanding beyond 45 days.
- **Section 22 & Schedule III Disclosures**: 5-point statutory Notes to Accounts, Trade Payables aging schedule (<1yr, 1-2yr, 2-3yr, >3yr), and Section 23 tax deduction add-back.
- **Section 7 Composite Classification**: Micro, Small, and Medium classification criteria (Investment + Turnover) with mandatory statutory deduction of export turnover under Notification S.O. 2119(E).

### 4. Cross-Border & International Tax
- **Section 195 & DTAA**: Outbound cross-border remittances to non-residents, Section 90(2) treaty rates, Tax Residency Certificate (TRC) Section 90(4), electronic Form 10F, Rule 37BB Form 15CA/15CB banking gate, and Supreme Court *Engineering Analysis* cloud SaaS royalty exemption.
- **US Internal Revenue Code (IRC §§ 901 & 904)**: Foreign Tax Credit (FTC) limitation baskets (General Category vs. Passive Category), Pass-Through Entity (PTE) tax pass-throughs, and Schedule K-3 dual-reporting compliance for Indo-US cross-border ventures.
- **Indian Rule 128 (Form 67)**: Statement of foreign tax credit compliance schema and filing deadlines.

### 5. Corporate M&A & Restructuring
- **Section 50B (Slump Sale)**: Capital gains computation on slump sale of undertakings based on Written Down Value (WDV) net worth under Section 43(6), Form 3CEA CA certification schema, and Section 281/313 tax clearance due diligence checklists.

---

## Product Capability Status & Operational Boundaries

To ensure absolute clarity for developers, finance leaders, prospective pilot customers, and investors, the capabilities of MudraForge are delineated below into working public software, hosted edge services, and internal/pilot enterprise runtime layers (see [ADR-0005](./docs/ARCHITECTURE_DECISIONS.md#adr-0005-formal-product-capability-status-register) for the authoritative architectural status register):

| Subsystem / Capability | Operational Classification | Availability / Access | Current Verification Evidence |
| :--- | :--- | :--- | :--- |
| **Bundled OKF Statutory Corpus (29 Provisions across 5 Domains)** | **Public Package** | Shipped in repository & release candidates (`okf/`) | 88/88 test suites passing; deterministic SHA-256 Merkle root |
| **Zero-Network CLI (`mudraforge-statutory`)** | **Public Package** | Immediate via `npx @mudraforge/statutory` | `bin/cli.js` verified across Windows and Linux |
| **Vendor-Neutral Conformance Suite** | **Public Package** | Immediate via `conformance/` (`npm run conformance`) | 12/12 fixture tests passing |
| **Local Query SDK (`src/index.js`)** | **Public Package** | Immediate via `import { lookupStatute }` | Zero runtime dependencies; offline temporal state evaluation |
| **Synthetic AP Execution Trace (`examples/`)** | **Public Package (Modeled Demo)** | Immediate via `npm run example:trace` | Synthetic invoice trace demonstrating 7-stage lifecycle with modeled fixtures |
| **Cloudflare Anycast Edge Sync** | **Public Edge Service** | Free Beta via `api.mudraforge.in` | Global edge sync (`npx @mudraforge/statutory sync`) with ETag 304 caching |
| **Interactive API Documentation** | **Public Edge Service** | Free Beta via `/api/v1/statutory/docs` | OpenAPI 3.1 schema and interactive documentation rendered on Anycast edge |
| **Deterministic Calculators (7 Pure Functions)** | **Public Package** | Immediate via `@mudraforge/statutory/calculators` | Corporate tax MAT vs 115BAA, GST POS/LUT, TP ALP, Section 79, Ind AS 109, Section 16 MSMED, Section 288B (plus 27 TDS/TCS calculators) |
| **Hosted AP Engine & Cumulative Spend Tracking** | **Enterprise Edge / Internal** | Metered Enterprise API (Selective) | Hosted Section 194Q cumulative spend & Section 16 MSMED interest engine |
| **Dual-Custody Mobile Approval Harness** | **Enterprise Internal / Pilot** | Enterprise Pilot Proposal | Mobile passkey approval prototype & TLA+ state machine (`specs/`) |
| **ERP Two-Way Connectors (SAP/Tally/Zoho)** | **Enterprise Internal / Pilot** | Custom Enterprise Pilot Integration | Shadow-mode test connectors; no turnkey plug-ins shipped |
| **Bank Rail API Adapters (ICICI/HDFC/RazorpayX)** | **Enterprise Internal / Pilot** | Custom Enterprise Pilot Integration | Modeled sandbox adapters requiring corporate bank partner onboarding |

> **Operational Distinction**: Items classified as **Public Package** and **Public Edge Service** represent working, independently inspectable software. Items classified as **Enterprise Internal / Pilot** represent developing or internal capabilities of the commercial Adesha runtime. Execution traces in `examples/` use synthetic test data; they do not represent active commercial bank or live customer ERP deployments. Organizations interested in testing MudraForge against real accounting data should review the [Supervised Shadow Pilot Evaluation Guide](./docs/PILOT_EVALUATION_GUIDE.md).

---

## Architectural Boundaries: Open Substrate vs. Hosted Edge vs. Adesha Platform

To ensure clarity for developers, CAs, and prospective enterprise clients, the operational separation between layers is summarized below:

| Dimension / Layer | Layer 1: Open Substrate (This NPM Package) | Layer 2: Hosted Edge API (Cloudflare Anycast) | Layer 3: Commercial Adesha Runtime (Enterprise Platform) |
| :--- | :--- | :--- | :--- |
| **Pricing & License** | **100% Free** (MIT Code / CC BY 4.0 Data) | **Best-Effort Free Beta** (Transitions to Metered) | **Commercial Enterprise SaaS** |
| **Execution Location** | 100% Local Filesystem (0 Network Calls) | Cloudflare Edge (Global 300+ PoPs, typical 20–80ms Anycast latency) | Private Enterprise VPC / On-Premise Worker |
| **Statutory Knowledge** | Bundled Starter Seed (29 Verified Sections across 5 Domains) | 29 Active Provisions (Roadmap Catalog in expansion) | Full Sovereign Catalog + Custom Private Enterprise Contracts |
| **Lookup Engine** | Exact code, alias & folder path resolution | System-1 Semantic Intent & Rule Discovery | Multi-tenant RAG & Context Assembler |
| **Temporal Status** | Offline deterministic evaluation (`computeTemporalStatus`) | Live temporal state machine resolution | In-flight temporal locks across transaction lifecycle |
| **Deterministic Calculators**| **Included** (7 Zero-dependency pure mathematical calculators exported in `src/calculators.js` via `@mudraforge/statutory/calculators`) | Hosted calculation endpoint (`POST /calculate`) | Full arithmetic engine with ₹50L excess & 3x RBI interest |
| **Payment Authorization** | *Not included* | *Not included* | **Single-Use Cryptographic Payment Leases (TLA+ verified)** |
| **Banking Execution** | *Not included* | *Not included* | **Host-to-Host Bank Rails (RazorpayX / ICICI / HDFC)** |
| **ERP Writebacks** | *Not included* | *Not included* | **Balanced double-entry journal writebacks (SAP / Zoho)** |
| **How to Access** | `npm install @mudraforge/statutory` | `npx @mudraforge/statutory sync` | Review [Supervised Shadow Pilot Guide](./docs/PILOT_EVALUATION_GUIDE.md) / Contact `hello@mudraforge.in` |

> **Operational Distinction**: This open-source repository provides the **declarative knowledge foundation**. It does not perform live banking transfers, hold funds, or mutate corporate ERP databases. Those consequential actions are strictly isolated within the **MudraForge Adesha Enterprise Governance Engine** (see [`docs/ENTERPRISE_GOVERNANCE.md`](./docs/ENTERPRISE_GOVERNANCE.md)).

---

## Free OKF Sync and Maintenance Policy

The MudraForge Statutory project publishes an open, locally usable statutory knowledge package under the MIT License. The hosted free sync service (`npx @mudraforge/statutory sync`) is provided on a best-effort basis and is not a guarantee of perpetual availability, comprehensive statutory coverage, or continuous updates.

- **Maintainer Capacity & Best-Effort Updates**: Future updates to the hosted free dataset depend on maintainer capacity, community contributions, infrastructure costs, and project priorities. The free sync service may have limited coverage, delayed updates, or periods without new releases.
- **Snapshot Provenance & User Responsibility**: Each published bundle explicitly identifies its release version, source provenance, and applicable verification or effective-date information. Users and AI agents are responsible for checking whether a statutory snapshot is current and suitable for their intended use.
- **Perpetual Local Freedom**: Users may continue to use, inspect, fork, and maintain previously released files subject to the MIT license.
- **Separation of Services**: Additional hosted services, expanded domain suites (covering all 11 enterprise domains), and maintained deterministic calculation engines are offered separately under commercial subscriptions.

---

## Structured OKF Domain Hierarchy (Zero-Token Discovery)

Rules are organized into **five foundational regulatory domains**, complete with official circulars, statutory notifications, and compliance form schemas:

```
okf/
├── manifest.json                                      # Cryptographic SHA-256 root hash & domain manifest
│
├── direct_tax/
│   ├── tds_goods_194q/
│   │   ├── section.json                               # 0.1% TDS on purchase excess over ₹50L
│   │   ├── circulars/
│   │   │   ├── cbdt_circular_13_2021_guidelines.md    # CBDT Q&A on threshold math & advance netting
│   │   │   └── cbdt_circular_23_2017_gst_unbundling.md# Exclusion of GST from TDS base
│   │   └── forms/
│   │       ├── form_26q_quarterly_return.json         # Form 26Q quarterly TDS reporting schema
│   │       └── vendor_pan_declaration.md              # Vendor PAN & Section 206AB declaration template
│   ├── tds_services_194j/
│   │   ├── section.json                               # 2% FTS vs 10% Professional fees
│   │   ├── circulars/
│   │   │   └── cbdt_circular_03_2020_fts_rate_cut.md  # FTS 2% rate reduction guidelines
│   │   └── forms/
│   │       └── form_16a_tds_certificate.json          # Form 16A quarterly TDS certificate schema
│   └── tcs_goods_206c_1h/
│       ├── section.json                               # Section 206C(1H) sunset on 1 April 2025
│       └── circulars/
│           └── finance_act_2025_sunset_memo.md        # Finance Act 2025 omission memo
│
├── indirect_tax_gst/
│   └── blocked_itc_17_5/
│       ├── section.json                               # CGST 17(5) blocked credit negative list
│       ├── circulars/
│       │   └── cbic_circular_172_2022_employer_obligations.md # Statutory employer obligation exception
│       └── forms/
│           └── gstr_2b_ineligible_reconciliation.json # GSTR-2B vs 3B Table 4(B) reporting schema
│
├── msme_commercial/
│   └── delayed_payments_15_16/
│       ├── section.json                               # 45-day clock, 3x RBI interest & 43B(h)
│       ├── circulars/
│       │   └── msme_om_2021_trader_exclusion.md       # Retail/wholesale trader exclusion rule
│       └── forms/
│           ├── udyam_registration_verification.json   # UDYAM portal certificate validation schema
│           └── schedule_iii_msme_disclosure.md        # Balance Sheet Schedule III disclosure format
│
├── international_tax/
│   └── foreign_tax_credit_irc_901_904/
│       ├── section.json                               # US Foreign Tax Credit limitation baskets
│       └── forms/
│           ├── form_67_statement_of_foreign_tax.json  # Indian Income Tax Form 67 (Rule 128)
│           └── irs_schedule_k3_reporting.json         # US IRS Schedule K-3 dual-reporting schema
│
└── corporate_ma_restructuring/
    └── slump_sale_50b/
        ├── section.json                               # Section 50B slump sale & net worth rules
        ├── circulars/
        │   ├── cbdt_notification_68_2021_rule_11uae_fmv.md # Rule 11UAE Fair Market Value formula
        │   └── cbic_notification_12_2017_going_concern_exemption.md # 0% GST going concern exemption
        └── forms/
            ├── form_3cea_chartered_accountant_report.json # Form 3CEA CA slump sale report schema
            └── section_281_tax_clearance_checklist.md # Section 281 & 313 due diligence checklist
```

Because the folder hierarchy separates legal domains and provisions cleanly, an AI agent browsing the folder can identify the applicable statute, circular, or compliance form at **0 token cost**.

---

## Canonical Edge Synchronization (Full Statutory Universe)

The package bundles an initial curated baseline snapshot across all five domains. **To pull the complete, continually expanding statutory catalog from the Cloudflare Anycast edge API into your local workspace:**

```bash
# Step 1: Check if newer statutes, circulars, or gazette amendments exist on the edge
npx @mudraforge/statutory check-update

# Step 2: Synchronize the complete statutory bundle directly to your local ./okf/ directory
npx @mudraforge/statutory sync

# Step 3: Browse your full local statutory library interactively
npx @mudraforge/statutory browse
```

---

## Agent Skills, CLI Tooling & CI/CD Verification

### 1. Initialize AI Agent Skill
Installs `SKILL.md` into your workspace's `.agents/skills/` directory for Claude Code, Cursor, Antigravity, or Copilot:
```bash
npx @mudraforge/statutory init-skill
```

### 2. Direct Synchronous Local Read (lookupLocalStatute)
```javascript
import { lookupLocalStatute } from '@mudraforge/statutory';

// Direct synchronous read from local disk (zero network calls, zero async overhead)
// Note: lookupLocalStatute() returns the unwrapped statute object directly.
// (Use async lookupStatute() when you need the complete temporal envelope: { status, temporalStatus, statute, source })
const statute = lookupLocalStatute('194Q');
console.log(statute.title);
console.log(statute.keyStatutoryThresholds.taxableBaseScope);
// => "Tax is deductible strictly on the excess over ₹50 Lakhs, NOT on the aggregate gross turnover."
```

### 3. CLI Verification, Auditing & Pipeline Integration

The CLI provides cryptographic provenance checking, offline integrity verification, and machine-readable JSON output for CI/CD audit pipelines:

```bash
# Run full environment, local substrate health, and edge latency diagnostics
npx @mudraforge/statutory doctor

# Force air-gapped / offline diagnostics (zero outbound network requests)
npx @mudraforge/statutory doctor --offline

# Cryptographically verify local statutory substrate integrity & origin authenticity
npx @mudraforge/statutory verify

# Dual-act 1961 <-> 2025 statutory crosswalk (earlier of credit vs payment)
npx @mudraforge/statutory crosswalk 194Q --credit 2026-03-25 --payment 2026-04-10

# Reverse crosswalk from 2025 Act provision
npx @mudraforge/statutory crosswalk 393 --date 2025-08-01

# Query semantic regulatory changelog and amendment tracker
npx @mudraforge/statutory diff --section 194H
npx @mudraforge/statutory diff --since 2025-01-01
npx @mudraforge/statutory diff --domain indirect_tax_gst

# Inspect statutory outcomes, semantic disposition codes, and missing facts
npx @mudraforge/statutory outcomes
npx @mudraforge/statutory outcomes 194Q
npx @mudraforge/statutory outcomes 194Q --verbose
npx @mudraforge/statutory outcomes MSMED-15-16

# In-depth explanation of indeterminate states, missing facts & remediation steps
npx @mudraforge/statutory explain INDETERMINATE
npx @mudraforge/statutory explain BUYER_TURNOVER_UNVERIFIED
npx @mudraforge/statutory explain MISSING_EVIDENCE_HOLD

# Check package updates or snooze notifications for current version
npx @mudraforge/statutory check-update
npx @mudraforge/statutory check-update --ignore

# Output machine-parseable JSON for CI/CD or jq integration
npx @mudraforge/statutory crosswalk 194Q --credit 2026-03-25 --payment 2026-04-10 --json
npx @mudraforge/statutory diff --section 194H --json
npx @mudraforge/statutory outcomes 194Q --json
npx @mudraforge/statutory explain BUYER_TURNOVER_UNVERIFIED --json
npx @mudraforge/statutory verify --json
npx @mudraforge/statutory doctor --json --offline

# Query section in pure JSON format
npx @mudraforge/statutory lookup 194Q --json

# Decode and validate PAN / GSTIN offline with ISO Mod-36 checksum
npx @mudraforge/statutory decode-id 27AAPFU0939F1ZV --json
```

#### Custom MudraForge Exit Code Contract
Calling pipelines and CI/CD audit steps can inspect `$?` directly:

| Exit Code | Classification | Meaning |
|---|---|---|
| `0` | `SUCCESS` | Substrate verified authentic, intact, and all baseline provisions present. |
| `1` | `USAGE_OR_OPERATIONAL_ERROR` | Invalid CLI arguments, unknown command, or syntax error. |
| `2` | `INTEGRITY_OR_SECURITY_VIOLATION` | Cryptographic signature failure, unpinned root hash, file tampering, or revoked key. |
| `3` | `STATUTORY_POLICY_VIOLATION` | Statutory policy failure (e.g. missing mandatory baseline provision or sunset violation). |


---

## Commercial & Enterprise Platform Ecosystem

`@mudraforge/statutory` is the open-source, zero-dependency statutory ground-truth substrate of the MudraForge ecosystem. For organizations requiring consequential financial execution, hosted agent tools, or managed infrastructure:

### 1. Governed Execution Platform (MudraForge Adesha)
While `@mudraforge/statutory` calculates what the law requires, **Adesha** governs real-world financial execution:
- **Single-Use Payment Authorization Leases**: Atomic Compare-and-Swap (CAS) leases cryptographically bound to invoice hash, vendor legal entity, and authorized net wire amount.
- **Human-in-the-Loop Authority Harness**: Maker-checker workflows requiring CFO biometric passkey approval.
- **Host-to-Host Banking Rail Integration**: Dispatches payouts via corporate banking gateways with signed webhook verification and clearinghouse reversal interception.
- **ERP General Ledger Writebacks**: Automatically posts balanced double-entry vouchers to Zoho Books, SAP S/4HANA, or NetSuite upon settlement confirmation.
- *Detailed Architecture*: See [docs/ENTERPRISE_GOVERNANCE.md](./docs/ENTERPRISE_GOVERNANCE.md).

### 2. Hosted Model Context Protocol (MCP) Infrastructure
In accordance with our commercial boundary protocol:
- **Enterprise-Tier Tooling**: Hosted Model Context Protocol (MCP) server endpoints and live multi-agent tool connectivity are strictly commercial/enterprise features.
- **Enterprise Setup**: Connecting MCP clients (Claude Desktop, Cursor, Windsurf, or Antigravity) connects to enterprise-licensed infrastructure and requires an Enterprise API Key.
- Contact: `hello@mudraforge.in` / `support@mudraforge.in`.

### 3. Hosted Edge API & Continuous Synchronization
- **Hosted Edge Calculation (`/api/v1/statutory/calculate`)**: Optional cloud-hosted calculation service on Cloudflare Anycast edge for organizations integrating via REST rather than the Node.js package.
- **Continuous Regulatory Sync**: SLA-backed automated updates tracking Gazette of India notifications, CBDT circulars, and Finance Act amendments.

---

## Developer Tooling & Verification Gates

The repository enforces fail-closed automated verification for schemas, temporal rules, and cryptographic digests:

```bash
# 1. Run full 88-suite multi-domain regression test
npm test

# 2. Validate all OKF schemas, circular YAML frontmatter, and return forms
npm run validate

# 3. Verify cryptographic SHA-256 Merkle root integrity
npm run manifest:check

# 4. Deterministically rebuild CATALOG.md from the statutory corpus
npm run catalog
```

---

## A Note from the Maintainer

Hi, I am Mondeep Engti, the founder of MudraForge and the current maintainer of `@mudraforge/statutory`.

I am building this project because I believe that statutory compliance knowledge—the rules that govern commercial trade, taxation, MSME working capital, and enterprise accountability—should not be locked inside expensive proprietary silos or hallucinated by ungrounded black-box AI models. It should be open, machine-readable, and mathematically verifiable by anyone.

This repository is part of a deliberate two-tier architecture:
1. **The Public Commons (`@mudraforge/statutory`)**: Provides declarative, zero-dependency statutory ground truth under Google's Open Knowledge Format (OKF v0.2) with cryptographic Merkle verification. It is 100% free, inspectable, and locally usable for developers, researchers, and Chartered Accountants.
2. **The Commercial Platform (Adesha)**: Builds on top of this foundation to deliver an autonomous enterprise finance runtime—providing deterministic calculation engines, two-way ERP reconciliation, and single-use cryptographic payment leases governed by human authorization.

**This project is currently maintained by a solo founder.** That means development velocity, review capacity, and update cadences have real limits. The hosted edge sync is provided on a best-effort basis, while the bundled local package is guaranteed to remain fully functional offline indefinitely.

I open-sourced this layer because critical financial infrastructure benefits from public inspection, adversarial testing, and community contributions. Whether you are an engineer building financial AI agents, a Chartered Accountant auditing tax withholding, or a compliance practitioner, your feedback, pull requests, and bug reports are genuinely welcome.

If you are working on autonomous financial systems or want to discuss the roadmap, you can reach me directly at **mondeepe@gmail.com** or **hello@mudraforge.in**.

— Mondeep Engti, Founder & Maintainer

---

## Institutional Documentation & Architecture

All deep-dive architectural specifications, governance boundaries, quality reports, and catalogs are organized in the [`docs/`](./docs/) directory:

- **[Statutory Knowledge Catalog](./docs/CATALOG.md)**: Full table of all indexed provisions, key thresholds, and return schemas.
- **[Domain Breadth & Depth Comparison](./docs/DOMAIN_BREADTH_AND_DEPTH_COMPARISON.md)**: 5-domain starter commons vs. 11-domain edge roadmap.
- **[Architecture Decisions (ADRs)](./docs/ARCHITECTURE_DECISIONS.md)**: Formal architecture decision records (ADR-0001 through ADR-0006).
- **[Architecture Specification](./docs/ARCHITECTURE.md)**: Master specification of the Adesha Sovereign Runtime & Statutory Engine.
- **[Corpus Quality Card](./docs/CORPUS_QUALITY.md)**: Machine-verified citation health, temporal bounds, and dual-act coverage.
- **[Enterprise Governance Boundary](./docs/ENTERPRISE_GOVERNANCE.md)**: Operational firewall between open knowledge and governed execution.
- **[Adesha Assurance Overview](./docs/ADESHA_ASSURANCE_OVERVIEW.md)**: Formal TLA+ specifications and mutation testing defenses.
- **[Verification Specification](./docs/VERIFICATION.md)**: Multi-domain test harness and conformance criteria.
- **[Data Licensing & Attribution Policy](./docs/DATA_LICENSING.md)**: Tripartite legal licensing boundary (MIT code, CC BY 4.0 structured schemas, public domain statutes).

### Community & Contribution Standards
- **[Contributor Protocol](./CONTRIBUTING.md)**: Authoring standards for `section.json`, executive circulars, and CA empanelment.
- **[Security & Statutory Integrity Policy](./SECURITY.md)**: Protocol for reporting code flaws and gazetted statutory amendments.
- **[Changelog](./CHANGELOG.md)**: Complete record of versioned releases, breaking changes, and migrations.

---

## License

- **Software Code & Tools**: Licensed under the **[MIT License](./LICENSE)**.
- **Derived OKF Schemas & Curated Summaries**: Licensed under the **[Creative Commons Attribution 4.0 International (CC BY 4.0)](./docs/DATA_LICENSING.md)**.
- **Primary Government Gazettes & Statutory Instruments**: Sourced under official public-domain and open government data terms (Republic of India Copyright Act, 1957 Section 52(1)(q) / US Code Title 17 Section 105). See **[DATA_LICENSING.md](./docs/DATA_LICENSING.md)** for details.
