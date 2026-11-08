# MudraForge Adesha — Supervised Shadow Pilot Evaluation Guide
## Benchmarking Autonomous Finance AI Against Historical Accounts Payable Records

> **Document Type**: Enterprise Pilot Specification  
> **System Under Evaluation**: MudraForge Adesha (Autonomous Finance AI)  
> **Open Trust Anchor**: `@mudraforge/statutory` (MIT Zero-Dependency Substrate)  
> **Execution Mode**: Supervised Read-Only Shadow Execution (Archival AP Records)  
> **Target Audience**: Chief Financial Officers (CFOs), Heads of Tax, Accounts Payable Directors, Enterprise Risk Officers  

---

## 1. Executive Context & Purpose

This document specifies the protocol for conducting a **Supervised Shadow Pilot** of MudraForge Adesha within an enterprise finance department.

In high-consequence corporate finance, autonomous systems must establish empirical accuracy and deterministic reliability before receiving operational authority. Modern accounts payable operations face immense regulatory pressure across direct tax withholding (TDS/TCS), commercial delayed payment laws (MSMED Act, Section 43B(h)), and evolving statutory transitions (the transition from the Income-tax Act, 1961 to the Income-tax Act, 2025). Human AP clerks and rigid rule engines frequently make systematic errors on cumulative thresholds, gross vs. basic tax bases, and legislative sunset dates.

MudraForge Adesha is an autonomous finance AI engineered to govern end-to-end accounts payable workflows. Rather than requesting live operational authority on day one, Adesha is evaluated in a **supervised shadow mode** against historical, customer-approved accounts payable datasets. 

In this mode, Adesha reconstructs past vendor invoices, line items, and payment cycles in read-only memory, compares its deterministic legal determinations and simulated double-entry journal postings against the enterprise's historical enterprise resource planning (ERP) ledger entries, and generates an audit-grade reconciliation report highlighting variances, compliance risks, and cash-flow exposures.

### The Role of the Open Trust Anchor (`@mudraforge/statutory`)
A foundational risk in applying AI to enterprise finance is the hazard of ungrounded generative hallucinations. Adesha addresses this through architectural decoupling:
- **Autonomous Reasoning & Governance (Adesha Proprietary Platform)**: Ingests unstructured invoices, interprets complex scopes of work, arbitrates commercial discrepancies, and formulates payment authorization leases.
- **Deterministic Statutory Substrate ([`@mudraforge/statutory`](https://www.npmjs.com/package/@mudraforge/statutory))**: An open-source, zero-dependency legal knowledge format (OKF v0.2) and deterministic mathematical engine. All statutory determinations, cumulative thresholds, and tax formulas are calculated deterministically. Enterprise tax counsel and internal audit teams can inspect, verify, and run this substrate locally on-premise without external network communication.

---

## 2. Core Pilot Objectives

The Supervised Shadow Pilot benchmarks Adesha's autonomous decision-making against settled historical records across five primary compliance domains:

1. **Withholding Tax (TDS/TCS) Classification & Rate Application**:
   - Proper section categorization: Section 194C (Contractors: 1% individual vs. 2% company), Section 194J (Technical Services 2% vs. Professional 10%), Section 194I (Rent: 2% machinery vs. 10% land/building), and Section 194H (Commission: 2% post-October 2024 vs. 5% prior).
   - Higher rate withholding for non-filers under Section 206AB (pre-1 April 2025) and invalid/inoperative PANs under Section 206AA (20% flat).
2. **Cumulative Financial-Year Threshold & Excess Math**:
   - Verification of cumulative purchase gates under Section 194Q: ensuring withholding is calculated strictly on the incremental purchase value exceeding ₹50 Lakhs within the financial year, rather than the entire invoice amount.
   - Aggregate contractor thresholds under Section 194C (single invoice > ₹30,000 or aggregate > ₹1,00,000).
3. **GST Basic Value Unbundling Adherence**:
   - Verifying adherence to CBDT Circular No. 23 of 2017: confirming withholding was applied strictly to the basic taxable value and not computed on gross invoice totals inclusive of separately itemized CGST, SGST, or IGST.
4. **Legislative Sunsets & Dual-Act Temporal Crystallization**:
   - Confirming that seller TCS under Section 206C(1H) was omitted for transactions on or after 1 April 2025.
   - Governing withholding crystallization by the earlier-event rule (earlier of credit in books or payment disbursement), correctly distinguishing between the Income-tax Act, 1961 and the Income-tax Act, 2025 (effective 1 April 2026).
5. **MSME Delayed Payment Compliance & Section 43B(h)**:
   - Tracking statutory payment clocks under Sections 15 and 16 of the MSMED Act, 2006 (15 days for unwritten terms, maximum 45 days for written agreements).
   - Flagging compound interest liabilities at three times the RBI repo rate and identifying disallowance risks under Section 43B(h) of the Income-tax Act for amounts unpaid to Micro and Small suppliers at fiscal year-end, while applying the statutory trader exclusion (Office Memorandum 2/1(5)/2021).

---

## 3. Candidate Ingestion Schema & Phased Staging

To minimize operational demands on enterprise accounting personnel, the pilot follows a two-stage progressive protocol:

### Phase 1: Calibration & Field Alignment (30 to 50 Historical Invoices)
A representative batch of 30 to 50 settled vendor invoices with known tax and payment outcomes is ingested. This phase validates data field mappings, verifies vendor classification schemas, and establishes baseline reconciliation rules with negligible customer effort.

### Phase 2: Comprehensive Historical Shadow Benchmark (200 to 500 Historical Invoices)
Following Phase 1 calibration, the evaluation expands to a full quarter's transaction volume (200 to 500 invoices). This volume enables robust validation of cumulative vendor spend thresholds (Section 194Q, Section 194C) and multi-month MSME payment clock tracking.

### Data Ingestion Parameters
The customer provides an archival tabular export (CSV, XLSX, or JSON extract) containing the following fields:

| Field Group | Required Parameters | Analytical Purpose in Shadow Pilot |
| :--- | :--- | :--- |
| **Transaction Metadata** | Invoice Number, Invoice Date, ERP Booking Date | Establishes temporal validity, accounting credit timestamp, and legislative regime. |
| **Vendor Identity** | Vendor Legal Name, Entity Type (Individual, LLP, Corporate), Vendor PAN, GSTIN | Determines applicable statutory rate tiers, corporate status, and Section 206AA rate penalties. |
| **Financial Values** | Basic Taxable Amount, Itemized CGST, SGST, IGST, Total Gross Invoice Value | Assesses adherence to GST unbundling standards vs. gross withholding. |
| **Historical ERP Classification** | Line-item description, historical TDS section applied, historical TDS amount withheld | Benchmarks human/ERP decisions against Adesha's deterministic statutory engine. |
| **Settlement Details** | Payment / Bank Clearance Date, Historical Payment Method, Bank UTR (if recorded) | Measures settlement intervals against MSMED Act statutory clocks. |
| **Vendor Master Attributes** | MSME Registration Category (Micro, Small, Medium, Trader), Udyam Number (if on file) | Drives MSME statutory interest calculations and Section 43B(h) disallowance risk analysis. |

---

## 4. Adesha Shadow Execution Pipeline

The Supervised Shadow Pilot operates entirely offline as a non-intrusive analytical pipeline:

```
[Customer Archival AP Extract]
              │
              ▼
┌────────────────────────────────────────┐
│  Phase 1: Ingestion & Input Validation │
│  - Field schema verification           │
│  - Tax identifier syntax validation    │
└────────────────────────────────────────┘
              │
              ▼
┌────────────────────────────────────────┐
│  Phase 2: Semantic Reasoning & Parsing │
│  - Scope of work analysis              │
│  - Contractual term classification     │
└────────────────────────────────────────┘
              │
              ▼
┌────────────────────────────────────────┐
│  Phase 3: USVM Declarative Grounding   │
│  (@mudraforge/statutory/usvm)          │
│  - Declarative AST rule evaluation     │
│  - Cumulative FY threshold evaluation  │
│  - 5-stage rational BigInt arithmetic  │
│  - Statutory withholding derivation    │
└────────────────────────────────────────┘
              │
              ▼
┌────────────────────────────────────────┐
│  Phase 4: Simulated AP Orchestration   │
│  - Single-use payment lease derivation │
│  - Double-entry ERP journal simulation │
└────────────────────────────────────────┘
              │
              ▼
┌────────────────────────────────────────┐
│  Phase 5: Reconciliation & Variance    │
│  - Delta analysis vs. historical ERP   │
│  - Fail-closed ambiguity isolation     │
└────────────────────────────────────────┘
              │
              ▼
[Advisory Discrepancy & Verification Report]
```

### The Fail-Closed Ambiguity Standard
In corporate finance, certain transactions contain contractual ambiguities that cannot be resolved solely from ledger metadata (for example, composite contracts spanning both equipment hardware supply and specialized engineering services).

- **Strict Fail-Closed Policy**: Adesha does not generate arbitrary tax assumptions or probabilistic guesses on ambiguous transactions.
- **Flagged Review Categories**: When archival data lacks necessary granularity (such as missing scope-of-work documentation or unbundled tax breakdowns), Adesha categorizes the item as `REQUIRES_HUMAN_REVIEW` accompanied by an explicit legal justification detailing the evidentiary prerequisite.

---

## 5. Pilot Deliverables & Tri-Part Variance Classification

At the conclusion of the evaluation, the enterprise finance leadership receives a comprehensive **Advisory Accounts Payable Discrepancy & Verification Report** comprising:

### 1. Executive Summary
- Total transaction count evaluated vs. records with complete statutory determinability.
- Aggregate count and value of historical transactions matching statutory baseline.
- Aggregate count and value of identified statutory variances and compliance risks.

### 2. Tri-Part Variance Classification Register
To provide actionable clarity without premature legal assumptions, all identified variances are categorized into three distinct classes:

- **Category A — Confirmed Calculation & Threshold Variances**:
  Direct mathematical, rounding, or threshold calculation errors on settled law. Examples include withholding tax deducted on gross invoice totals instead of net basic amounts, or Section 194Q applied to the full invoice rather than the excess over ₹50 Lakhs.
- **Category B — Statutory Rate & Classification Discrepancies**:
  Inconsistent statutory classifications where all transaction attributes (PAN, entity type, invoice date) are complete on the face of the record. Examples include applying Section 194C (2%) to professional services governed by Section 194J (10%), or applying Section 206C(1H) post-sunset.
- **Category C — Documentation Verification Checkpoints**:
  Instances where historical treatment differed from statutory defaults but may be legally substantiated by external documents not present in the tabular ledger. Examples include lower-withholding certificates issued under Section 197, goods transporter declarations under Section 194C(6), or MSME trader NIC classification exclusions. These items are presented as *verification checkpoints* for internal tax counsel rather than asserting non-compliance.

### 3. Statutory Audit Trail
Every identified variance includes direct, canonical citations to the governing statute, section number, official Gazette notification, and relevant CBDT/CBIC executive circular.

### 4. Shadow Double-Entry Journal Reconciliation
For every invoice, Adesha generates a simulated double-entry journal voucher (Debit Expense, Debit Input Tax, Credit Vendor Payable, Credit TDS Payable). This simulated voucher is compared against the historical ERP general ledger journal to highlight booking discrepancies.

### Analytical Scope & Boundary Commitments

| What the Supervised Shadow Pilot Demonstrates | What It Cannot Establish by Itself |
| :--- | :--- |
| Adesha accurately parses and interprets historical AP extracts. | Instantaneous ingestion of proprietary ERP schemas without initial field mapping. |
| Mathematical and statutory determinations strictly agree with independent tax ground truth. | Legal infallibility across non-standard or unresolved statutory litigation edge cases. |
| Complete audit traceability from every recommendation to primary gazette citations. | Guaranteed immediate financial recovery or cash tax refunds. |
| Repeat deterministic runs on identical archival inputs produce mathematically identical results. | Production-grade real-time banking security or live ERP multi-region high availability. |

---

## 6. Security, Confidentiality & Data Protection

Corporate accounts payable records contain commercially sensitive supplier pricing, bank account details, and corporate tax identifiers. The Supervised Shadow Pilot adheres to strict security protocols:

### Baseline Execution Boundaries
- **On-Premise / Private Cloud Execution**: The pilot engine and open `@mudraforge/statutory` substrate can run entirely within the enterprise's private network or local workstation environment with zero external data egress.
- **Strictly Read-Only Ingestion**: Adesha accesses only the historical extract provided by the customer. It possesses zero programmatic access to active ERP systems, production databases, or banking networks.

### Information Governance Protocols
Prior to ingesting customer records, standard enterprise safeguards are established:
1. **Bilateral Non-Disclosure Agreement (NDA)**: Protecting all vendor commercial terms, volume discounts, and operational financial metrics.
2. **Customer-Side Pseudonymization**: The enterprise may hash or redact sensitive identifiers (such as bank account numbers or internal vendor keys) prior to transmission.
3. **Data Disposal Mandate**: Certified cryptographic deletion of all evaluation datasets upon delivery and acceptance of the final audit report.

---

## 7. Strict Operational Safeguards

To maintain clear enterprise governance, the pilot operates under absolute operational restrictions:

- **Zero Live Ledger Mutations**: Adesha will not write back journals, alter vendor balances, or modify general ledger accounts in SAP, Zoho Books, NetSuite, Oracle, or Tally.
- **Zero Banking Rail Access**: Adesha does not connect to corporate banking APIs, initiate wire transfers, or hold authority to disburse funds.
- **Zero Regulatory Submissions**: Adesha will not generate or transmit Form 26Q quarterly returns or TDS challans to government portals.
- **Technical Advisory Designation**: All deliverables constitute technical compliance analysis and do not replace formal legal or statutory audit opinions from certified enterprise tax counsel.

---

## 8. Quantitative Evaluation & Acceptance Benchmarks

The success of the Supervised Shadow Pilot is measured against objective, pre-agreed quantitative benchmarks:

| Evaluation Benchmark | Objective Definition | Success Threshold |
| :--- | :--- | :--- |
| **Input Completeness** | Proportion of archival records with sufficient parameters to evaluate statutory applicability | $\ge 90\%$ of provided dataset |
| **Calculation Accuracy** | Agreement with settled statutory ground truth on unambiguous records | $100\%$ precision on verified provisions |
| **Ambiguity Isolation** | Strict fail-closed categorization of records lacking necessary documentation | $100\%$ isolation of uncertain records |
| **Citation Traceability** | Traceability of every flagged variance to deep primary government endpoints | $100\%$ verified canonical citations |
| **Deterministic Reproducibility** | Mathematical identity across repeat runs on the same input dataset | Zero variance across repeated runs |

---

## 9. Initiating a Supervised Shadow Pilot

To schedule an architecture review, receive sample ingestion schemas, or coordinate a Supervised Shadow Pilot for your finance organization:

- **Enterprise Inquiries**: [hello@mudraforge.in](mailto:hello@mudraforge.in) or [support@mudraforge.in](mailto:support@mudraforge.in)
- **Direct Founder Contact**: Mondeep Engti at [mondeepe@gmail.com](mailto:mondeepe@gmail.com)
- **Technical Architecture Documentation**: [https://mudraforge.in/docs](https://mudraforge.in/docs)
- **Open Trust Anchor Repository**: [https://github.com/MudraForge/mudraforge-statutory](https://github.com/MudraForge/mudraforge-statutory)
