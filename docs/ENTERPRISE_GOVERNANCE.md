# MudraForge Adesha: Enterprise Financial Governance Runtime
*Autonomous Execution Boundaries, Payment Authorization Leases, and Organizational Controls*

> **Document Type**: Architecture & Enterprise Governance Specification  
> **Target Audience**: Chief Financial Officers (CFOs), Heads of Finance, Enterprise Security & Risk Teams  
> **Underlying Substrate**: MudraForge Statutory Knowledge Layer (OKF) — [`@mudraforge/statutory`](../README.md)  

---

## 1. The Autonomous Execution Liability

When modern organizations adopt AI agents for finance operations, the primary risk is not that an LLM fails to answer a question. The catastrophic risk is **uncontrolled real-world execution**:

- An agent issuing duplicate vendor wires following a network timeout.
- An agent paying an altered bank account number following an unverified vendor email.
- An agent writing an unbalanced journal entry into the corporate general ledger.

MudraForge Adesha was designed to establish an impenetrable **Execution Boundary** between generative AI assistance and real-world money movement.

> **The Core Thesis of Autonomous Finance**:  
> *The dangerous moment in finance AI isn't when the model is wrong. It's when its output becomes a payment instruction.*  
> 
> In marketing, an AI hallucination is a typo. In accounts payable, an unhandled bank timeout can trigger a retry that double-pays a vendor.  
> 
> Hardening the financial runtime for **Adesha, MudraForge's organizational AI**, our principle is simple:  
> **Reasoning can be probabilistic, but financial execution needs deterministic boundaries.**

---

## 2. The Three-Tier Architecture & Operational Boundaries

To ensure complete clarity for developers, auditors, and enterprise clients, MudraForge establishes three distinct architectural tiers with strict operational boundaries:

| Tier | Component | Repository & Distribution | Pricing & License | Operational Status |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1** | **Open-Source Statutory Commons** (`@mudraforge/statutory`) | Public GitHub (`MudraForge/mudraforge-statutory`) & NPM Registry | **100% Free** (MIT License / CC BY 4.0 Data) | **`CURRENT_PRODUCTION`** (Working offline software) |
| **Tier 2** | **Hosted Statutory API & Edge Sync** | Cloudflare Global Anycast Edge (`api.mudraforge.in`) | Best-Effort Free Beta (Metered Cloud API) | **`CURRENT_BETA`** (Edge endpoints & caching) |
| **Tier 3** | **Commercial Adesha Runtime** | Enterprise Private VPC / On-Premise Worker Deployment | Commercial Enterprise SaaS | **`PILOT_STAGE_INTERNAL`** / **`SANDBOX_VALIDATED`** |

### Precise Status Classifications across Capabilities

To ensure epistemic honesty and prevent conflating tested prototypes with general availability:

- **`CURRENT_PRODUCTION` (Working, Publicly Inspectable Software)**:
  - Bundled OKF statutory corpus (55 provisions across 5 legal domains).
  - Universal Statutory Virtual Machine (USVM) declarative AST execution kernel (`@mudraforge/statutory/usvm`) with 64 verified AST rules.
  - Zero-network CLI (`mudraforge-statutory` doctor, crosswalk, diff, verify, browse).
  - Cryptographic SHA-256 Merkle root integrity verifier (`npm run manifest:check`).
  - Native AI Agent Skill (`SKILL.md`) for offline agent runtime inspection.

- **`SANDBOX_VALIDATED` (Tested Under Realistic Simulation & Integration Sandboxes)**:
  - Live Zoho Books general ledger balanced double-entry writeback (tested against sandbox and live accounts with readback).
  - RazorpayX corporate banking sandbox payout dispatch (`SETTLEMENT_LIVE_SANDBOX`), HMAC-SHA256 webhook ingestion, and clearinghouse reversal interception.
  - Multi-process lock contention testing verifying single-use lease acquisition across competing OS processes.

- **`PILOT_STAGE_INTERNAL` / `PLANNED` (Enterprise Engagements Requiring Partner Onboarding)**:
  - Direct host-to-host bank rail settlement (ICICI / HDFC corporate host-to-host RTGS/NEFT).
  - Multi-region distributed lease coordination across Cloudflare Durable Objects.
  - Hosted Model Context Protocol (MCP) server fleets and live multi-agent tool connectivity (strictly enterprise tier).

---

## 3. The Four Pillars of Autonomous Finance Execution

1. **Retrieval is Not Verification**: Finding a document or matching keywords is not legal verification. Real accounting requires validating evidence against connected systems of record (including live Zoho Books / SAP ERP readback) and authenticated tenant statutory vaults.
2. **Safe Tools Do Not Guarantee Safe Workflows**: An AI agent can call individually safe API tools and still coordinate an unauthorized or illegal transaction. Generative models coordinate investigations; deterministic code calculates statutory taxes and enforces ledger invariants (*Rule 11: Agreement with the Engine ≠ Agreement with the Law*).
3. **Preventing Silent Financial Drift**: Deterministic code computes numbers. RFC 8785 JSON Canonicalization Scheme (JCS) and SHA-256 bind calculation results to a verifiable fingerprint. The hash does not compute—it detects changes between calculation, human authorization, and execution. If the result no longer matches the fingerprint, the workflow halts.
4. **Testing Payment Boundaries Against Failure**: Single-use CAS leases prevent duplicate payments under concurrent races. Formal TLA+ modeling with the TLC Model Checker explored all 361 reachable states in our configured distributed model with 0 invariant violations and caught 4 injected defects.

---

## 4. Seven-Stage End-to-End AP Governance Lifecycle

Every financial transaction in MudraForge Adesha passes through seven sequential verification gates before any funds can move or any ledger can mutate:

```
Stage 1: Invoice Ingestion (IRP QR Code / PDF & Vendor Validation)
    ↓
Stage 2: OKF Rule Resolution (Sub-1ms Local Offline Lookup)
    ↓
Stage 3: Deterministic Statutory Computation (Excess Math & GST Unbundling)
    ↓
Stage 4: Cryptographic Payment Authorization Lease (Single-Use Atomic CAS Gate)
    ↓
Stage 5: Human-in-the-Loop Authority Harness (CFO Biometric Passkey / Mobile)
    ↓
Stage 6: Bank Rail Settlement (Host-to-Host Corporate RTGS / Sandbox Rail)
    ↓
Stage 7: General Ledger Balanced Double-Entry Writeback (ERP Equilibrium: ₹0.00 Discrepancy)
```

Run this audited 7-stage AP simulation directly in your local terminal:
```bash
npm run example:trace
```

---

## 5. Cryptographic Single-Use Payment Authorization Leases

In Adesha, banking adapters (such as RazorpayX, Mercury, or host-to-host SFTP connections) operate within a **Zero-Trust Execution Boundary**.

An adapter cannot release funds based on an API parameter or natural language prompt. To disburse a wire, an execution path must present an active, unconsumed **Payment Authorization Lease**.

### Seven-Fold Parameter Binding
A payment lease is cryptographically bound to seven immutable parameters:
1. **Beneficiary Legal Name**: The verified corporate entity name of the vendor.
2. **Account Number Hash**: SHA-256 digest of the beneficiary bank account.
3. **IFSC Routing Code**: Verified branch routing code.
4. **Net Wire Amount**: Exact disbursement amount (paisa-level precision).
5. **Canonical Result Fingerprint**: SHA-256 hash of the canonical financial record.
6. **Source Document Hash**: Binary SHA-256 digest of the underlying tax invoice.
7. **Maker-Checker Clearance**: Digital approval token issued by an authorized human officer.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   SINGLE-USE PAYMENT AUTHORIZATION LEASE               │
├────────────────────────────────────────────────────────────────────────┤
│ • Status: AUTHORIZED ──► CONSUMED (via Atomic CAS findAndModify)       │
│ • Replay Protection: Second attempt immediately fails with             │
│   LEASE_ALREADY_CONSUMED                                               │
│ • Time-to-Live (TTL): 5-minute execution window                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Presentation Consistency Lock & Automated Prose Auditor

Generative language models regularly drop trailing zeros or swap figures when drafting summaries for human reviewers. 

Adesha enforces a **Presentation Consistency Lock**:
- Before a payment lease can be issued, an automated discrepancy auditor compares the AI-generated prose against the cryptographically sealed canonical result.
- **Tolerances**:
  - Currency Variance: $> ₹1.00$ triggers an immediate fail-closed halt.
  - Statutory Section Citations: Mismatches (e.g. citing Section 206C(1H) when 194Q applies) are flagged and blocked.
  - Foreign Remittance Confabulation: Domestic vendors cannot have foreign remittance holds hallucinated upon them.

---

## 7. OpenSSF Packaging vs. Full Security Assurance

In accordance with OpenSSF (Open Source Security Foundation) npm best practices:
- **Packaging Hygiene**: Zero runtime dependencies, offline-first execution, and `.npmrc` with `ignore-scripts=true` neutralize install-time supply chain attacks.
- **Cryptographic Non-Tampering**: SHA-256 Merkle root manifests certify byte-level distribution fidelity.
- **Epistemic Honesty**: These packaging strengths do not replace independent legal counsel, statutory audit certification, or runtime multi-region crash testing. Organizations must evaluate autonomous finance systems against end-to-end integration boundaries.

---

## 8. Commercial Engagement & Enterprise Pilots

The full Adesha Autonomous Governance Runtime is delivered as a managed enterprise deployment integrated with your corporate ERP (Zoho Books, SAP S/4HANA, NetSuite) and banking partners.

To evaluate Adesha in read-only shadow mode against historical accounts payable records, review the [Supervised Shadow Pilot Evaluation Guide](./PILOT_EVALUATION_GUIDE.md).

For enterprise architecture discussions, pilot deployments, or API keys:
- **Email**: [hello@mudraforge.in](mailto:hello@mudraforge.in) or [support@mudraforge.in](mailto:support@mudraforge.in)
- **Direct Founder Contact**: Mondeep Engti at [mondeepe@gmail.com](mailto:mondeepe@gmail.com)
- **Website**: [mudraforge.in](https://mudraforge.in)
