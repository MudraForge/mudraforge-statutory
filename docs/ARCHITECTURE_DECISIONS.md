# MudraForge Statutory Knowledge Substrate — Architecture Decision Records (ADRs)

> **Standard**: Lightweight ADR Format inspired by Michael Nygard & OpenSSF Project Governance  
> **Package**: `@mudraforge/statutory`  
> **Status**: Institutional Normative Standard

---

## ADR-0001: Offline-First Bundled Commons vs. Hosted Cloudflare Edge Sync

### Context
Developers, AI agents, and enterprise ERP integrations need access to Indian statutory provisions (such as Section 194Q, 194J, 206C(1H), MSMED 15/16, and GST 17(5)). Relying solely on a hosted remote API introduces network latency, availability risks, single-point-of-failure vulnerabilities, and developer friction (requiring API keys for basic lookups).

### Decision
We bundle an offline package of 29 canonical provisions across 5 domains directly within the NPM package filesystem (`okf/`), validated by an immutable SHA-256 Merkle root digest. 
- Lookups in default or `mode: 'local'` execute entirely against local disk with zero network requests.
- Hosted Cloudflare Anycast edge synchronization is provided on a best-effort basis during beta to discover real-time gazette updates and expanded unbundled provisions.
- If edge sync is unreachable, callers automatically degrade to the verified local snapshot with an explicit `advisory` signal.

### Consequences
- **Positive**: Zero-network local evaluation works reliably in offline environments, test runners, and air-gapped CI/CD pipelines.
- **Trade-off**: Bundled snapshots reflect the law at release time. Consumers must run `checkUpdates()` or check gazette notices for recent legislative amendments.

---

## ADR-0002: Decoupling Deterministic Statutory Calculators from Declarative OKF Data Models

### Context
Large Language Models (LLMs) frequently hallucinate complex statutory threshold arithmetic (e.g. calculating Section 194Q TDS on the full ₹80 Lakhs invoice instead of the excess over ₹50 Lakhs, or failing to compound MSMED interest at 3x RBI bank rate). 

### Decision
We strictly decouple the declarative knowledge format (OKF v0.2 JSON schemas and Markdown circulars) from arithmetic calculation engines:
1. The open-source `@mudraforge/statutory` package defines declarative schemas, thresholds, rate schedules, and temporal validity bounds.
2. Exact statutory calculations are executed either by deterministic client functions or the paid MudraForge Cloudflare Worker engine.
3. Neither LLM text generation nor probabilistic prompts are ever permitted to compute statutory tax liability or interest.

### Consequences
- **Positive**: Prevents catastrophic financial calculation drift and prompt injection risks.
- **Trade-off**: The open-source package serves as a structured reference and validator; enterprise high-volume calculation is gated behind the deterministic calculation engine.

---

## ADR-0003: Commercial Boundary of Adesha Sovereign Payment Execution

### Context
Open-sourcing tax knowledge creates technical trust, but enterprise organizations require governed execution to automate corporate accounts payable, treasury operations, and bank rail payouts without risk.

### Decision
We formalize a strict 4-layer operational boundary:
1. **Layer 1: Open Statutory Knowledge (Open Source / MIT & CC BY 4.0)**: Machine-readable OKF schemas, circular frontmatter, CLI, and offline validator.
2. **Layer 2: Hosted Knowledge Services (Free Beta / Metered API)**: Cloudflare Anycast edge synchronization, remote manifest checking, and catalog expansions.
3. **Layer 3: Statutory Deduction Engine (Commercial Paid)**: Entity fact-matching, cross-provision conflict resolution, and deterministic statutory arithmetic.
4. **Layer 4: Adesha Sovereign Runtime (Enterprise Commercial)**: Human-in-the-Loop mobile authorization harness, TLA+-verified single-use payment leases, two-way ERP sync (SAP/Tally), and corporate banking rails.

### Consequences
- **Positive**: Clear division of responsibilities; open-source users have an unencumbered, fully functional tax commons, while commercial clients obtain bank-grade execution safety.

---

## ADR-0004: Tripartite Versioning Specification

### Context
Confusing package software updates with legal statutory amendments leads to silent downstream breakages. A statutory amendment does not necessarily change software APIs, and an SDK performance patch does not alter the law.

### Decision
We establish three independent, non-interchangeable versioning dimensions:

| Version Identifier | Target Governed | Lifecycle & Increment Rules | Example |
| :--- | :--- | :--- | :--- |
| **`okfVersion`** | Knowledge Schema Structure | Incremented only when the JSON schema or metadata fields change (e.g., adding a required field). | `0.2.0` |
| **`corpusRelease`** | Legal Corpus Snapshot | Incremented when statutory provisions, rates, or circulars are updated or added. | `2026.04.1` |
| **`version`** (SemVer) | NPM Client SDK & CLI | Standard Semantic Versioning for the JavaScript library, CLI commands, and test runners. | `2.10.0` |

---

## ADR-0005: Formal Product Capability Status Register

### Context
To maintain institutional credibility, public documentation must never blur the line between currently published capabilities, planned features, and proprietary enterprise software.

### Status Register

| Subsystem / Capability | Architectural Layer | Operational Status | Availability / Access | Verification Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **Bundled OKF Statutory Corpus (46 Provisions across 5 Domains)** | Layer 1: Public Package | `PUBLIC_BUNDLED` | Immediate (Local repo & release candidate) | 166/166 test suites passing; SHA-256 Merkle root verified |
| **Zero-Network CLI (`mudraforge-statutory`)** | Layer 1: Public Package | `PUBLIC_BUNDLED` | Immediate (Global / NPX) | `bin/cli.js` verified across Windows & Linux |
| **Vendor-Neutral Conformance Suite** | Layer 1: Public Package | `PUBLIC_BUNDLED` | Immediate (`conformance/`) | 12/12 fixture tests passing |
| **Local Query SDK (`src/index.js`)** | Layer 1: Public Package | `PUBLIC_BUNDLED` | Immediate (Node.js v18+) | Zero-dependency offline lookup and temporal checks |
| **Synthetic AP Execution Trace (`examples/`)** | Layer 1: Public Package | `PUBLIC_DEMO_SYNTHETIC` | Immediate (`npm run example:trace`) | Modeled 7-stage lifecycle with synthetic test fixtures |
| **Cloudflare Anycast Edge Sync** | Layer 2: Public Edge Service | `PUBLIC_EDGE_SYNC` | Free Beta (`api.mudraforge.in`) | Cloudflare Edge Worker manifest & bundle endpoints |
| **Interactive API Documentation** | Layer 2: Public Edge Service | `PUBLIC_EDGE_SYNC` | Free Beta (`/api/v1/statutory/docs`) | OpenAPI 3.1 schema rendered live on Anycast edge |
| **Universal Statutory Virtual Machine (USVM Kernel & Rules)** | Layer 1: Public Package | `PUBLIC_BUNDLED` | Immediate (`@mudraforge/statutory/usvm`) | 48 pre-cached declarative AST rule packages, rational BigInt math (<15µs latency) |
| **Deterministic Corporate Finance Calculators** | Layer 1: Public Package | `PUBLIC_BUNDLED` | Immediate (`@mudraforge/statutory/calculators`) | Corporate tax MAT vs concessional, GST POS/LUT, TP ALP, Section 79, Ind AS 109, Section 288B |
| **Hosted AP Engine & Cumulative Spend Tracking** | Layer 3: Enterprise Internal | `PILOT_STAGE_INTERNAL` | Metered Enterprise API (Selective) | Hosted cumulative Section 194Q thresholding & Section 16 MSMED interest |
| **Dual-Custody Mobile Approval Harness** | Layer 4: Adesha Runtime | `INTERNAL_PROTOTYPE` | Enterprise License / Pilot Proposal | Mobile passkey approval prototype & TLA+ state machine |
| **ERP Two-Way Connectors (SAP/Tally/Zoho)** | Layer 4: Adesha Runtime | `INTERNAL_DEVELOPMENT` | Custom Enterprise Pilot | Shadow-mode test connectors; no turnkey plug-ins shipped |
| **Bank Rail API Adapters (ICICI/HDFC/RazorpayX)**| Layer 4: Adesha Runtime | `INTERNAL_DEVELOPMENT` | Custom Enterprise Pilot | Sandbox banking adapters requiring corporate partner onboarding |

> **Critical Operational Distinction**: Items marked `PUBLIC_BUNDLED` and `PUBLIC_EDGE_SYNC` represent inspectable, working software. Items marked `PILOT_STAGE_INTERNAL`, `INTERNAL_PROTOTYPE`, and `INTERNAL_DEVELOPMENT` represent proprietary or developing enterprise capabilities; they are not shipped as generally available consumer software and their execution traces rely on modeled synthetic data.

---

## ADR-0006: Declarative Composite Transaction Profiles and Domain Knowledge Graphs

### Context
Commercial lifecycle events (such as corporate acquisitions, slump sales, mergers, and vendor onboarding runs) are not individual statutes. Instead, they represent business transaction archetypes that trigger multiple intersecting statutory regimes across Direct Tax, Indirect Tax (GST), and Corporate Governance (Companies Act).

Treating complex transactions as flat, isolated `section.json` files forces consuming developers and AI agents to guess the relationships, execution sequences, and documentary requirements connecting relevant laws. Conversely, hardcoding operational execution logic, linear numbering assumptions, or premature legal verdicts (e.g. declaring a deal void due to a missing certificate without evaluating statutory safe harbors) into declarative formats violates both open knowledge standards and sound statutory jurisprudence.

### Decision
We establish a 3-tier declarative knowledge model for complex multi-statute transactions:

1. **Tier 1: Atomic Statutory Provision (`section.json`)**: Authoritative legislative text, official Gazette citations, rates, and temporal validity windows.
2. **Tier 2: Legal Concept Definition (`concepts/*.md`)**: Substantive interpretation boundaries, statutory conditions, exceptions, safe harbors, and evidence checklists (Markdown with structured YAML frontmatter).
3. **Tier 3: Composite Transaction Profile (`composites/*.json`)**: Declarative relationship graph connecting relevant concepts and provisions for a specific business transaction archetype.

#### Core Architectural Invariants:
1. **Extension Attribution**: Composite profiles are documented as a versioned **MudraForge OKF Transaction Extension**, keeping them distinct from upstream Google OKF v0.2 core specifications while fully utilizing OKF frontmatter conventions.
2. **Logical Dependencies vs. Operational Ordering**:
   - `dependsOn` strictly denotes a **logical prerequisite** where a downstream statutory test is contingent on an upstream outcome (e.g. evaluating GST Notification 12/2017 going-concern nil-rate eligibility logically depends on whether the transfer satisfies the Section 50B "undertaking" test).
   - In contrast, operational ordering is not enforced as a rigid constraint; independent checks (such as Section 281 tax proceedings verification and Section 180 corporate approval) remain independently runnable even when another inquiry is pending, unresolved, or awaiting documentation.
3. **Statutory Safe Harbors over Binary Failure Verdicts**: Profiles declare applicable legal questions, statutory conditions, safe harbors (e.g., bona fide purchaser for value without notice under Section 281), and evidentiary burdens, leaving judicial or executive determinations to runtime evaluation engines.
4. **Strict Temporal Enactment Distinguishability**: Corresponding provisions under the Income-tax Act, 1961 (such as §281, §170) and the Income-tax Act, 2025 (such as §499, §313 taking effect 1 April 2026) must remain explicitly distinguished by enactment code and effective period.
5. **Separation of Open Knowledge from Governed Execution**:
   - The open commons (`@mudraforge/statutory`) provides the inspectable, reusable, and testable dependency graph of laws and evidence requirements.
   - The commercial runtime (Adesha) executes deterministic calculations, enforces bank escrow locks, requires CFO biometric authorization, and writes balanced ERP journal entries.
6. **Normative Scope & Independent Legal Validation**:
   - An Architecture Decision Record defines structural design invariants and data contracts; it does not substitute for independent legal certification of specific transaction scenarios. All composite profiles and legal-version mappings must be validated against independent legal ground truth in dedicated scenario test suites before promotion to stable status.

#### Prototype Implementation Requirements (feature/composite-transaction-profiles):
Prior to merging any composite transaction prototype into `main`, the implementation must satisfy four strict verification gates:
1. **Precise Graph Semantics & Acyclicity**: Formally define `dependsOn`, `parallelIndependentChecks`, and `conditionalDownstreamChecks`. Implement automated DAG validation that rejects circular dependencies and cleanly halts downstream evaluation when an upstream prerequisite is `UNKNOWN` or `UNRESOLVED`.
2. **Temporal & Provenance Continuity**: Every statutory reference in a profile must carry an unambiguous enactment code, provision identifier, official Gazette source URL, and `effectivePeriod`. Cross-regime profiles must evaluate against an explicit `asOfDate` rather than silently blending provisions from different legislative eras.
3. **Four-State Epistemic Uncertainty Model**: Inquiries must be evaluated against an explicit four-state epistemic model (`SATISFIED`, `NOT_SATISFIED`, `UNKNOWN` / `EVIDENCE_PENDING`, and `NOT_APPLICABLE`). Missing documentation or unverified assertions must remain `UNKNOWN` rather than prematurely collapsing into negative legal conclusions.
4. **Independent Open-Source Usability (Zero Vendor Lock-in)**: A third-party developer or external AI agent must be able to load a composite profile, validate its schema, traverse its dependency graph, and inspect its evidence checklists locally and offline using only `@mudraforge/statutory`, with zero dependency on the proprietary Adesha runtime, API keys, or remote servers.

### Consequences
- **Positive**: Makes complex statutory relationships discoverable and machine-readable for AI agents without compromising open-source format purity or disclosing proprietary execution code.
- **Lifecycle Management**: Implemented as an experimental prototype on a dedicated feature branch (`feature/composite-transaction-profiles`) and subjected to independent legal scenario benchmarking prior to promotion into public release `v2.5.0`. Release `v2.4.0` remains focused on the verified atomic statutory corpus.

---

## ADR-0007: Universal Statutory Virtual Machine (USVM) Declarative AST Kernel

### Context
Historically, statutory tax calculations were coded as imperative JavaScript branching functions. As statutory provisions grew across 5 canonical domains, imperative functions introduced code duplication, maintenance overhead, and higher bundle sizes for edge and browser environments. Imperative procedural code also made independent statutory verification opaque for non-developer tax professionals and audit teams.

### Decision
We introduce the Universal Statutory Virtual Machine (USVM) declarative Abstract Syntax Tree (AST) evaluation kernel:
1. **Stateless AST Evaluation Kernel (`src/usvm/evaluation_vm.js`)**: A compact 355-line stateless virtual machine evaluating declarative AST rule definitions without imperative branching.
2. **5-Stage Rational BigInt Arithmetic (`src/usvm/math_rational.js`)**: Arithmetic is evaluated using exact rational fractions (`[numerator, denominator]` pairs) to eliminate IEEE 754 floating-point precision loss.
3. **Co-Located Declarative Rules**: 55 `ast.json` rule packages co-located within the 5 canonical OKF domains, alongside 64 pre-cached rules in `src/usvm/rules/*.json`.
4. **Strict Operator Allowlist & Passive AST Data**: The AST is strictly declarative data (`ast.json`) evaluated against an operator allowlist (`+`, `-`, `*`, `/`, `min`, `max`, `floor`, `ceil`, `and`, `or`, `not`, comparison, slab lookups). Dynamic execution, `eval()`, network I/O, and file system calls are structurally barred.
5. **Graph-Driven Symbol Legend Projection (`symbolLegend`)**: Inferred semantic roles and concept structs map statutory variables to typed AST nodes without requiring hardcoded schema drift.
6. **Tree-Shakable Subpath (`@mudraforge/statutory/usvm`)**: Exposes `evaluateStatutoryAst`, `validateStatutoryAst`, and `toBigIntPaise` in an ultra-lightweight bundle (~12 kB GZIP vs 92.9 kB full library).
7. **Fiduciary Statutory Invariant**: Every evaluation strictly enforces `isAuthorizedToDisburse: false`.

### Consequences
- **Positive**: Replaces thousands of lines of imperative procedural code with declarative JSON AST definitions; achieves sub-microsecond evaluation latency (p50: 14.32 microseconds); enables tree-shakable client bundles; guarantees complete decoupling between computation and cash movement.
- **Backward Compatibility**: Fully backward compatible with existing procedural API callers.
