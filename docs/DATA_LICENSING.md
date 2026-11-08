# Data Licensing, Provenance & Attribution Policy

`@mudraforge/statutory` adheres to an explicit tripartite licensing model. Open-source data and software licenses govern different layers of the package: executable computation code, primary statutory texts, and derived structured knowledge representations.

This document clearly distinguishes between:
1. **The Software Code, USVM Kernel & Tooling (Business Source License 1.1)**
2. **Primary Government Legal Sources (Public Domain / Statutory Exemption)**
3. **Derived OKF Structured Knowledge & Annotations (CC BY 4.0)**

---

## 1. Software Code, USVM Kernel & Tooling (Business Source License 1.1)

All executable code, the Universal Statutory Virtual Machine (USVM) compiler and execution kernel, client libraries, CLI binaries, test suites, and validation scripts in this repository are licensed under the **[Business Source License 1.1 (BSL 1.1)](../LICENSE)**:

- `src/` (Client runtime, USVM execution kernel, compiler, and domain calculators)
- `bin/` (Command-line interface)
- `scripts/` (Linter, manifest generator, catalog builder)
- `test.js` (Regression test suite)

### Terms of the BSL 1.1:
- **Free for Internal & Developer Use**: You may use the software free of charge for internal business operations, compliance, development, testing, research, and integration into internal AI agents and automation systems.
- **Commercial SaaS Use Limitation**: You may not provide the software, or any derivative work thereof, as a commercial cloud-hosted statutory calculation service, hosted API, or embed it as a core feature inside a competing commercial software-as-a-service (SaaS) accounting, enterprise resource planning (ERP), or tax filing platform distributed or provided to third parties without an Enterprise Commercial License.
- **Conversion to MIT**: On **April 1, 2030**, the license automatically converts to the **MIT License**.
- **Commercial Inquiries**: For commercial embedding or OEM licensing, contact `hello@mudraforge.in` or `support@mudraforge.in`.

---

## 2. Primary Government Legal Sources (Public Domain / Statutory Exemption)

Verbatim statutory provisions, legislative Acts, executive circulars, notifications, and gazette extracts published in this repository originate from official government publications:

### Republic of India
- **Governing Law**: Section 52(1)(q) of the *Copyright Act, 1957* (Act No. 14 of 1957) provides that the reproduction or publication of any matter published in any Official Gazette, any Act of a Legislature, or any report of a committee appointed by Government does **not** constitute an infringement of copyright.
- **Open Data Framework**: Sourced from official portals (`incometaxindia.gov.in`, `cbic-gst.gov.in`, `msme.gov.in`, `egazette.gov.in`) in accordance with the National Data Sharing and Accessibility Policy (NDSAP) of the Government of India.
- **Copyright Status**: Primary statutory and executive texts are free of copyright restrictions for public reuse and reproduction.

### United States of America
- **Governing Law**: 17 U.S.C. § 105 provides that copyright protection is not available for any work of the United States Government.
- **Sourced Material**: Title 26 of the United States Code (Internal Revenue Code §§ 901 & 904) and IRS Instructions (Form 1116, Schedule K-3) are in the public domain.

---

## 3. Derived OKF Knowledge Schemas, Annotations & Relational Maps (CC BY 4.0)

The intellectual property in:
- The structured JSON schemas (`section.json`), field nomenclature, and schema taxonomies;
- The temporal state machine definitions (`validFrom`, `validTo`, `annualReset`, `sunsetNotes`);
- The curated plain-text summaries, threshold abstracts, and accounting directives;
- The cross-statute forward-mapping bridges (*Income-tax Act, 1961* to *Income-tax Act, 2025*);
- The Markdown circular frontmatter conventions and compliance form schemas

is authored by **MudraForge** and licensed under the **[Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)** license.

### Attribution Notice
You are free to share and adapt the structured data for commercial or non-commercial purposes, provided you give appropriate credit:

```
Statutory knowledge structure derived from @mudraforge/statutory 
(MudraForge), licensed under CC BY 4.0 / BSL 1.1.
Source Repository: https://github.com/mondeep0123/mudraforge-statutory
```

---

## 4. Non-Endorsement & Epistemic Disclaimer

1. **No Government Affiliation**: MudraForge Knowledge Systems Private Limited is an independent private technology company. This project is not affiliated with, sponsored by, or endorsed by the Ministry of Finance, the Central Board of Direct Taxes (CBDT), the Central Board of Indirect Taxes and Customs (CBIC), the Ministry of MSME, or the US Internal Revenue Service.
2. **No Audit or Legal Opinion**: The machine-readable representations in this repository are published for informational, developer, and agentic workflows. They do not constitute formal legal counsel, tax opinions, or statutory audit certification.
