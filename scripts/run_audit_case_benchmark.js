import {
    evaluateSection194Q,
    evaluateSection43bH,
    evaluateSection194J,
    calculateItcReversalRule37,
    decodeTaxIdentifier,
    calculateMsmeCompoundInterest,
    roundToPaisa
} from '../src/usvm/domain_math.js';

const SARVAM_API_KEY = process.env.SARVAM_API_KEY || 'sk_4vv09rza_qqWvL27j6s2a0YH3vcmm0x7w';

/**
 * Call live Sarvam-105B model for practitioner-grade statutory prose explanation
 * Configured with medium reasoning effort and 8192 max tokens
 */
async function callSarvam105b(prompt) {
    try {
        const response = await fetch('https://api.sarvam.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-subscription-key': SARVAM_API_KEY
            },
            body: JSON.stringify({
                model: 'sarvam-105b',
                messages: [
                    {
                        role: 'system',
                        content: 'You are MudraForge Statutory Advisory AI. Explain the deterministic legal conclusions and accounting voucher clearly and concisely for a practicing Chartered Accountant. Highlight the statutory citations, the exact math, and any audit risks.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                reasoning_effort: 'medium',
                max_tokens: 8192,
                temperature: 0.2
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            return `[Sarvam API HTTP ${response.status} Error]: ${errText}`;
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim() || '[No content returned from model]';
    } catch (err) {
        return `[Sarvam Connection Error]: ${err.message}`;
    }
}

const BENCHMARK_CASES = [
    {
        caseId: 'CASE-01',
        title: 'Goods Purchase Cumulative Spend & 60-Day Terms',
        domain: 'direct_tax / msme_commercial',
        rawQuery: `We received a bill of ₹23,60,000 (Basic ₹20,00,000 + 18% IGST ₹3,60,000) dated 01 May 2025 from Precision Castings Ltd (PAN: ABCDP1234F, registered as a Micro Manufacturer with Udyam). 
Our total sales turnover was ₹18.5 Crore in FY 2024-25. 
We have already purchased ₹45,00,000 worth of goods from them earlier this financial year. 
The invoice states a 60-day credit term. 
What tax should we deduct before paying them, and can we legally pay in 60 days?`,

        excelFormulas: {
            tdsTaxableBase: `=IF(AND(BuyerTurnover > 100000000, (PriorFYSpend + BasicInvoice) > 5000000), MAX(0, MIN(BasicInvoice, (PriorFYSpend + BasicInvoice) - 5000000)), 0)`,
            tdsDeduction: `=ROUND(TaxableBase * 0.1%, 2)`,
            msmedCutoffDate: `=IF(IsMicroOrSmallSupplier="YES", InvoiceDate + MIN(ContractDays, 45), InvoiceDate + ContractDays)`,
            yearEndDisallowance: `=IF(AND(IsMicroOrSmallSupplier="YES", ActualPaymentDate > MSMEDCutoffDate, ActualPaymentDate > FYEndDate), "DISALLOWED_43B_H", "ALLOWABLE")`
        },
        
        executeEngine() {
            const sec194Q = evaluateSection194Q({
                invoiceAmount: 2000000,
                priorFyPurchases: 4500000,
                buyerTurnoverCr: 18.5,
                hasPan: true,
                isPanInoperative: false,
                gstAmountInr: 360000,
                isGstSeparatelyIndicated: true,
                transactionDate: '2025-05-01'
            });

            const sec43B = evaluateSection43bH({
                invoiceDate: '2025-05-01',
                agreedTermsDays: 60,
                supplierType: 'MICRO_MANUFACTURER'
            });

            const basic = 2000000;
            const gst = 360000;
            const tds = sec194Q.calculatedTdsInr;
            const vendorPayable = roundToPaisa((basic + gst) - tds);

            return {
                statutesIdentified: [
                    'Section 194Q, Income-tax Act, 1961',
                    'CBDT Circular No. 23 of 2017 (Basic Unbundling)',
                    'Section 15, MSMED Act, 2006 (45-Day Cap)',
                    'Section 43B(h), Income-tax Act, 1961'
                ],
                taxableBaseInr: sec194Q.taxableBase,
                statutoryRate: '0.1%',
                tdsAmountInr: tds,
                paymentCutoffDate: sec43B.statutoryDueDate,
                contractualOverride: 'Contractual 60 days is legally void; capped at 45 days.',
                generalLedgerVoucher: {
                    debit: [
                        { account: 'Raw Material Inventory / Expense', amountInr: basic },
                        { account: 'GST Input Tax Credit (IGST)', amountInr: gst }
                    ],
                    credit: [
                        { account: 'TDS Payable (Section 194Q @ 0.1%)', amountInr: tds },
                        { account: 'Vendor Accounts Payable (Precision Castings Ltd)', amountInr: vendorPayable }
                    ],
                    totalDebitInr: basic + gst,
                    totalCreditInr: roundToPaisa(tds + vendorPayable),
                    isBalanced: (basic + gst) === roundToPaisa(tds + vendorPayable)
                }
            };
        }
    },

    {
        caseId: 'CASE-02',
        title: 'Wholesale Trader Unpaid at Year-End',
        domain: 'msme_commercial / direct_tax',
        rawQuery: `We have an unpaid bill of ₹8,50,000 from Apex Steel Traders dated 15 January 2025. 
They provided an active Udyam Certificate showing Micro Enterprise under wholesale trade of metals (NIC 46632). 
Due to a working capital crunch, we could not clear their dues by 31 March 2025, and finally paid them on 10 April 2025 (85 days from bill date). 
Will our tax auditor disallow this expense in this year's tax audit, and do we have to pay mandatory compound interest to the supplier?`,

        excelFormulas: {
            traderExemptionCheck: `=IF(OR(LEFT(NICCode, 2)="45", LEFT(NICCode, 2)="46", LEFT(NICCode, 2)="47"), "TRADER_EXEMPT_OM_2021", "ELIGIBLE_MSMED")`,
            disallowanceStatus: `=IF(TraderExemption="TRADER_EXEMPT_OM_2021", "ALLOWABLE_ACCRUAL", IF(PaymentDate > FYEndDate, "DISALLOWED_43B_H", "ALLOWABLE"))`,
            penalInterest: `=IF(TraderExemption="TRADER_EXEMPT_OM_2021", 0, CompoundInterest(Principal, DaysElapsed, 3*RBIRepoRate))`
        },

        executeEngine() {
            const sec43B = evaluateSection43bH({
                invoiceDate: '2025-01-15',
                paymentDate: '2025-04-10',
                fyEndDate: '2025-03-31',
                supplierType: 'TRADER',
                nicCode: '46632'
            });

            return {
                statutesIdentified: [
                    'Section 43B(h), Income-tax Act, 1961',
                    'Ministry of MSME OM No. 2/1(5)/2021-P&G/Policy dated 02.07.2021',
                    'MSMED Act, 2006 Chapter V'
                ],
                isCoveredBy43Bh: sec43B.isCoveredBy43Bh,
                isDisallowedUnder43Bh: sec43B.isDisallowed,
                penalInterestApplicable: false,
                taxAuditImplication: 'Full expense of ₹8,50,000 is 100% ALLOWABLE in FY 2024-25. No reporting required under Clause 22 or Clause 26 of Form 3CD.'
            };
        }
    },

    {
        caseId: 'CASE-03',
        title: 'IT Consultant with Inoperative PAN',
        domain: 'direct_tax',
        rawQuery: `We engaged an individual IT consultant, Rajesh Verma, to rebuild our cloud database architecture and backend APIs. 
He sent an invoice for ₹2,50,000 + 18% GST (₹45,000), total ₹2,95,000 dated 10 June 2025. 
His PAN is ABCPV9876K, but the income tax portal says his PAN is inoperative because it was not linked with Aadhaar. 
What tax rate should we deduct from his invoice, and how should this be booked in our accounts?`,

        excelFormulas: {
            baseTdsRate: `=IF(ServiceCategory="TECHNICAL_SERVICES", 2%, 10%)`,
            effectiveTdsRate: `=IF(IsPanInoperative="YES", MAX(BaseRate, 20%), BaseRate)`,
            tdsDeduction: `=BasicInvoiceAmount * EffectiveTdsRate`
        },

        executeEngine() {
            const sec194J = evaluateSection194J({
                invoiceAmount: 250000,
                serviceCategory: 'TECHNICAL_SERVICES',
                hasPan: true,
                isPanInoperative: true,
                gstAmountInr: 45000,
                isGstSeparatelyIndicated: true,
                transactionDate: '2025-06-10'
            });

            const basic = 250000;
            const gst = 45000;
            const tds = sec194J.calculatedTdsInr;
            const vendorPayable = roundToPaisa((basic + gst) - tds);

            return {
                statutesIdentified: [
                    'Section 194J(1)(b) (Fees for Technical Services - 2%)',
                    'CBDT Circular No. 23 of 2017 (GST Basic Stripping)',
                    'Section 206AA(1)(iii) (Inoperative PAN 20% Floor)',
                    'CBDT Circular No. 3 of 2023 read with Rule 114AAA'
                ],
                baseRatePercent: 2.0,
                effectiveRatePercent: sec194J.effectiveRatePercent,
                tdsAmountInr: tds,
                generalLedgerVoucher: {
                    debit: [
                        { account: 'Professional & Technical Fees (P&L)', amountInr: basic },
                        { account: 'GST Input Tax Credit (CGST/SGST)', amountInr: gst }
                    ],
                    credit: [
                        { account: 'TDS Payable (Section 194J / 206AA @ 20%)', amountInr: tds },
                        { account: 'Sundry Creditors / Vendor Payable (Rajesh Verma)', amountInr: vendorPayable }
                    ],
                    totalDebitInr: basic + gst,
                    totalCreditInr: roundToPaisa(tds + vendorPayable),
                    isBalanced: (basic + gst) === roundToPaisa(tds + vendorPayable)
                }
            };
        }
    },

    {
        caseId: 'CASE-04',
        title: 'Long-Pending Freight Dispute',
        domain: 'indirect_tax_gst',
        rawQuery: `We booked a freight invoice from Delta Logistics on 01 April 2024 for ₹1,18,000 (Freight ₹1,00,000 + 18% IGST ₹18,000) and claimed the ₹18,000 input tax credit in our April GST return. 
Due to an ongoing dispute over container detention charges, we haven't paid them a single rupee as of 01 November 2024 (7 months elapsed). 
Do we have to give back the GST credit to the government, is there any interest penalty, and can we take the credit back if we settle the bill later?`,

        excelFormulas: {
            daysElapsed: `=CalculationDate - InvoiceDate`,
            mandatoryReversal: `=IF(DaysElapsed > 180, ProportionalITC, 0)`,
            interestLiability: `=ROUND(MandatoryReversal * 18% * (DaysElapsed / 365), 2)`,
            reAvailmentStatus: `=IF(ActualSettlementMade="YES", "RECLAIMABLE_TABLE_4A5", "HOLD_IN_REVERSAL")`
        },

        executeEngine() {
            const rule37Result = calculateItcReversalRule37({
                invoiceNumber: 'INV-DELTA-2024-089',
                invoiceDate: '2024-04-01',
                calculationDate: '2024-11-01',
                invoiceAmount: 118000,
                taxAmount: 18000,
                paidAmount: 0
            });

            return {
                statutesIdentified: [
                    'Second Proviso to Section 16(2), CGST Act, 2017 (180-Day Ceiling)',
                    'Rule 37, CGST Rules, 2017 (GSTR-3B Table 4(B)(2) Reversal)',
                    'Section 50(1), CGST Act, 2017 (18% Annual Interest Liability)',
                    'Section 16(4) Re-availment Exception'
                ],
                daysElapsed: rule37Result.daysElapsed,
                reversalAmountInr: rule37Result.reversalAmountInr,
                interestPayableInr: rule37Result.interestPayableInr,
                gstr3bReportingTable: rule37Result.gstr3bReportingTable,
                canReclaimOnPayment: rule37Result.canReclaimOnPayment
            };
        }
    }
];

export async function runBenchmarkSuite() {
    console.log('='.repeat(80));
    console.log('MUDRAFORGE BENCHMARK SUITE — LIVE DUAL-ENGINE + SARVAM-105B ADVISORY');
    console.log('Substrate: @mudraforge/statutory@2.11.0 | LLM Model: Sarvam-105B Live API');
    console.log('Mode: reasoning_effort="medium" | max_tokens=8192');
    console.log('='.repeat(80));

    for (const testCase of BENCHMARK_CASES) {
        console.log(`\n>>> [${testCase.caseId}] ${testCase.title}`);
        console.log(`Domain: ${testCase.domain}`);
        console.log('-'.repeat(80));
        
        console.log('\n[PHASE 1: RAW UNSTRUCTURED AP QUERY (Input)]');
        console.log(testCase.rawQuery.trim());

        console.log('\n[PHASE 2: DETERMINISTIC STATUTORY ENGINE (@mudraforge/statutory)]');
        const engineResult = testCase.executeEngine();
        console.log(JSON.stringify(engineResult, null, 2));

        console.log('\n[PHASE 3: LIVE SARVAM-105B STATUTORY ADVISORY PROSE (Real API Call)]');
        const prompt = `Accountant Query:\n${testCase.rawQuery}\n\nDeterministic Engine Results:\n${JSON.stringify(engineResult, null, 2)}\n\nPlease provide a concise 3-4 bullet point executive statutory advisory explanation of this position for a practicing Chartered Accountant. Cite the exact statutory sections and circulars.`;
        console.log('... Querying Sarvam-105B endpoint via https://api.sarvam.ai/v1/chat/completions ...');
        const sarvamResponse = await callSarvam105b(prompt);
        console.log(sarvamResponse);

        console.log('\n[PHASE 4: MATHEMATICAL & EXCEL SPREADSHEET FORMULAS]');
        for (const [key, formula] of Object.entries(testCase.excelFormulas)) {
            console.log(`   ${key}: ${formula}`);
        }

        console.log('='.repeat(80));
    }
}

// Run suite
runBenchmarkSuite();
