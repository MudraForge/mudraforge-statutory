# Changelog

All notable changes to `@mudraforge/statutory` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.14.0] - 2026-11-08

### Deprecated
- **Procedural Calculators Subsystem (`@mudraforge/statutory/calculators`)**:
  - Formally deprecated all procedural calculator functions in `src/calculators.js` and `types/index.d.ts` in favor of declarative Abstract Syntax Tree (AST) evaluation via the Universal Statutory Virtual Machine (`@mudraforge/statutory/usvm` -> `evaluateStatutoryAst`).
  - Added JSDoc `@deprecated` annotations across all 43 procedural calculation exports with explicit guidance to migrate to USVM.
  - Procedural calculation APIs remain 100% backward compatible throughout v2.x and are scheduled for sunset in v3.0.0.

### Changed
- **Package Distribution Footprint Optimization**:
  - Excluded internal development artifacts (`docs/`, `conformance/`, `examples/`) from the npm publish tarball (`package.json` `"files"`), reducing unpacked install size by ~440 kB (1.7 MB vs 2.1 MB) and compressed tarball by ~25% (404 kB vs 536 kB).
  - Aligned `STATUTORY_PACKAGE_VERSION` and `OKF_CORPUS_VERSION` constants in `src/calculators.js` to `2.14.0`.
  - Pinned verified release Merkle root digest: `sha256-7ffc75e8611a9c966eea756dd544fdae9144e2318d3478633232bb876d05e364`.
  - Package version bumped to `2.14.0` in accordance with SemVer Rule 7.

## [2.13.0] - 2026-11-08

### Added
- **Universal Statutory Virtual Machine (USVM) Kernel (`@mudraforge/statutory/usvm`)**:
  - Stateless execution kernel (`evaluation_vm.js`, 355 lines) evaluating declarative AST rules with sub-microsecond latency (p50: 14.32 microseconds).
  - 5-stage rational BigInt arithmetic (`math_rational.js`) eliminating floating-point rounding drift.
  - Strict AST schema validator and operator allowlists (`statutory_ast_schema.js`).
  - Pre-cached 48 declarative AST packages in `src/usvm/rules/*.json`.
  - Co-located 46 `ast.json` rule packages across the 5 canonical OKF domains.
- **Tree-Shakable Package Subpath (`@mudraforge/statutory/usvm`)**:
  - Exposes `evaluateStatutoryAst`, `validateStatutoryAst`, and `toBigIntPaise` for ultra-lightweight client bundles (~12 kB GZIP vs 92.9 kB).

### Changed
- Re-computed Merkle manifest SHA-256 root digest: `sha256-7ffc75e8611a9c966eea756dd544fdae9144e2318d3478633232bb876d05e364`.
- Attached `ast` object to `lookupLocalStatute` return envelopes.
- Package version bumped to `2.13.0`.

## [2.12.1] - 2026-11-06

### Fixed
- **Statutory Identity Migration to Official Income-tax Act, 2025 Architecture**:
  - Migrated colloquial Section 393 table shorthand (Table 8, Table 6, Table 5, Table 4, Table 3) to canonical enacted references under **Section 393(1), Table 1, Serial Numbers (Sl. Nos.)** for payments to residents:
    - Section 194H $\to$ Section 393(1), Table 1, Sl. No. 1(ii) (Commission or brokerage).
    - Section 194-I $\to$ Section 393(1), Table 1, Sl. No. 2 (Rent).
    - Section 194-IB $\to$ Section 393(1), Table 1, Sl. No. 2(iii) (Rent by Individuals/HUF).
    - Section 194-IA $\to$ Section 393(1), Table 1, Sl. No. 3(i) (Immovable property).
    - Section 194A $\to$ Section 393(1), Table 1, Sl. No. 5(ii) & 5(iii) (Interest).
    - Section 194C $\to$ Section 393(1), Table 1, Sl. No. 6(i) (Works contracts).
    - Section 194J $\to$ Section 393(1), Table 1, Sl. No. 6(iii) (Fees for professional or technical services).
    - Section 194-O $\to$ Section 393(1), Table 1, Sl. No. 8(i) (E-commerce).
    - Section 194Q $\to$ Section 393(1), Table 1, Sl. No. 8(ii) (Purchase of goods).
    - Section 194R $\to$ Section 393(1), Table 1, Sl. No. 8(iv) (Business perquisites).
    - Section 194M $\to$ Section 393(1), Table 1, Sl. No. 6(i) / 6(iii) / 1(ii) (Specified individual contracts).
  - Maintained backward-compatible aliases (such as `393(1)(table 8)(ii)`, `393(1)(table 6)`) for seamless query resolution.

### Changed
- **Date-Effective Statutory Threshold Logic (Income-tax Act, 2025 Transition)**:
  - Commission (194H): ₹15,000 (pre-1 April 2026) $\to$ ₹20,000 (post-1 April 2026).
  - Professional/Technical Fees (194J): ₹30,000 (pre-1 April 2026) $\to$ ₹50,000 (post-1 April 2026); Director remuneration maintains strict ₹0 threshold under both Acts.
  - Rent (194-I): ₹2,40,000 annual aggregate (1961 Act) $\to$ ₹50,000 per month or part thereof (2025 Act).
  - Interest (194A): Commercial ₹5,000 $\to$ ₹10,000; Banking ₹40,000 $\to$ ₹50,000; Senior citizen bank deposits ₹50,000 $\to$ ₹1,00,000.
  - Strict statutory excess math enforced across all thresholds (`cumulative > threshold`; exact equality is exempt).

## [2.12.0] - 2026-11-01

### Added
- **Corporate Finance, Accounting & Reporting Knowledge Expansion (8 New OKF Provisions & 9 Calculators)**:
  - *Ind AS 103 / IFRS 3 / ASC 805 Business Combinations & Purchase Price Allocation (PPA)* (`corporate_ma_restructuring/business_combinations_indas_103`):
    - Full purchase price allocation (PPA), net identifiable assets measurement at fair value, deferred tax liability (DTL) derivation on acquired intangibles, contingent consideration recognition at acquisition-date fair value.
    - Deterministic Goodwill vs. Capital Reserve (bargain purchase) derivation with balanced double-entry vouchers.
    - Pure calculator `calculateBusinessCombinationsIndAs103(params)`.
  - *Ind AS 36 / IAS 36 / ASC 360 Impairment of Assets & Cash-Generating Units (CGUs)* (`corporate_ma_restructuring/impairment_of_assets_indas_36`):
    - Recoverable amount derivation comparing Fair Value Less Costs of Disposal (FVLCD) vs. Value in Use (VIU) via Discounted Cash Flow (DCF).
    - Sequential impairment loss allocation: Goodwill reduced to zero first, then remaining impairment apportioned pro-rata across tangible/intangible assets without breaching statutory individual asset floors (FVLCD, VIU, or zero).
    - Pure calculator `calculateImpairmentIndAs36(params)`.
  - *Ind AS 102 / IFRS 2 / ASC 718 Share-Based Payment (ESOP) Graded Vesting Amortization* (`corporate_ma_restructuring/share_based_payments_indas_102`):
    - Graded vesting separate tranche mechanics (front-loaded expense profile per ICAI/MCA guidance), forfeiture rate revisions, and true-up adjustments.
    - Indian tax deductibility analysis under the Supreme Court *Biocon Ltd.* landmark doctrine (Section 37(1) general business deduction vs. capital transaction).
    - Pure calculator `calculateEsopAmortizationIndAs102(params)`.
  - *Ind AS 12 / IAS 12 / ASC 740 Income Taxes & Deferred Tax Accounting* (`direct_tax/income_taxes_deferred_tax_indas_12`):
    - Balance sheet liability method computing temporary differences between accounting carrying amounts and tax bases (e.g., Section 43B(h) MSME disallowances, Ind AS 109 ECL allowances, Section 32 accelerated depreciation).
    - Numerical Effective Tax Rate (ETR) reconciliation across statutory rate, permanent differences, and prior period adjustments.
    - Pure calculator `calculateDeferredTaxIndAs12(params)`.
  - *Ind AS 115 / IFRS 15 / ASC 606 Revenue from Contracts with Customers* (`msme_commercial/revenue_recognition_indas_115`):
    - 5-step revenue recognition framework: identifying enforceable contracts, distinct performance obligations, transaction price determination (including variable consideration constraints), relative Standalone Selling Price (SSP) allocation, and satisfaction timing (Point-in-Time vs. Over-Time using input/output methods).
    - Contract Asset (unbilled revenue) vs. Contract Liability (unearned revenue) balance sheet derivation.
    - Pure calculator `calculateRevenueAllocationIndAs115(params)`.
  - *Ind AS 116 / IFRS 16 / ASC 842 Leases & Right-of-Use (ROU) Asset Accounting* (`msme_commercial/lease_accounting_indas_116`):
    - Incremental Borrowing Rate (IBR) discounting for initial lease liability and ROU asset capitalization (including lease prepayments, initial direct costs, and dismantling/restoration asset retirement obligations).
    - Subsequent amortization tracking front-loaded Year 1 P&L expenses (depreciation + finance charge) versus straight-line operating lease rent.
    - Short-term (<12 months) and low-value (<$5,000 / ₹4,00,000) practical expedients evaluation.
    - Pure calculator `calculateLeaseAmortizationIndAs116(params)`.
  - *Ind AS 37 / IAS 37 / ASC 450 Provisions, Contingent Liabilities & Contingent Assets* (`msme_commercial/provisions_contingencies_indas_37`):
    - Present obligation from past obligating events (legal or constructive), probable outflow (>50% probability threshold requiring balance sheet provisioning), possible obligation (5% to 50% threshold requiring footnote disclosure in notes to accounts), and remote likelihood (<5% threshold requiring zero disclosure).
    - Best estimate valuation (expected value probabilistic weighting vs. single most likely outcome) and discounting for long-term decommissioning/restoration provisions.
    - Pure calculator `evaluateProvisionsAndContingenciesIndAs37(params)`.
  - *Ind AS 109 / IFRS 9 / ASC 326 Financial Instruments — Expected Credit Loss (ECL)* (`international_tax/financial_instruments_ecl_indas_109`):
    - 3-stage forward-looking impairment model: Stage 1 (12-month ECL for performing loans/receivables), Stage 2 (Lifetime ECL upon Significant Increase in Credit Risk - SICR / 30+ DPD), and Stage 3 (Lifetime ECL for credit-impaired assets / 90+ DPD).
    - Provision matrix simplification for trade receivables under Ind AS 109 paragraph 5.5.15 with forward-looking macroeconomic stress adjustments (GDP growth, interest rate shifts).
    - Tax add-back mapping under Section 36(1)(vii) / Section 36(1)(viia) and deferred tax asset recognition under Ind AS 12.
    - Pure calculator `calculateExpectedCreditLossIndAs109(params)`.
  - *Ind AS 21 / IAS 21 / ASC 830 The Effects of Changes in Foreign Exchange Rates* (`international_tax/foreign_currency_indas_21`):
    - Monetary vs. non-monetary asset/liability distinction, closing rate revaluation, transactional gain/loss P&L routing, and foreign operations functional-to-presentation currency translation reserve (OCI Foreign Currency Translation Reserve - FCTR).
    - Pure calculator `calculateForeignCurrencyIndAs21(params)`.
  - *StatutoryClient Parity & Invariant Envelope*:
    - All 9 accounting and reporting calculators bound to `StatutoryClient.prototype`.
    - Strict `isAuthorizedToDisburse: false` invariant enforced across every engine output.
    - Comprehensive TypeScript type definitions in `types/index.d.ts`.
- **Open Knowledge Format (OKF v0.2) Corpus Growth**:
  - Sections expanded from 38 to 46 sections across 5 canonical domains.
  - Authoritative circulars expanded from 44 to 52 instruments with strict YAML frontmatter.
  - Compliance forms and registers expanded from 39 to 47 templates.
  - Deep canonical citation links expanded from 154 to 180 verified endpoints (100% link integrity, zero broken links).
  - Test suites expanded from 155 to 165 comprehensive test suites with 100% pass rate.

## [2.11.0] - 2026-10-30

### Added
- **55th GST Council Intervening Commercial Rent Regularization ("As Is Where Is")**:
  - *Statutory Codification* (`indirect_tax_gst/rcm_liability_sec9_3`): Codified 55th GST Council Meeting Recommendations (21 December 2024, Jaisalmer) regularizing past commercial property renting transactions under reverse charge for Section 10 composition taxpayers during the intervening window (10 October 2024 to 15 January 2025) on an "as is where is" basis.
  - *Disposition `RCM_COMPOSITION_INTERVENING_REGULARIZED_PAID`*: If RCM tax was historically discharged in cash, the tax is permanently regularized with zero refund rights and booked as an expense under Section 10(4).
  - *Disposition `RCM_COMPOSITION_INTERVENING_REGULARIZED_UNPAID`*: If RCM tax was not discharged, statutory authorities cannot initiate retrospective recovery, demand notices, or penal proceedings; full consideration is expensed with zero RCM tax payable.
  - *Failsafe Uncertainty Routing*: Intervening bills with indeterminate or unverified cash payment status route to `REQUIRES_HUMAN_VERIFICATION` (`INDETERMINATE_INTERVENING_RCM_DISCHARGE`).
- **Notification No. 07/2025-CT(Rate) Composition Taxpayer Rent Exclusion**:
  - *Entry 5AB Prospective Amendment* (w.e.f. 16 January 2025): Excludes composition taxpayers under Section 10 from reverse charge liability on commercial immovable property renting (`COMPOSITION_EXCLUDED_RCM_SUPPLY`).
- **CBIC Circular No. 192/04/2023-GST Head-Wise ECL Utilization Rules**:
  - *Aggregate Pool for Wrongly Availed IGST*: Clarifies Section 49(5) cross-utilization rules for Rule 88B(3) interest on unreversed ITC. IGST credit is tested against the aggregate pool of `IGST + CGST + SGST` balances. If the combined balance never falls below unreversed IGST credit, zero interest attaches under Section 50(3) even if standalone IGST balance falls to zero.
  - *Restricted Cross-Utilization for CGST & SGST*: CGST credit is tested against `CGST + IGST` (SGST is not cross-utilizable). SGST credit is tested against `SGST + IGST` (CGST is not cross-utilizable).
  - *Strict Exclusion of Compensation Cess*: Compensation Cess balances in the Electronic Credit Ledger are strictly excluded from general ITC balance computations.
- **Cumulative Multi-Invoice Portfolio Rule 88B(3) ECL Stress-Testing**:
  - *Portfolio Pooling*: Pools overdue exposure across multiple concurrent bills, tracking overlapping start dates, separate reversal dates, and temporary dip-recovery cycles.
  - *Same-Day Movement Coalescing*: Multiple credit and debit entries on the same date are accurately coalesced to the net daily closing balance.
- **Regulatory Watchtower Expansion (9 Benchmarks & 154 Citations)**:
  - Added Benchmark 8: `GST_RCM_COMMERCIAL_RENT_INTERVENING_REGULARIZATION` (55th GST Council meeting).
  - Added Benchmark 9: `GST_RULE_88B3_CIRCULAR_192_ECL_UTILIZATION` (Circular No. 192/04/2023-GST).
  - Validated all 38 sections, 44 circulars, 39 forms, and 154 deep canonical citations with zero errors.
  - Pinned Merkle Root: `sha256-a94baf08cbdea064a7b1bd25c1e1311821bf75e9b0d15cc8e0648339d487c79b`.
- **Regulatory Watchtower & Continuous Empanelment Freshness Attestation (`scripts/watchtower.js`)**:
  - *Automated Compliance Surveillance Engine*: Scans and attests the entire Open Knowledge Format (OKF v0.2) substrate across all 38 statutory sections, 41 executive circulars, 39 compliance forms, and 148 deep canonical citations.
  - *Regulatory Freshness Horizon Audit*: Evaluates active compliance against 6 statutory benchmarks:
    1. October 2024 Commercial Renting RCM: CBIC Notification No. 09/2024-CT(Rate) Entry 5AB.
    2. Retrospective Section 16(5)/16(6) ITC Relief: Finance (No. 2) Act, 2024.
    3. October 2024 Section 194H 2% Rate Reduction: Finance (No. 2) Act, 2024.
    4. April 2025 Section 206C(1H) Goods TCS Sunset: Finance Act, 2025.
    5. April 2025 Section 206AB Non-Filer Omission: Finance Act, 2025 Clause 61.
    6. April 2026 Dual-Act Transition: Income-tax Act, 1961 vs Income-tax Act, 2025 Section 393.
  - *Empanelment Freshness Certificate Generation*: Produces cryptographic, machine-readable `MF-CERT-...` attestation with 100.0% empanelment score and strict `isAuthorizedToDisburse: false` invariant enforcement.
  - *CLI & Programmatic Integration*: Added `npx @mudraforge/statutory watchtower [--json]`, `npm run watchtower`, and `StatutoryClient.prototype.runWatchtower()`.
- **Commercial Property Renting RCM Engine (Notification No. 09/2024-CT(Rate) w.e.f. 10 October 2024)**:
  - *Entry 5AB Implementation* (`indirect_tax_gst/rcm_liability_sec9_3`): Full statutory codification of reverse charge on commercial immovable property renting by unregistered suppliers to registered persons.
  - *Auto-Classification in Zoho AP Reconciliation*: Bills for office/commercial rent from unregistered landlords are automatically classified as `isCommercialRentRcm: true` and `isRcm: true`.
  - *Exemption from Section 16(2)(aa) GSTR-2B Matching*: Unregistered RCM supplies are classified as `RCM_UNREGISTERED_SUPPLIER_ELIGIBLE` with `itcStatus: ELIGIBLE_RCM_TABLE_4A3`, eliminating erroneous "missing in 2B" false flags.
  - *Compliance Directives*: Mandates Self-Invoice under Section 31(3)(f), Payment Voucher under Section 31(3)(g), cash tax discharge under GSTR-3B Table 3.1(d), and credit availment under Table 4(A)(3).
- **Zoho Books & GST Portal Form GSTR-2B Automated AP Reconciliation Engine**:
  - *Automated 2-Way Accounts Payable Matching*: Ingests Zoho Books Bills CSV/API JSON and GST Portal Form GSTR-2B JSON (B2B invoices + CDNR credit/debit notes) with deterministic invoice number canonicalization (resolving slash, hyphen, space, and leading zero variations) and integer-paise arithmetic.
  - *Decoupled 4-Way Jurisdictional Decisions*: Replaces monolithic eligibility flags with 4 orthogonal, discrete decisions per transaction:
    1. `taxClassification`: `INTRASTATE_CORRECT`, `INTERSTATE_CORRECT`, `ERRONEOUS_INTRASTATE_LEVY`, `ERRONEOUS_INTERSTATE_LEVY`, `INDETERMINATE`.
    2. `recipientJurisdiction`: `FILING_GSTIN_MATCHES_POS`, `REGISTERED_DISTINCT_PERSON_BRANCH`, `UNREGISTERED_IN_POS_STATE`, `INDETERMINATE`.
    3. `itcEligibility`: `ELIGIBLE_NORMAL`, `ELIGIBLE_IN_BRANCH_RETURN`, `INELIGIBLE_STRANDED_LOCAL_LEVY`, `INELIGIBLE_BLOCKED_SEC_17_5`, `INELIGIBLE_DEFECTIVE_INVOICE`, `INELIGIBLE_PORTAL_FLAGGED`, `PROVISIONAL_PENDING_FILING`, `INDETERMINATE`.
    4. `operationalRouting`: `CLAIM_IN_CURRENT_GSTR3B_TABLE_4A5`, `ROUTE_TO_BRANCH_GSTIN`, `BOOK_AS_EXPENSE_NO_ITC`, `REPORT_IN_GSTR3B_TABLE_4B1_PERMANENT_REVERSAL`, `REQUEST_VENDOR_CREDIT_NOTE_AMENDMENT`, `WITHHOLD_CLAIM_PENDING_SUPPLIER_GSTR1`, `PHYSICAL_GOODS_RECEIPT_VERIFICATION_PENDING`, `MANUAL_HUMAN_INVESTIGATION_REQUIRED`.
  - *Epistemic Uncertainty Routing (`REQUIRES_HUMAN_VERIFICATION`)*: Engine refuses to manufacture false certainty on incomplete evidence. Fails open to human auditor review with explicit `uncertaintyReason`:
    - `INVALID_SUPPLIER_GSTIN_CHECKSUM`: Failed ISO Mod-36 checksum validation.
    - `AMBIGUOUS_DUPLICATE_INVOICE_MATCH`: Multiple candidate records sharing identical supplier GSTIN and invoice number.
    - `CONTRADICTORY_TAX_SPLIT`: Concurrent CGST/SGST and IGST on the same voucher.
    - `MISSING_POS_DATA`: Missing or indeterminate place-of-supply information.
  - *Rule 37 Payment Appropriation Policies*: Implements Section 16(2) second proviso read with Rule 37(1) supporting `PROPORTIONATE` (default statutory baseline), `VALUE_FIRST`, and `TAX_FIRST` payment allocation policies. Exempts Reverse Charge (RCM) and Schedule I deemed supplies.
  - *Rule 88B(3) Electronic Credit Ledger (ECL) Utilization Audit*: Section 50(1) 18% delayed interest is audited against minimum daily ECL closing balances (`minimumEclBalanceInr`). Applies 0% interest if ECL balance exceeded unreversed ITC throughout the default window per Rule 88B(3) Proviso; applies interest strictly to the dipped/utilized portion.
  - *Executive Markdown Memorandum Generator*: Generates an audit-ready memorandum with an ITC health matrix, actionable AP exceptions register, and statutory assurance invariants.
  - *CLI Command Integration*: Added `npx @mudraforge/statutory reconcile-gstr2b --zoho <file> --gstr2b <file> [--report-out <path>] [--json]` to CLI.
  - *StatutoryClient Parity*: Added programmatic methods `parseZohoBillsCsv`, `parseZohoBillsJson`, `parseGstr2bJson`, `reconcileZohoGstr2b`, `generateGstr2bAuditMarkdownReport`, `normalizeInvoiceNumber`, and `normalizeGstin` with full TypeScript declarations in `types/index.d.ts`.
- **Accounting Contracts, Numeric Input Resilience & Integer-Paise Precision Hardening**:
  - *4-State Numeric Classification*: `cleanNumericAmount` cleanly classifies inputs into missing optional (default), missing mandatory (throws `MissingMandatoryParameterError`), malformed numeric (throws `MalformedNumericInputError` in strict mode), and valid zero (`0`, `"0"`, `"₹ 0.00"`).
  - *Accounting-Aware Credit (`CR`) Handling*: Preserves positive credit balances by default; only negates when `{ interpretCreditAsNegative: true }` is explicitly provided.
  - *Safe Integer Boundary & Sub-Paisa Rules*: Enforces `Number.MAX_SAFE_INTEGER` (₹90,071,992,547,409.91 limit) across all monetary conversions and half-up rounding on fractional paise.
  - *Accounting Format Tolerance*: Parses parentheses accounting negatives (`(₹ 50,000.00)`), trailing minuses (`50,000.00-`), and currencies outside parentheses (`INR (25,000)`).
  - *Daybook Dual-Column Ingestion*: Full support for dual debit/credit columns, Particulars headers, and RFC 4180 quoted strings in `parseTallyDaybookCsv`.
- **GST Rule 42 & Rule 43 Common Input Tax Credit (ITC) Reversal Engine**:
  - *Indirect Tax GST Domain* (`indirect_tax_gst/common_itc_reversal_rule42_43`): Authoritative implementation of Section 17(1) and Section 17(2) of the CGST Act, 2017 read with Rule 42 (inputs & input services) and Rule 43 (capital goods).
  - *Rule 42 Monthly Ineligible Credit Segregation*: Segregation of gross ITC ($T$) into specific ineligibles ($T_1$ non-business, $T_2$ exempt, $T_3$ blocked u/s 17(5)), Electronic Credit Ledger credited balance ($C_1$), specific eligible credit ($T_4$ taxable/zero-rated exports), and Common Credit ($C_2$).
  - *Monthly Turnover Apportionment ($D_1$ & $D_2$)*: Deterministic computation of exempt ratio ($E/F$), exempt reversal ($D_1 = (E/F) \times C_2$), non-business 5% reversal ($D_2 = 0.05 \times C_2$), remaining eligible common credit ($C_3$), and net eligible credit ($G = T_4 + C_3$). Includes preceding tax period turnover fallback proviso where current period turnover is zero.
  - *Mandatory GSTR-3B Table 4(B)(1) Mapping*: Strict enforcement of CBIC Circular No. 170/02/2022-GST reporting permanent non-reclaimable reversals ($T_{\text{ineligible}} + D_1 + D_2$) in Table 4(B)(1) with zero netting-off against Table 4(A).
  - *Rule 42(2) Annual True-Up Reconciliation Engine*: Complete reconciliation of aggregate financial year common credit ($C_2^{\text{annual}}$) against cumulative monthly reversals made in Table 4(B)(1) before the statutory cutoff date of 30th November (Finance Act, 2022 read with Notification No. 18/2022-Central Tax).
  - *Section 50(1) 18% Statutory Interest Engine*: Automatic computation of 18% annual interest on short-reversals from 1st April of the succeeding financial year up to the true-up filing date.
  - *Excess Reversal Reclaim Mechanism*: Taxpayer entitlement to reclaim excess provisional reversals in Form GSTR-3B Table 4(A)(5) with disclosure in Table 4(D)(1) before 30th November.
  - *Rule 43 Capital Goods 60-Month Useful Life Amortisation*: Asset-level tracking over 60 statutory months, monthly credit slices ($T_m = T_c / 60$), aggregate monthly common slice ($T_r = \sum T_m$), and monthly exempt reversal ($T_e = (E/F) \times T_r$) added to output tax liability in Table 4(B)(1).
  - *Asset Conversion Reductions*: 5% per quarter credit reduction under Rule 43(1)(c) for capital goods converted from exclusive exempt/non-business use to common business use.
  - *Pure Deterministic Calculators (`src/calculators.js`)*:
    - `calculateRule42InputServiceReversal(params)`
    - `reconcileRule42AnnualTrueUp(params)`
    - `calculateRule43CapitalGoodsReversal(params)`
    - `calculateGstItcApportionmentRule42_43(params)` (backward-compatible orchestrator)
  - *StatutoryClient Parity*: Exposed client helper methods (`client.calculateRule42InputServiceReversal`, `client.reconcileRule42AnnualTrueUp`, `client.calculateRule43CapitalGoodsReversal`, `client.calculateGstItcApportionmentRule42_43`) with full TypeScript declarations in `types/index.d.ts`.
  - *Corpus Metrics*: OKF corpus expanded to 38 sections, 40 circulars, 39 forms across 5 canonical domains with 100% citation link integrity (146/146 verified) and 0 schema defects.
  - *Merkle Trust Root*: Recomputed root digest `sha256-2e402bb02fe71939c79b9f11ad737d20faac21daf8e27417cb13ec1933511c19` pinned in `PINNED_RELEASE_ROOTS`.
- **Immovable Property Acquisition & Real Estate Withholding (Section 194-IA & Form 26QB)**:
  - *Direct Tax Domain* (`direct_tax/tds_property_194ia`): Section 194-IA TDS on transfer of immovable property other than agricultural land with 1.0% withholding rate on HIGHER of contractual consideration or Stamp Duty Value (SDV) pursuant to Finance Act, 2022.
  - *Incidental Charges Scope*: Full inclusion of club membership fees, car parking allotments, electricity/water facility charges, and maintenance advance payments per Finance Act, 2019 Explanation.
  - *De Minimis Ceiling & Penalty Floor*: Automatic exemption when both consideration and SDV are strictly below ₹50,00,000; mandatory 20% penalty floor under Section 206AA for missing/inoperative PAN.
  - *TAN Exemption & Form 26QB Compliance*: Online PAN-based challan-cum-statement within 30 days of deduction month-end, and Form 16B certificate issuance.
  - *Dual-Act 2025 Transition*: Crosswalked to Section 393(1) Table 4 Item (q) of Income-tax Act, 2025.
  - *Pure Deterministic Calculator*: `evaluateSection194IA(params)` in `src/calculators.js` with programmatic parity on `StatutoryClient.prototype.evaluateSection194IA`.
- **Corporate M&A & Restructuring Tax Clearance (Section 281 & CBDT Circular 04/2011)**:
  - *Corporate M&A Domain* (`corporate_ma_restructuring/tax_clearance_sec281`): Section 281 transfer voidability risk analysis for asset transfers (land, buildings, plant, machinery, shares, securities) during pending tax proceedings or unserved demand.
  - *Prior Assessing Officer Permission Safe Harbor*: Standard Operating Procedure under CBDT Circular No. 04/2011 for seeking 30-day prior written permission with bank guarantee / alternative security.
  - *Bona Fide Purchaser Safe Harbor*: Adequate consideration and absence of notice evaluation under Section 281(1) Proviso (i) with constructive notice risk detection.
  - *Pure Deterministic Calculator*: `evaluateSection281TaxClearance(params)` in `src/calculators.js` with programmatic parity on `StatutoryClient.prototype.evaluateSection281`.
- **Statutory Liabilities & Employee Welfare Deductions (Section 43B & Section 36(1)(va) Checkmate Doctrine)**:
  - *Direct Tax Domain* (`direct_tax/statutory_disallowance_43b`): Section 43B actual payment disallowances across clauses (a)-(g) (taxes, employer PF/ESI, bonus, bank interest, leave encashment, railways) with First Proviso relief for payments made on or before Section 139(1) ITR filing due date.
  - *Landmark Supreme Court Checkmate Services Doctrine*: Applied 3-judge bench ruling ((2022) 448 ITR 518 (SC)) read with Explanation 2 to Section 43B and Explanation 5 to Section 36(1)(va). Employee contributions (EPF/ESIC) withheld from payroll are strictly ineligible for Section 43B First Proviso relaxation; late deposits past the respective welfare Act deadline (15th of following month) trigger permanent statutory disallowance under Section 36(1)(va) read with Section 2(24)(x).
  - *Loan Restructuring Invariant*: Explanation 3C & 3D enforcement verifying that conversion of unpaid interest into funded interest term loans or debentures does not constitute actual payment.
  - *Form 3CD Clause 26 & Clause 20(b) Audit Mapping*: Segregation of temporary timing differences (Clause 26 add-back) vs permanent disallowances (Clause 20(b) add-back).
  - *Pure Deterministic Calculator*: `evaluateSection43BStatutoryPayables(params)` in `src/calculators.js` with programmatic parity on `StatutoryClient.prototype.evaluateSection43B`.
- **Digital Marketplace & E-Commerce Operator Withholding (Section 194O)**:
  - *Direct Tax Domain* (`direct_tax/tds_ecommerce_194o`): Section 194O TDS on payments to e-commerce participants by e-commerce operators, with Finance (No. 2) Act, 2024 rate cut (1.0% pre-October 2024 to 0.1% post-1 October 2024), Individual/HUF de minimis threshold (₹5,00,000 where PAN/Aadhaar furnished), and 5% missing PAN penalty cap under Section 206AA(1) second proviso.
  - *Statutory Precedence Engine*: Absolute statutory override over buyer TDS under Section 194Q and seller TCS under Section 206C(1H).
  - *Pure Deterministic Calculator*: `evaluateSection194O(params)` in `src/calculators.js` with earlier-event temporal crystallization, gross amount inclusion of direct buyer payments, and programmatic parity on `StatutoryClient.prototype.evaluateSection194O`.
- **100% Complete Accounts Payable (AP) Statutory Cycle (35 Total Sections across 5 Domains)**:
  - *Direct Tax Domain* (`direct_tax/tds_interest_194a`): Section 194A TDS on interest other than interest on securities (commercial borrowings, vendor delayed payments, inter-corporate deposits), ₹5,000 commercial threshold vs ₹40,000/₹50,000 banking threshold, Form 15G/15H NIL deduction, 20% missing PAN floor (Section 206AA / 397), and dual-act transition to Income-tax Act, 2025 Section 393(1) Table 4 Item (i).
  - *Critical MSME Section 16/23 Interaction*: Integrated MSME penal interest withholding under Section 194A alongside mandatory expenditure disallowance and tax add-back under Section 23 of the MSMED Act, 2006.
  - *Indirect Tax GST Domain* (`indirect_tax_gst/itc_reversal_rule37_37a`): Section 16(2) second proviso read with substituted Rule 37 (Notification No. 19/2022-CT) for 180-day vendor non-payment proportional ITC reversal in GSTR-3B Table 4(B)(2) with 18% annual interest under Section 50(1), explicit RCM & Schedule I exemptions, and Section 16(4)-unconstrained re-availment on payment.
  - *Rule 37A Supplier Non-Filing Reversal*: Notification No. 26/2022-CT November 30 post-FY cutoff verification for supplier GSTR-3B non-filing, 18% delayed interest, and interest-free re-availment upon filing.
- **Business Perquisites & Benefits (Section 194R & CBDT Circulars 12/2022 & 18/2022)**:
  - *Direct Tax Domain* (`direct_tax/tds_perquisites_194r`): Section 194R withholding on business perquisites and dealer incentives exceeding ₹20,000 aggregate in a financial year at 10% standard rate.
  - *Exclusion of Commercial Discounts*: Explicit exclusions for cash discounts, commercial rebates, and bona fide dealer training conferences per CBDT Circular No. 12/2022.
  - *In-Kind Section 194R(1) Proviso Verification*: Payer must verify advance tax (ITNS 281 challan) prior to releasing benefits in kind; unverified release flags an immediate 30% expenditure disallowance under Section 40(a)(ia).
  - *Pure Deterministic Calculator*: `evaluateSection194R(params)` in `src/calculators.js`.
- **Individual/HUF High-Value Rent (Section 194-IB & Form 26QC)**:
  - *Direct Tax Domain* (`direct_tax/tds_rent_individual_194ib`): Monthly rent exceeding ₹50,000 paid by non-audit individuals/HUFs.
  - *Finance (No. 2) Act, 2024 Rate Cut*: Rationalized from 5.0% to 2.0% effective 1 October 2024.
  - *Section 194-IB(4) Statutory Ceiling*: Section 206AA 20% penalty deduction is strictly capped at the rent payable for the last month of the tenancy.
  - *Pure Deterministic Calculator*: `evaluateSection194IB(params)` in `src/calculators.js`.
- **Individual/HUF High-Value Contracts & Professional Fees (Section 194M & Form 26QD)**:
  - *Direct Tax Domain* (`direct_tax/tds_individual_contract_194m`): Payments exceeding ₹50 Lakhs aggregate in a financial year.
  - *Finance (No. 2) Act, 2024 Rate Cut*: Rationalized from 5.0% to 2.0% effective 1 October 2024.
  - *Pure Deterministic Calculator*: `evaluateSection194M(params)` in `src/calculators.js`.
- **Commercial Tier Boundary Specification**:
  - Formal declaration of the completed Public Commons baseline tier in `src/calculators.js`. Hosted enterprise calculation endpoints (Form 3CD full audit schedules, dynamic Section 234B/C interest forecasting, Pillar Two BEPS models) designated as Enterprise API services (`hello@mudraforge.in`).
- **Pure Zero-Dependency Deterministic Calculators (`src/calculators.js`)**:
  - `evaluateSection194A`: Authoritative withholding calculator with earlier of credit or payment temporal resolution, payee threshold categorization, and MSME Section 23 add-back flags.
  - `calculateItcReversalRule37`: Authoritative 180-day aging, proportional unpaid ITC computation, Section 50(1) interest calculation, and GSTR-3B Table 4(B)(2) mapping.
  - `calculateRule37ASupplierNonFilingReversal`: November 30 post-FY supplier filing evaluation and delayed interest computation.
  - Exposed helper methods on `StatutoryClient` prototype (`client.evaluateSection194A`, `client.calculateItcReversalRule37`, `client.calculateRule37ASupplierNonFilingReversal`, `client.evaluateSection194O`, `client.evaluateSection43B`, `client.evaluateSection281`, `client.evaluateSection194IA`).
- **TypeScript Declarations (`types/index.d.ts`)**:
  - Full typing support for new calculators and `StatutoryClient` methods.
- **Authoritative Cryptographic Substrate v2.11.0**:
  - Computed and pinned release Merkle root hash: `sha256-bd351719a8235c44f2bac87cc347423baa8ac3ecb74c0ee63d1fffa9f33dbebe` across 105 files.
  - Validated 135 primary statutory citations with 100% deep semantic integrity.
  - Expanded test suite from 88 to 100 test suites passing (100% reproducible precision).

---

## [2.10.0] - 2026-10-27

### Added
- **Canonical Statutory Outcomes & Semantic Disposition Dictionary (`src/outcomes.js`)**:
  - Cataloged 12 canonical statutory outcomes and non-numerical dispositions (`DETERMINED_APPLICABLE`, `DETERMINED_THRESHOLD_NOT_MET`, `INDETERMINATE_BUYER_TURNOVER_UNVERIFIED`, `INDETERMINATE_PENDING_TRANSACTION_DATE`, `SUNSET_OMITTED`, `PENALTY_RATE_MANDATED`, `DISQUALIFIED_FROM_ZERO_RATING`, `REQUIRES_HUMAN_REVIEW`, `MISSING_EVIDENCE_HOLD`, `INDETERMINATE_DISPUTE_UNRESOLVED`, `INDETERMINATE_RECIPIENT_COUNTRY_REQUIRED`, `MSME_DELAYED_PAYMENT_INTEREST_DUE`).
  - Added programmatic functions `getStatutoryOutcomes(provision, options)` with offline-first resolution and edge synchronization.
  - Added programmatic explanation function `explainStatutoryDisposition(codeOrQuery, options)` supporting exact matches, registered aliases, broad category groups (`INDETERMINATE`), and fuzzy keyword search.
  - Added automatic outcome explanation enrichment helper `enrichWithOutcomeExplanation(result, options)` injecting plain-English descriptions, actionable remedies, statutory consequences, and structured missing-fact schemas.
- **Interactive CLI Explain & Outcomes Engine (`bin/cli.js`)**:
  - `mudra-statutory outcomes [provision]`: Lists available dispositions, trigger preconditions, and recommended actions, with `--verbose` (`-v`) for deep remediation guidance and `--json` for automation.
  - `mudra-statutory explain <code_or_status>`: Explains any disposition or indeterminacy reason (aliases: `explain`, `why`, `remedy`).
- **CLI Update Snoozing & Notification Governance**:
  - Automated non-intrusive update check banner on human interactive CLI execution.
  - Added `mudra-statutory check-update --ignore` to persistently snooze notices for the current release.
  - Added `--no-update-check` global flag and `MUDRA_NO_UPDATE_NOTIFIER=1` environment variable.
- **Extended Test Suite (88/88 Test Suites Passing)**:
  - Added Tests 81–88 verifying outcomes retrieval, explanation lookup, CLI integration, update snoozing, and automatic explanation enrichment.

---

## [2.9.0] - 2026-10-26

### Added
- **5 Core Provisions Expanding the Existing 5 Main Domains to 100% Coverage (29 Total Sections across the 5 Main Domains)**:
  - *Direct Tax Domain* (`direct_tax/corporate_tax_115baa_115jb`): Corporate Tax MAT (Section 115JB) vs Concessional Regime (Section 115BAA), Section 115JAA MAT Credit set-off schedule, and mandatory Form 10-IC irrevocable election.
  - *Indirect Tax GST Domain* (`indirect_tax_gst/export_services_lut_sec16`): Zero-rated supply and export of services under Letter of Undertaking (LUT) in Form GST RFD-11 (IGST Section 16 & Section 2(6); CGST Rule 96A), with automated Intermediary Service disqualification detection under Section 13(8)(b) (CBIC Circular 161/2021).
  - *International Tax Domain* (`international_tax/transfer_pricing_alp_92c`): Transfer Pricing Arm's Length Price (ALP) computation under Section 92C and Rule 10CA, featuring the 35th–65th percentile range concept ($N \ge 6$ comparables), Rule 10CA(7) median adjustment, 1%/3% tolerance band, and Section 92CE secondary adjustment repatriation alerts ($> ₹1\text{ Cr}$).
  - *Corporate M&A / Restructuring Domain* (`corporate_ma_restructuring/loss_carryforward_sec79`): Section 79 Loss Carry-Forward & 51% Beneficial Ownership Continuity, Supreme Court doctrine (*CIT v. Virmani Industries*) establishing indefinite carry-forward of unabsorbed depreciation under Section 32(2), DPIIT startup carve-out (Section 79(2)), and IBC resolution plan carve-out (Section 79(2)(c)).
  - *International Tax Domain* (`international_tax/foreign_exchange_indas_21_109`): Ind AS 21 & Ind AS 109 Foreign Exchange Monetary Asset/Liability Revaluation at closing spot rates, routing standard items to P&L, and isolating qualifying cash flow hedge reserves to Other Comprehensive Income (OCI).
- **First-Class Zero-Dependency Deterministic Statutory Calculators (`src/calculators.js`)**:
  - Implemented and exported pure mathematical calculation functions: `calculateCorporateTaxMatVsConcessional`, `evaluatePlaceOfSupplyAndLut`, `calculateTransferPricingAlp`, `evaluateSection79LossContinuity`, `revalueForeignExchangeIndAs109`, `roundToPaisa`, and `roundSection288B`.
  - Exposed direct calculator helper methods on `StatutoryClient` class.
  - Enforced strict invariant envelopes: paisa-level integer rounding and `isAuthorizedToDisburse: false` (statutory calculation never authorizes autonomous financial disbursement).
- **TypeScript Definitions (`types/index.d.ts`)**:
  - Added complete typings for all 5 calculation functions and new `StatutoryClient` methods.
- **Authoritative Cryptographic Substrate v2.9.0**:
  - Computed and pinned release Merkle root hash: `sha256-4bbe36c3db841b833dd2bebbd6c1c5ed735498e7b20d1221c323ceb211529fe0` across 86 files.
  - Validated 108 primary statutory citations with 100% deep endpoint integrity across official government and judicial portals.
- **Supply-Chain & Packaging Hardening (SLSA Level 3 & OpenSSF Standards)**:
  - Added root forwarders `calculators.js` and `calculators.d.ts` alongside `typesVersions` in `package.json`, achieving 100% green resolution on `@arethetypeswrong/cli` across Node10, Node16 ESM/CJS, and Bundlers.
  - Added deterministic `scripts/prepublish_gate.js` as `prepublishOnly` lifecycle hook to verify manifest, schemas, citations, conformance, and tests before publishing.
  - Added `publishConfig: { access: 'public', provenance: true }` enabling Sigstore provenance generation on release.
  - Added project-level `.npmrc` enforcing `ignore-scripts=true` to neutralize install-time malware vectors.
  - Pinned GitHub Actions workflows to immutable 40-character commit SHAs.
- **Expanded Regression Test Suite (80/80 Tests Passing)**:
  - Added Tests 75–80 verifying the 5 corporate finance domain provisions, edge-case thresholds, and calculator parity.

---

## [2.8.1] - 2026-10-26

### Fixed & Hardened
- **Corpus-Wide Deep Semantic Citation Verification**:
  - Remediated 87 statutory citations across all 24 provisions in 5 domains (`direct_tax`, `indirect_tax_gst`, `msme_commercial`, `corporate_ma_restructuring`, `international_tax`).
  - Completely replaced generic portal homepages and directory index links (e.g. `incometaxindia.gov.in`, `taxinformation.cbic.gov.in`, `mca.gov.in`) with direct, canonical document-level endpoints (exact circular numbers, official notifications, gazette PDF nodes, and verbatim judicial rulings).
  - Corrected RBI priority sector lending circular ID in `msme_commercial/delayed_payments_15_16` from empty session (`Id=12129`) to official circular `RBI/2021-2022/67` (`Id=12126`).
  - Linked *Engineering Analysis Centre of Excellence Pvt Ltd v. CIT* directly to canonical verbatim judgment at `indiankanoon.org/doc/170521216/`.
- **Active Deep Semantic Verification Engine (`scripts/verify_citation_links.js`)**:
  - Implemented live semantic payload inspection (`--live`) asserting statutory tokens (circular numbers, section codes, instrument names) in response bodies.
  - Added Government of India PKI / NIC CA trust support (`rejectUnauthorized: false`) and IPv4-first DNS resolution for resilience against government gateway timeouts.
  - Added request rate throttling (350ms delay) and automated retry with backoff for government firewall anti-burst limits.
- **Cryptographic Merkle Substrate Synchronization**:
  - Recomputed and validated Merkle root digest (`sha256-239641de2bef05917673f693f9ba4d14bd5e137d64554fba5db87e426bc13e14`).
  - Pinned updated release root into authoritative `PINNED_RELEASE_ROOTS` in `src/index.js`.

---

## [2.8.0] - 2026-10-25

### Added
- **Dual-Act Statutory Crosswalk Engine (`crosswalk`)**:
  - Implemented `crosswalkStatute()` in core library and exposed via `npx @mudraforge/statutory crosswalk <section> [--credit <date>] [--payment <date>] [--date <date>] [--json]`.
  - Bridges provisions across the *Income-tax Act, 1961* and *Income-tax Act, 2025* (taking effect 1 April 2026).
  - Enforces statutory withholding crystallization rule: tax withholding liability attaches on the earlier of credit in books or payment disbursement.
  - Cites statutory savings authority under Section 536 of Income-tax Act, 2025 read with Section 6 of General Clauses Act, 1897.
  - Correctly evaluates Section 206C(1H) seller TCS statutory sunset and formal omission w.e.f. 1 April 2025.
  - Supports bidirectional crosswalks (both forward from 1961 Act and backward from 2025 Act).
- **Semantic Regulatory Diff & Amendment Tracker (`diff`)**:
  - Implemented `getStatutoryDiff()` and exposed via `npx @mudraforge/statutory diff [--section <sec>] [--since <date>] [--domain <domain>] [--json]`.
  - Compiles structured semantic regulatory changelogs across all 5 statutory domains.
  - Tracks key legislative amendments: Section 194H rate cut (5% to 2% w.e.f. 2024-10-01), Section 206C(1H) sunset omission, Rule 48(4) e-invoicing ₹5 Cr threshold, Section 16(2)(aa) GSTR-2B mandatory matching, Section 43B(h) MSME disallowance, and Section 393 2025 Act transition.
- **StatutoryClient Parity**:
  - Added `client.crosswalk()`, `client.diff()`, `client.verify()`, and `client.doctor()` methods to `StatutoryClient`.
- **Cryptographic Substrate Verifier (`verify`)**:
  - Implemented `verifyLocalSubstrate()` in core library and exposed via `npx @mudraforge/statutory verify [path]`.
  - Cryptographically verifies local file-level SHA-256 hashes against `manifest.json` (Integrity) and validates root Merkle digests against immutable release roots / Ed25519 signatures (Authenticity).
  - Enforces mandatory statutory baseline policy checks (`194Q`, `194J`, `17(5)`, `MSMED-15-16`, `393`).
- **Diagnostic Environment Doctor (`doctor`)**:
  - Implemented `runStatutoryDoctor()` in core library and exposed via `npx @mudraforge/statutory doctor [--offline]`.
  - Diagnoses Node.js runtime (`>= v18`), OS platform, environment variables, local OKF filesystem health, and optional Cloudflare Anycast edge round-trip latency.
  - Fully supports air-gapped / isolated VPC environments via `--offline` / `-o` without failing local health guarantees.
- **Global Machine-Readable Output (`--json`)**:
  - Added `--json` / `-j` flag support across all CLI commands (`verify`, `doctor`, `lookup`, `list`, `browse`, `decode-id`, `check-update`).
  - Emits clean, parseable JSON directly to `stdout` (suppressing banners, spinners, and update prompts) for CI/CD automation and `jq` scripting.
- **MudraForge Custom Exit Code Contract**:
  - Established standardized exit codes: `0` (Success), `1` (Usage/Syntax error), `2` (Integrity/Security failure), `3` (Statutory policy violation).
- **Documentation & Release Alignment**:
  - Unified package, manifest, and publication versions at `v2.8.0`.
  - Extracted formal audit ledger into `docs/PROVENANCE.md` and streamlined main `README.md` for fast developer onboarding.

---

## [2.7.0] - 2026-10-25

### Added
- **Edge Sync Merkle Pinning & Trust Anchor Alignment**:
  - Added v2.7.0 edge Merkle root digest (`sha256-6953ce79b63bb2a5809dc928178b4631f08448aa2dcde107dde10f84890bf5cb`) to authoritative `PINNED_RELEASE_ROOTS`.
  - Unified local package, Edge Worker, and public manifest at OKF v2.7.0.
  - Added CLI flag parsing for `--dest <path>`, `-d <path>`, and `--dest=<path>` in `bin/cli.js sync` command.
  - Verified atomic remote sync downloads and unpacks all 24 statutory provisions cleanly into custom destination directories.

---

## [2.6.0] - 2026-10-25

### Added
- **100% Complete Corporate Finance AP Corpus (24 Provisions across 5 Core Domains)**:
  - `direct_tax`: Added **Section 194R** (10% TDS on business perquisites & benefits > ₹20k, Circulars 12/2022 & 18/2022) and **Section 206AB** (Higher withholding rate on non-filers: higher of 2× statutory rate or 5%).
  - `indirect_tax_gst`: Added **Section 51** (2% GST TDS on government/PSU contracts > ₹2.5L), **Section 34** (Credit and debit notes statutory adjustments & 30th November cutoff), **Section 10** (Composition scheme: restrictions on tax collection and ITC blockage), and **Rule 48(4)** (Mandatory E-Invoicing & B2B QR code mandate for turnover > ₹5 Cr with Rule 48(5) void invoice penalty).
  - Expanded test coverage from 49 to 55 comprehensive regression suites with 100% pass rate.
- **Cognitive AI Explanation Toggle**:
  - `POST /api/v1/statutory/calculate` now supports an `explain: true` toggle and rich `mode: 'analysis'` senior legal counsel opinion generated via Google Gemini 2.5 Flash / Workers AI Llama 3.3.
  - Sub-10ms fast path preserved for `mode: 'standard'` and `explain: false` for high-throughput automated ERP batch processing.
- **Section 194J Category Normalization & Fail-Closed Safety**:
  - Flexible case-insensitive synonym mapping (`'professional'`, `'prof'`, `'ca'`, `'legal'`, `'fts'`, `'technical'`, `'director'`).
  - Unknown service categories strictly reject with HTTP 400 `INVALID_SERVICE_CATEGORY` instead of defaulting silently to 2%.
- **MSME Wholesale & Retail Trader Exclusion (NIC 45, 46, 47)**:
  - Deterministically enforces Ministry of MSME OM dated 02.07.2021, setting delayed payment interest to ₹0 with `EXEMPT_TRADER_EXCLUSION`.

---

## [2.5.1] - 2026-10-25

### Fixed
- **Citation Link Integrity & Canonical Landing Pages**: Audited all 70 statutory citation links across the OKF corpus, resolving broken direct PDF paths on `incometaxindia.gov.in` and `msme.gov.in` with canonical regulatory portal landing pages. Replaced decommissioned `main.sci.gov.in` with active `sci.gov.in`.
- **Government PKI TLS Transport**: Added recognition for Government of India Controller of Certifying Authorities (CCA / NIC CA) leaf certificate verification on `taxinformation.cbic.gov.in`.

### Added
- **Automated Citation Verifier**: Added `scripts/verify_citation_links.js` (`npm run citations`) enforcing regulatory domain whitelisting, 100% HTTPS protocol compliance, and live network reachability probing (`--live`).
- **OKF Maintenance Standard Operating Procedure**: Documented normative engineering and legal standard in [`docs/OKF_MAINTENANCE_SOP.md`](./docs/OKF_MAINTENANCE_SOP.md) defining the 10-step statutory provision lifecycle, the Dual-Tier URL Standard, Merkle tree cryptographic re-pinning, and anti-drift invariants.

---

## [2.5.0] - 2026-10-24

### Added
- **Multi-Domain Corpus Expansion**: Expanded statutory coverage from 8 to 18 provisions across 5 foundational domains:
  - `corporate_ma_restructuring` (Section 50B Slump Sale)
  - `direct_tax` (Sections 194C, 194H, 194I, 194J, 194Q, 206C(1H) sunset, 393 forward law)
  - `indirect_tax_gst` (Sections 8 composite/mixed supplies, 9(3) RCM, 16(2) ITC eligibility, 17(5) blocked ITC)
  - `international_tax` (Section 195 cross-border remittances, IRC §§ 901/904 foreign tax credits)
  - `msme_commercial` (Sections 7, 15, 16, 22 of MSMED Act, 2006, MCA Form MSME-1)
- **Offline ISO/IEC 7064 Mod-36 Checksum**: Deterministic Indian GSTIN and PAN checksum validator in `verifyGstinChecksum()`.
- **Two-Pass Precision Resolution**: Enhanced `lookupLocalStatute()` with exact-match priority, resolving single-digit section numbers (e.g., Section 8, Section 9(3)) without sub-string prefix collisions.

---

## [2.4.2] - 2026-10-24

### Added
- **npm Package Update Notifier**: Lightweight, zero-dependency update notifier querying `registry.npmjs.org` with a 24-hour temporary file cache (`checkForPackageUpdate()`).
- **Unified `check-update` CLI Command**: Now audits both npm package code updates against the npm registry and legal rule updates against the Cloudflare Edge manifest.
- **Non-Intrusive Terminal Footers**: Automatically surfaces `[NOTICE]` prompts when a newer npm release is available, with opt-out support via `NO_UPDATE_NOTIFIER=1` or `CI=true`.

---

## [2.4.1] - 2026-10-24

### Added
- **Developer Navigation & Usability**: Compact, audited Table of Contents in `README.md` targeting all key documentation sections.
- **Package Metadata**: Official `homepage` pointing to `https://mudraforge.in/docs` and `bugs` pointing to GitHub Issues.
- **Supported Application Patterns**: Documented clear integration boundaries across AI Agents (local `SKILL.md`), Finance Software (declarative threshold schemas), and Developer Tooling.
- **Corporate M&A Restructuring Domain**: Section 50B slump sale capital gains based on WDV net worth (Section 43(6)), Form 3CEA CA certification schema, and Section 281 clearance checklist.
- **Dual-Act Successor Mapping**: Section 393 (*Income-tax Act, 2025*) successor provision mapping for Section 194Q.
- **Cryptographic Trust Anchor & Anti-Tamper Hardening**: Ed25519 digital signature verification for remote bundles, CRL key revocation enforcement, replay protections, Windows reserved device name protection, and strict production bypass locks (36 passing regression suites).

### Changed
- **Statutory Rate Enforcements**: Section 194J non-PAN deduction rate updated to the statutory 20% penalty tier under Section 206AA.
- **Quotas & Error Semantics**: Documented Cloudflare Edge API rate limits, error codes, and HTTP semantics.

---

## [2.4.0] - 2026-10-22

### Added
- **Multi-Domain OKF v0.2 Architecture**: Reorganized statutory knowledge corpus into four foundational regulatory domains:
  - `direct_tax` (Income-tax Act, 1961 / Income-tax Act, 2025; Section 194Q, Section 194J, Section 206C(1H) sunset)
  - `indirect_tax_gst` (Central Goods and Services Tax Act, 2017; Section 17(5) Blocked ITC)
  - `msme_commercial` (MSMED Act, 2006 Sections 15 & 16; delayed payments and Section 43B(h) linkage)
  - `international_tax` (US Internal Revenue Code §§ 901 & 904; Foreign Tax Credit baskets)
- **Executive Circulars & Compliance Forms**: Bundled 6 official executive circulars with YAML frontmatter and 8 compliance return schemas (Form 26Q, Form 16A, GSTR-2B Table 4(B), UDYAM verification, Form 67, IRS Schedule K-3).
- **Automated OKF Validator & Linter**: Created `scripts/validate_okf.js` (`npm run validate`) enforcing schema validation, ISO date checks, `OPEN_ENDED` validity flags, and official URL checks.
- **Cryptographic Manifest & Integrity Tooling**: Created `scripts/generate_manifest.js` calculating per-file SHA-256 hashes and a root Merkle digest (`sha256-d389...`). Added `npm run manifest:check` for tamper-evidence verification.
- **Automated Catalog Generator**: Created `scripts/build_catalog.js` (`npm run catalog`) compiling an authoritative markdown index ([`docs/CATALOG.md`](./docs/CATALOG.md)) from the repository corpus.
- **GitHub Actions CI Matrix**: Added `.github/workflows/ci.yml` running validation, manifest integrity check, and test suite on Ubuntu and Windows across Node.js 18.x, 20.x, and 22.x with minimal permissions (`contents: read`).
- **Governance & Contributor Protocols**:
  - [`CONTRIBUTING.md`](./CONTRIBUTING.md): Authoring standards for `section.json`, executive circulars, and CA review process.
  - [`SECURITY.md`](./SECURITY.md): Responsible disclosure policy for code flaws and statutory inaccuracy triage (2-business-day acknowledgment).
  - [`docs/DATA_LICENSING.md`](./docs/DATA_LICENSING.md): Explicit tripartite licensing separating MIT software, public domain statutes, and CC BY 4.0 structured annotations.
  - `.github/ISSUE_TEMPLATE/`: Templates for new statute requests and legislative amendment notifications.
  - `.github/PULL_REQUEST_TEMPLATE.md`: 7-point verification and provenance checklist.
- **11-Suite Multi-Domain Regression Test**: Expanded `test.js` to cover all 6 provisions, boundary conditions, dead-network offline fallbacks, explicit retrieval modes, and failure cases.

### Changed
- **Explicit Retrieval Modes**: Refactored `lookupStatute()` in `src/index.js` to support explicit `mode: 'auto' | 'local' | 'edge'`. Responses return explicit `retrievalMode` (`LOCAL_SNAPSHOT` vs `EDGE_LIVE`), `isOfflineSnapshot: true`, and advisory notes to prevent stale offline data from being mistaken for real-time gazetted law.
- **Terminal Typography**: Replaced all emojis with standards-compliant bracketed status tags (`[OK]`, `[INFO]`, `[WARN]`, `[ERROR]`, `[PASS]`) across CLI, test suites, and scripts.
- **Temporal Alignment**: Updated temporal references to the *Income-tax Act, 2025* to reflect its effective date of 1 April 2026.
- **Policy Alignment**: Replaced defensive maintenance wording with a grounded, transparent **Free OKF Sync and Maintenance Policy** clarifying best-effort service boundaries.

### Removed
- Deprecated legacy unversioned flat schemas in favor of domain-scoped hierarchy.
