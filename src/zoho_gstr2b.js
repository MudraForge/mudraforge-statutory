/**
 * =============================================================================
 * @MUDRAFORGE/STATUTORY — ZOHO BOOKS & GSTR-2B AP RECONCILIATION ENGINE
 * =============================================================================
 *
 * Implements an end-to-end Accounts Payable (AP) purchase register and
 * GSTR-2B automated reconciliation workflow.
 *
 * Statutory Baseline & Accounting Architecture:
 * 1. CGST Act Section 16(2)(aa) & Rule 36(4):
 *    - Input Tax Credit (ITC) can only be availed if invoice details have been
 *      furnished by the supplier in Form GSTR-1 and communicated to the
 *      recipient in Form GSTR-2B.
 *    - Distinguishes outright non-filing from recent timing differences (QRMP/IFF).
 * 2. CGST Act Section 17(5) Blocked Credits:
 *    - Invoices matching GSTR-2B but falling under blocked statutory categories
 *      (e.g., motor vehicles, food & beverages, personal consumption) are
 *      segregated into MATCHED_INELIGIBLE_STATUTORY_BLOCK_17_5.
 * 3. Place of Supply (POS) & Distinct Person Jurisdiction (IGST Act Sec 7, 8, 10, 12):
 *    - Decouples 4 orthogonal decisions on every transaction:
 *      a) Tax Determination (Intrastate vs Interstate correctness under IGST Act),
 *      b) Recipient Jurisdiction (Filing GSTIN vs Distinct Person branch GSTIN u/s 25(4)),
 *      c) ITC Eligibility (Eligible, Blocked u/s 17(5), Stranded local levy u/s 12(3), or Defective),
 *      d) Operational Routing (Claim 4A5, Route to Branch, Book as Expense, Demand Credit Note).
 * 4. CGST Act Section 16(2) Second Proviso read with Rule 37 & Rule 88B(3):
 *    - Proportional reversal on partial payments: accounts for value vs tax payment appropriation
 *      ('PROPORTIONATE', 'VALUE_FIRST', 'TAX_FIRST').
 *    - Reverse Charge (RCM) and Schedule I deemed supplies are statutorily exempt.
 *    - Section 50(1) interest is audited against actual Electronic Credit Ledger (ECL) balances
 *      per Rule 88B(3). Zero interest applies if ECL balance remained above unreversed ITC.
 *    - Subsequent re-availment upon payment (Rule 37(4)) is exempt from Section 16(4) time-bar.
 * 5. Epistemic Uncertainty & Human-in-the-Loop Governance:
 *    - When evidence is incomplete (missing POS, invalid GSTIN checksum, duplicate invoice numbers,
 *      unlinked credit notes, or missing ECL history), the engine issues an explicit
 *      REQUIRES_HUMAN_VERIFICATION disposition rather than manufacturing false certainty.
 * 6. Zero external dependencies: Pure native ES modules.
 */

import crypto from 'node:crypto';
import {
    cleanNumericAmount,
    toIntegerPaise,
    fromIntegerPaise,
    roundToPaisa
} from './numeric.js';
import { isValidGstinChecksum } from './index.js';

/**
 * Calculates the exact Day 180 overdue date for an invoice under Section 16(2) second proviso.
 *
 * @param {string} billDateIso - ISO date string (YYYY-MM-DD)
 * @returns {string|null}
 */
export function calculateOverdueStartDate(billDateIso) {
    if (!billDateIso) return null;
    const d = new Date(billDateIso);
    if (isNaN(d.getTime())) return null;
    d.setDate(d.getDate() + 180);
    return d.toISOString().slice(0, 10);
}

/**
 * Calculates exact chronological interest under Section 50(1) read with Rule 88B(3)
 * across an array of daily or step Electronic Credit Ledger (ECL) balance entries.
 *
 * Implements Explanation (1) to Rule 88B:
 * "Input tax credit wrongly availed shall be construed to have been utilized, when the balance in
 * the electronic credit ledger falls below the amount of input tax credit wrongly availed,
 * and the extent of utilization, shall be the amount by which the balance falls below the amount."
 *
 * Handles:
 * 1. Balance never falling below unreversed ITC -> 0% interest throughout.
 * 2. Temporary dips below unreversed ITC -> interest strictly for the dip days on the dipped portion.
 * 3. Multiple dips and subsequent recoveries -> day-weighted sum across all dip intervals.
 * 4. Partial utilization -> interest calculated strictly on max(0, unreversedItc - balance).
 * 5. Reversal occurring after utilization -> interest ceases on reversal date.
 *
 * @param {Object} params
 * @param {number} params.unreversedItcInr - Total unreversed / wrongly availed ITC amount
 * @param {string} params.overdueStartDate - ISO date string (YYYY-MM-DD) when 180 days expired
 * @param {string} params.asOfDate - ISO date string (YYYY-MM-DD) of assessment / audit
 * @param {string} [params.reversalDate] - Optional ISO date string when taxpayer reversed ITC
 * @param {Array<{ date: string, balanceInr: number }>} params.eclLedgerHistory - Chronological ledger snapshots
 * @param {number} [params.annualInterestRate=0.18] - Statutory annual interest rate (default 18% p.a.)
 * @returns {Object}
 */
export function calculateEclUtilizationInterest({
    unreversedItcInr,
    overdueStartDate,
    asOfDate,
    reversalDate = null,
    eclLedgerHistory = [],
    annualInterestRate = 0.18
}) {
    const unreversedItcPaise = toIntegerPaise(unreversedItcInr, 'unreversedItcInr');
    if (unreversedItcPaise <= 0) {
        return {
            totalInterestInr: 0,
            totalInterestPaise: 0,
            totalOverdueDays: 0,
            utilizedDaysCount: 0,
            zeroUtilizationDaysCount: 0,
            maxWrongfulUtilizationInr: 0,
            chronologicalIntervals: [],
            explanation: 'Unreversed ITC is zero. No interest payable.',
            isAuthorizedToDisburse: false
        };
    }

    const startNorm = normalizeIsoDate(overdueStartDate);
    const asOfNorm = normalizeIsoDate(asOfDate);
    const reversalNorm = reversalDate ? normalizeIsoDate(reversalDate) : null;

    if (!startNorm || !asOfNorm) {
        throw new Error('[@mudraforge/statutory] overdueStartDate and asOfDate must be valid ISO date strings (YYYY-MM-DD)');
    }

    let effectiveEndDate = asOfNorm;
    if (reversalNorm && reversalNorm < effectiveEndDate) {
        effectiveEndDate = reversalNorm;
    }

    const startMs = new Date(startNorm).getTime();
    const endMs = new Date(effectiveEndDate).getTime();

    if (endMs <= startMs) {
        return {
            totalInterestInr: 0,
            totalInterestPaise: 0,
            totalOverdueDays: 0,
            utilizedDaysCount: 0,
            zeroUtilizationDaysCount: 0,
            maxWrongfulUtilizationInr: 0,
            chronologicalIntervals: [],
            explanation: `Reversal or audit date (${effectiveEndDate}) is on or before overdue start date (${startNorm}). Zero overdue days; zero interest payable.`,
            isAuthorizedToDisburse: false
        };
    }

    const totalOverdueDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));

    const sortedHistory = (Array.isArray(eclLedgerHistory) ? eclLedgerHistory : [])
        .filter(e => e && e.date)
        .map(e => ({
            date: normalizeIsoDate(e.date),
            balancePaise: toIntegerPaise(e.balanceInr, 'eclBalanceInr'),
            igstPaise: e.igstBalanceInr !== undefined ? toIntegerPaise(e.igstBalanceInr) : null,
            cgstPaise: e.cgstBalanceInr !== undefined ? toIntegerPaise(e.cgstBalanceInr) : null,
            sgstPaise: e.sgstBalanceInr !== undefined ? toIntegerPaise(e.sgstBalanceInr) : null,
            cessPaise: e.cessBalanceInr !== undefined ? toIntegerPaise(e.cessBalanceInr) : 0
        }))
        .filter(e => e.date !== null)
        .sort((a, b) => a.date.localeCompare(b.date));

    if (sortedHistory.length === 0) {
        return {
            totalInterestInr: 0,
            totalInterestPaise: 0,
            totalOverdueDays,
            utilizedDaysCount: 0,
            zeroUtilizationDaysCount: 0,
            maxWrongfulUtilizationInr: 0,
            chronologicalIntervals: [],
            explanation: 'Electronic Credit Ledger balance history is empty. Rule 88B(3) utilization cannot be computed without ledger closing balances.',
            isAuthorizedToDisburse: false
        };
    }

    // Coalesce same-day entries to net daily closing balance
    const dateMap = new Map();
    for (const entry of sortedHistory) {
        dateMap.set(entry.date, entry);
    }
    const coalescedHistory = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    function getBalancePaiseOnDate(dayIso) {
        let activeBalance = coalescedHistory[0].balancePaise;
        for (const entry of coalescedHistory) {
            if (entry.date <= dayIso) {
                activeBalance = entry.balancePaise;
            } else {
                break;
            }
        }
        return activeBalance;
    }

    let totalInterestPaisePrecise = 0;
    let utilizedDaysCount = 0;
    let zeroUtilizationDaysCount = 0;
    let maxWrongfulUtilizationPaise = 0;

    const dailyEvaluations = [];

    let currentMs = startMs;
    while (currentMs < endMs) {
        const currentIso = new Date(currentMs).toISOString().slice(0, 10);
        const dayBalancePaise = getBalancePaiseOnDate(currentIso);

        const wrongfulUtilizedPaise = Math.max(0, unreversedItcPaise - dayBalancePaise);

        if (wrongfulUtilizedPaise > 0) {
            utilizedDaysCount++;
            if (wrongfulUtilizedPaise > maxWrongfulUtilizationPaise) {
                maxWrongfulUtilizationPaise = wrongfulUtilizedPaise;
            }
            const dayInterestPaise = wrongfulUtilizedPaise * (annualInterestRate / 365);
            totalInterestPaisePrecise += dayInterestPaise;
            dailyEvaluations.push({
                date: currentIso,
                balanceInr: fromIntegerPaise(dayBalancePaise),
                utilizedInr: fromIntegerPaise(wrongfulUtilizedPaise),
                dayInterestInr: roundToPaisa(dayInterestPaise / 100)
            });
        } else {
            zeroUtilizationDaysCount++;
            dailyEvaluations.push({
                date: currentIso,
                balanceInr: fromIntegerPaise(dayBalancePaise),
                utilizedInr: 0,
                dayInterestInr: 0
            });
        }

        currentMs += 1000 * 60 * 60 * 24;
    }

    const chronologicalIntervals = [];
    if (dailyEvaluations.length > 0) {
        let currentInterval = {
            startDate: dailyEvaluations[0].date,
            endDate: dailyEvaluations[0].date,
            days: 1,
            eclBalanceInr: dailyEvaluations[0].balanceInr,
            utilizedAmountInr: dailyEvaluations[0].utilizedInr,
            intervalInterestPaise: dailyEvaluations[0].dayInterestInr * 100
        };

        for (let i = 1; i < dailyEvaluations.length; i++) {
            const day = dailyEvaluations[i];
            if (day.utilizedInr === currentInterval.utilizedAmountInr && day.balanceInr === currentInterval.eclBalanceInr) {
                currentInterval.endDate = day.date;
                currentInterval.days++;
                currentInterval.intervalInterestPaise += day.dayInterestInr * 100;
            } else {
                currentInterval.intervalInterestInr = fromIntegerPaise(Math.round(currentInterval.intervalInterestPaise));
                delete currentInterval.intervalInterestPaise;
                chronologicalIntervals.push(currentInterval);

                currentInterval = {
                    startDate: day.date,
                    endDate: day.date,
                    days: 1,
                    eclBalanceInr: day.balanceInr,
                    utilizedAmountInr: day.utilizedInr,
                    intervalInterestPaise: day.dayInterestInr * 100
                };
            }
        }
        currentInterval.intervalInterestInr = fromIntegerPaise(Math.round(currentInterval.intervalInterestPaise));
        delete currentInterval.intervalInterestPaise;
        chronologicalIntervals.push(currentInterval);
    }

    const roundedInterestPaise = Math.round(totalInterestPaisePrecise);
    const totalInterestInr = fromIntegerPaise(roundedInterestPaise);
    const maxWrongfulUtilizationInr = fromIntegerPaise(maxWrongfulUtilizationPaise);

    let explanation = '';
    if (utilizedDaysCount === 0) {
        explanation = `Rule 88B(3) Proviso: Electronic Credit Ledger balance remained equal to or above unreversed ITC (₹${fromIntegerPaise(unreversedItcPaise).toLocaleString('en-IN')}) for all ${totalOverdueDays} overdue days. Credit was unutilized; ₹0.00 interest payable.`;
    } else {
        explanation = `Rule 88B(3): Electronic Credit Ledger dipped below unreversed ITC (max dip ₹${maxWrongfulUtilizationInr.toLocaleString('en-IN')}) for ${utilizedDaysCount} of ${totalOverdueDays} overdue days. Section 50(1) 18% p.a. interest computed strictly on utilized amounts across dip intervals totaling ₹${totalInterestInr.toLocaleString('en-IN')}.`;
        if (reversalNorm && reversalNorm < asOfNorm) {
            explanation += ` Interest accrual ceased on reversal date (${reversalNorm}).`;
        }
    }

    return {
        totalInterestInr,
        totalInterestPaise: roundedInterestPaise,
        totalOverdueDays,
        utilizedDaysCount,
        zeroUtilizationDaysCount,
        maxWrongfulUtilizationInr,
        chronologicalIntervals,
        explanation,
        isAuthorizedToDisburse: false
    };
}

/**
 * Reconstruct cumulative portfolio ECL utilization for multiple overlapping overdue invoices under Rule 88B(3).
 * Accurately pools overlapping unreversed ITC and computes multi-invoice shortfall against daily ledger balances.
 *
 * @param {Object} params
 * @param {Array<Object>} params.overdueBills
 * @param {Array<{date: string, balanceInr: number}>} params.eclLedgerHistory
 * @param {string} params.asOfDate
 * @param {number} [params.annualInterestRate=0.18]
 * @returns {Object} CumulativePortfolioEclAuditResult
 */
export function calculatePortfolioEclUtilizationInterest(params = {}) {
    const overdueBills = Array.isArray(params.overdueBills) ? params.overdueBills : [];
    const eclLedgerHistory = Array.isArray(params.eclLedgerHistory) ? params.eclLedgerHistory : [];
    const asOfDate = normalizeIsoDate(params.asOfDate || new Date().toISOString().slice(0, 10));
    const annualInterestRate = typeof params.annualInterestRate === 'number' ? params.annualInterestRate : 0.18;

    if (overdueBills.length === 0 || eclLedgerHistory.length === 0) {
        return {
            totalInterestInr: 0,
            totalInterestPaise: 0,
            totalOverdueDays: 0,
            utilizedDaysCount: 0,
            zeroUtilizationDaysCount: 0,
            maxPortfolioUtilizationInr: 0,
            chronologicalIntervals: [],
            explanation: 'Zero overdue bills or empty ECL ledger history for portfolio analysis.',
            isAuthorizedToDisburse: false
        };
    }

    // Coalesce same-day entries to net daily closing balance
    const dateMap = new Map();
    for (const e of eclLedgerHistory) {
        if (!e || !e.date) continue;
        const d = normalizeIsoDate(e.date);
        if (!d) continue;

        const hasHeadwise = (e.igstBalanceInr !== undefined || e.cgstBalanceInr !== undefined || e.sgstBalanceInr !== undefined);
        const igstPaise = toIntegerPaise(e.igstBalanceInr ?? 0);
        const cgstPaise = toIntegerPaise(e.cgstBalanceInr ?? 0);
        const sgstPaise = toIntegerPaise(e.sgstBalanceInr ?? 0);
        const cessPaise = toIntegerPaise(e.cessBalanceInr ?? 0);
        // Exclude Compensation Cess from available general ITC per Circular 192/04/2023-GST
        const balancePaise = hasHeadwise
            ? (igstPaise + cgstPaise + sgstPaise)
            : toIntegerPaise(e.balanceInr ?? 0, 'eclBalanceInr');

        dateMap.set(d, {
            date: d,
            balancePaise,
            hasHeadwise,
            igstPaise,
            cgstPaise,
            sgstPaise,
            cessPaise
        });
    }

    const sortedHistory = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    if (sortedHistory.length === 0) {
        return {
            totalInterestInr: 0,
            totalInterestPaise: 0,
            totalOverdueDays: 0,
            utilizedDaysCount: 0,
            zeroUtilizationDaysCount: 0,
            maxPortfolioUtilizationInr: 0,
            chronologicalIntervals: [],
            explanation: 'Zero valid dates found in ECL ledger history.',
            isAuthorizedToDisburse: false
        };
    }

    let earliestStartMs = Infinity;
    let latestEndMs = -Infinity;

    const normalizedBills = [];
    for (const b of overdueBills) {
        const start = b.overdueStartDate ? normalizeIsoDate(b.overdueStartDate) : calculateOverdueStartDate(b.billDate);
        if (!start) continue;
        const end = b.reversalDate ? normalizeIsoDate(b.reversalDate) : asOfDate;
        const startMs = new Date(start).getTime();
        const endMs = new Date(end).getTime();
        if (startMs >= endMs) continue;

        if (startMs < earliestStartMs) earliestStartMs = startMs;
        if (endMs > latestEndMs) latestEndMs = endMs;

        const revTax = b.unreversedItcInr !== undefined
            ? b.unreversedItcInr
            : (b.rule37ReversalTaxInr !== undefined ? b.rule37ReversalTaxInr : (b.reversalTaxInr !== undefined ? b.reversalTaxInr : b.totalTaxInr));
        const unreversedPaise = toIntegerPaise(revTax || 0);

        const igstPaise = toIntegerPaise(b.igstInr ?? b.igst_amount ?? (b.hasIgst ? revTax : 0));
        const cgstPaise = toIntegerPaise(b.cgstInr ?? b.cgst_amount ?? (!b.hasIgst && b.cgstInr !== undefined ? b.cgstInr : 0));
        const sgstPaise = toIntegerPaise(b.sgstInr ?? b.sgst_amount ?? (!b.hasIgst && b.sgstInr !== undefined ? b.sgstInr : 0));

        normalizedBills.push({
            billNumber: b.billNumber,
            startIso: start,
            endIso: end,
            unreversedPaise,
            igstPaise,
            cgstPaise,
            sgstPaise
        });
    }

    if (normalizedBills.length === 0 || earliestStartMs >= latestEndMs) {
        return {
            totalInterestInr: 0,
            totalInterestPaise: 0,
            totalOverdueDays: 0,
            utilizedDaysCount: 0,
            zeroUtilizationDaysCount: 0,
            maxPortfolioUtilizationInr: 0,
            chronologicalIntervals: [],
            explanation: 'Overdue duration is zero across portfolio bills.',
            isAuthorizedToDisburse: false
        };
    }

    function getBalanceEntry(dayIso) {
        let active = sortedHistory[0];
        for (const entry of sortedHistory) {
            if (entry.date <= dayIso) {
                active = entry;
            } else {
                break;
            }
        }
        return active;
    }

    let currentMs = earliestStartMs;
    let totalInterestPaisePrecise = 0;
    let utilizedDaysCount = 0;
    let zeroUtilizationDaysCount = 0;
    let maxPortfolioUtilizationPaise = 0;
    const dailyEvaluations = [];

    while (currentMs < latestEndMs) {
        const dayIso = new Date(currentMs).toISOString().slice(0, 10);
        let activePoolPaise = 0;
        let poolIgst = 0;
        let poolCgst = 0;
        let poolSgst = 0;

        for (const b of normalizedBills) {
            if (dayIso >= b.startIso && dayIso < b.endIso) {
                activePoolPaise += b.unreversedPaise;
                poolIgst += b.igstPaise;
                poolCgst += b.cgstPaise;
                poolSgst += b.sgstPaise;
            }
        }

        const dayEntry = getBalanceEntry(dayIso);
        let wrongfulUtilizedPaise = 0;

        if (dayEntry.hasHeadwise && (poolIgst > 0 || poolCgst > 0 || poolSgst > 0)) {
            // Circular No. 192/04/2023-GST head-wise utilization rules
            // IGST can be paid from IGST + CGST + SGST (Combined pool)
            const combinedPool = dayEntry.igstPaise + dayEntry.cgstPaise + dayEntry.sgstPaise;
            const igstShortfall = Math.max(0, poolIgst - combinedPool);

            // CGST can be paid from CGST + IGST (SGST not cross-utilizable)
            const cgstAvail = dayEntry.cgstPaise + dayEntry.igstPaise;
            const cgstShortfall = Math.max(0, poolCgst - cgstAvail);

            // SGST can be paid from SGST + IGST (CGST not cross-utilizable)
            const sgstAvail = dayEntry.sgstPaise + dayEntry.igstPaise;
            const sgstShortfall = Math.max(0, poolSgst - sgstAvail);

            wrongfulUtilizedPaise = Math.max(igstShortfall, cgstShortfall, sgstShortfall);
            if (wrongfulUtilizedPaise === 0 && (poolIgst + poolCgst + poolSgst) > combinedPool) {
                wrongfulUtilizedPaise = Math.max(0, (poolIgst + poolCgst + poolSgst) - combinedPool);
            }
        } else {
            wrongfulUtilizedPaise = Math.max(0, activePoolPaise - dayEntry.balancePaise);
        }

        const dayBalPaise = dayEntry.balancePaise;

        if (wrongfulUtilizedPaise > 0) {
            utilizedDaysCount++;
            if (wrongfulUtilizedPaise > maxPortfolioUtilizationPaise) {
                maxPortfolioUtilizationPaise = wrongfulUtilizedPaise;
            }
            const dayInt = wrongfulUtilizedPaise * (annualInterestRate / 365);
            totalInterestPaisePrecise += dayInt;
            dailyEvaluations.push({
                date: dayIso,
                balanceInr: fromIntegerPaise(dayBalPaise),
                activePoolInr: fromIntegerPaise(activePoolPaise),
                utilizedInr: fromIntegerPaise(wrongfulUtilizedPaise),
                dayInterestInr: roundToPaisa(dayInt / 100)
            });
        } else {
            zeroUtilizationDaysCount++;
            dailyEvaluations.push({
                date: dayIso,
                balanceInr: fromIntegerPaise(dayBalPaise),
                activePoolInr: fromIntegerPaise(activePoolPaise),
                utilizedInr: 0,
                dayInterestInr: 0
            });
        }

        currentMs += 1000 * 60 * 60 * 24;
    }

    const chronologicalIntervals = [];
    if (dailyEvaluations.length > 0) {
        let currentInterval = {
            startDate: dailyEvaluations[0].date,
            endDate: dailyEvaluations[0].date,
            days: 1,
            eclBalanceInr: dailyEvaluations[0].balanceInr,
            activePoolInr: dailyEvaluations[0].activePoolInr,
            utilizedAmountInr: dailyEvaluations[0].utilizedInr,
            intervalInterestPaise: dailyEvaluations[0].dayInterestInr * 100
        };

        for (let i = 1; i < dailyEvaluations.length; i++) {
            const day = dailyEvaluations[i];
            if (day.utilizedInr === currentInterval.utilizedAmountInr && day.balanceInr === currentInterval.eclBalanceInr && day.activePoolInr === currentInterval.activePoolInr) {
                currentInterval.endDate = day.date;
                currentInterval.days++;
                currentInterval.intervalInterestPaise += day.dayInterestInr * 100;
            } else {
                currentInterval.intervalInterestInr = fromIntegerPaise(Math.round(currentInterval.intervalInterestPaise));
                delete currentInterval.intervalInterestPaise;
                chronologicalIntervals.push(currentInterval);

                currentInterval = {
                    startDate: day.date,
                    endDate: day.date,
                    days: 1,
                    eclBalanceInr: day.balanceInr,
                    activePoolInr: day.activePoolInr,
                    utilizedAmountInr: day.utilizedInr,
                    intervalInterestPaise: day.dayInterestInr * 100
                };
            }
        }
        currentInterval.intervalInterestInr = fromIntegerPaise(Math.round(currentInterval.intervalInterestPaise));
        delete currentInterval.intervalInterestPaise;
        chronologicalIntervals.push(currentInterval);
    }

    const roundedInterestPaise = Math.round(totalInterestPaisePrecise);
    return {
        totalInterestInr: fromIntegerPaise(roundedInterestPaise),
        totalInterestPaise: roundedInterestPaise,
        totalOverdueDays: dailyEvaluations.length,
        utilizedDaysCount,
        zeroUtilizationDaysCount,
        maxPortfolioUtilizationInr: fromIntegerPaise(maxPortfolioUtilizationPaise),
        chronologicalIntervals,
        explanation: utilizedDaysCount === 0
            ? `Rule 88B(3) Portfolio Proviso: ECL balance exceeded cumulative unreversed ITC pool for all ${dailyEvaluations.length} days across ${normalizedBills.length} overlapping bills. Zero penal interest payable.`
            : `Rule 88B(3) Portfolio Dip: ECL balance dipped below cumulative unreversed ITC pool on ${utilizedDaysCount} days, reaching max shortfall of INR ${fromIntegerPaise(maxPortfolioUtilizationPaise).toLocaleString('en-IN')}. Total portfolio interest: INR ${fromIntegerPaise(roundedInterestPaise).toLocaleString('en-IN')}.`,
        isAuthorizedToDisburse: false
    };
}

/**
 * Constructs an immutable, self-contained evidence provenance record for a statutory reconciliation item.
 * Enables complete forensic reconstruction of the decision chain months later.
 *
 * @param {Object} params
 * @returns {Object}
 */
export function buildEvidenceProvenance({
    bill = null,
    record2b = null,
    matchType = 'UNMATCHED',
    disposition,
    statutorySection,
    jurisdictionDecisions = null,
    uncertaintyReason = null,
    asOfDate = new Date().toISOString().slice(0, 10)
}) {
    const billNum = bill ? bill.billNumber : null;
    const inv2bNum = record2b ? (record2b.invoiceNumber || record2b.billNumber || record2b.inum) : null;
    const gstin = bill ? bill.vendorGstin : (record2b ? record2b.supplierGstin : null);
    const taxable = bill ? bill.taxableAmountInr : (record2b ? record2b.taxableAmountInr : 0);
    const tax = bill ? bill.totalTaxInr : (record2b ? record2b.totalTaxInr : 0);
    const total = bill ? bill.totalAmountInr : (record2b ? record2b.totalAmountInr : 0);

    const sigString = `${billNum || 'NO_BILL'}|${inv2bNum || 'NO_2B'}|${gstin || 'NO_GSTIN'}|${total}|${asOfDate}`;
    const provenanceHash = crypto.createHash('sha256').update(sigString).digest('hex').slice(0, 16);
    const provenanceId = `MF-PROV-${provenanceHash}`;

    return {
        provenanceId,
        provenanceTimestamp: new Date().toISOString(),
        source: {
            sourceSystem: bill && bill.source ? bill.source : 'ZOHO_BOOKS',
            docType: bill && bill.docType ? bill.docType : 'BILL',
            billId: bill && bill.billId ? bill.billId : billNum,
            billNumber: billNum,
            rowNumber: bill && bill.rowNumber ? bill.rowNumber : null
        },
        externalEvidence: {
            sourceSystem: 'GST_PORTAL_GSTR2B',
            presentInGstr2b: Boolean(record2b),
            invoiceNumber: inv2bNum,
            filingPeriod: record2b && record2b.filingPeriod ? record2b.filingPeriod : null,
            supplierFilingStatus: record2b ? (record2b.itcAvailable === false ? 'PORTAL_INELIGIBLE_FLAGGED' : 'FILED_ELIGIBLE') : 'UNFILED_BY_SUPPLIER',
            portalRevReason: record2b && record2b.itcRevReason ? record2b.itcRevReason : null
        },
        matchingMethod: matchType,
        statutoryBasis: {
            governingStatute: 'Central Goods and Services Tax Act, 2017 / Integrated Goods and Services Tax Act, 2017',
            primarySection: statutorySection || 'CGST Act Section 16',
            officialCitations: [
                'CBIC Circular No. 170/02/2022-GST',
                'CBIC Notification No. 19/2022-Central Tax',
                'Notification No. 14/2022-Central Tax (Rule 88B)'
            ]
        },
        inputSnapshot: {
            billNumber: billNum,
            billDate: bill ? bill.billDate : null,
            vendorGstin: gstin,
            taxableAmountInr: taxable,
            totalTaxInr: tax,
            totalAmountInr: total,
            balanceInr: bill ? bill.balanceInr : 0,
            posStateCode: bill ? bill.posStateCode : (record2b ? record2b.posStateCode : null),
            isRcm: bill ? Boolean(bill.isRcm) : (record2b ? Boolean(record2b.isRcm) : false),
            category: bill && bill.category ? bill.category : null
        },
        jurisdictionDecisions: {
            taxClassification: jurisdictionDecisions ? jurisdictionDecisions.taxClassification : 'INDETERMINATE',
            recipientJurisdiction: jurisdictionDecisions ? jurisdictionDecisions.recipientJurisdiction : 'INDETERMINATE',
            itcEligibility: jurisdictionDecisions ? jurisdictionDecisions.itcEligibility : 'INDETERMINATE',
            operationalRouting: jurisdictionDecisions ? jurisdictionDecisions.operationalRouting : 'MANUAL_HUMAN_INVESTIGATION_REQUIRED'
        },
        uncertaintyAssessment: {
            isCertain: !uncertaintyReason,
            uncertaintyReason: uncertaintyReason || 'NONE',
            actionableRemedy: disposition === 'REQUIRES_HUMAN_VERIFICATION' ? 'MANDATORY_HUMAN_INTERVENTION' : 'AUTOMATED_DISPOSITION'
        },
        governanceTrail: {
            requiresHumanReview: disposition === 'REQUIRES_HUMAN_VERIFICATION',
            auditVerificationDate: asOfDate,
            engineIdentity: '@mudraforge/statutory@2.11.0',
            merkleSubstrateRoot: 'sha256-df76c16ed86673426eeb87fafa1c23712830ce5314339ff17fbb2e0e1795e046',
            isAuthorizedToDisburse: false
        }
    };
}

/**
 * Normalizes an invoice number for fuzzy canonical matching across ERP and GSTN.
 * Strips whitespace, converts to uppercase, removes leading zeroes, and collapses separators.
 *
 * @param {string} raw
 * @returns {{ exactKey: string, alphaNumericKey: string }}
 */
export function normalizeInvoiceNumber(raw) {
    if (!raw || typeof raw !== 'string') {
        return { exactKey: '', alphaNumericKey: '' };
    }
    const trimmed = raw.trim().toUpperCase();
    const exactKey = trimmed.replace(/\s+/g, '');
    const alphaNumericKey = trimmed.replace(/[^A-Z0-9]/g, '').replace(/^0+/, '');
    return { exactKey, alphaNumericKey };
}

/**
 * Deterministically checks if category/description indicates commercial immovable property renting.
 * Replaces polynomial backtracking regexes to eliminate ReDoS vulnerabilities.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function isCommercialRentCategory(text) {
    if (!text || typeof text !== 'string') return false;
    const lower = text.toLowerCase();
    if (!lower.includes('rent')) return false;
    return lower.includes('commercial') || lower.includes('office') || lower.includes('property') || lower.includes('warehouse') || lower.includes('godown');
}

/**
 * Normalizes and validates a GSTIN string.
 *
 * @param {string} raw
 * @returns {{ gstin: string|null, pan: string|null, stateCode: string|null, isValid: boolean }}
 */
export function normalizeGstin(raw) {
    if (!raw || typeof raw !== 'string') {
        return { gstin: null, pan: null, stateCode: null, isValid: false };
    }
    const clean = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.length !== 15) {
        return { gstin: clean || null, pan: null, stateCode: null, isValid: false };
    }
    const stateCode = clean.slice(0, 2);
    const pan = clean.slice(2, 12);
    const isValid = isValidGstinChecksum(clean);
    return { gstin: clean, pan, stateCode, isValid };
}

/**
 * Parses Zoho Books Bills CSV export into normalized bill records.
 *
 * @param {string} csvText
 * @returns {Array<Object>}
 */
export function parseZohoBillsCsv(csvText) {
    if (!csvText || typeof csvText !== 'string') {
        throw new Error('[@mudraforge/statutory] Zoho Books CSV content must be a non-empty string.');
    }

    const cleanCsv = csvText.replace(/^\uFEFF/, '');
    const lines = cleanCsv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];

    const firstLine = lines[0];
    const delimiter = !firstLine.includes(',') && firstLine.includes(';') ? ';' : (!firstLine.includes(',') && firstLine.includes('\t') ? '\t' : ',');

    const rawHeaders = parseCsvRow(lines[0], delimiter);
    const headers = rawHeaders.map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, '_'));

    const colIndex = {
        date: findColIndex(headers, ['bill_date', 'date', 'invoice_date']),
        billNo: findColIndex(headers, ['bill_number', 'bill_no', 'invoice_number', 'bill__', 'bill']),
        dueDate: findColIndex(headers, ['due_date', 'payment_due_date']),
        vendorName: findColIndex(headers, ['vendor_name', 'vendor', 'supplier_name', 'party_name']),
        gstin: findColIndex(headers, ['gst_identification_number__gstin_', 'gstin', 'vendor_gstin', 'party_gstin']),
        pos: findColIndex(headers, ['place_of_supply', 'destination_state', 'pos_state', 'pos']),
        status: findColIndex(headers, ['status', 'bill_status']),
        taxableAmount: findColIndex(headers, ['taxable_amount', 'subtotal', 'item_total', 'basic_amount']),
        totalAmount: findColIndex(headers, ['total', 'bill_amount', 'amount', 'gross_amount']),
        balance: findColIndex(headers, ['balance', 'balance_due', 'amount_due', 'outstanding']),
        cgst: findColIndex(headers, ['cgst', 'cgst_amount']),
        sgst: findColIndex(headers, ['sgst', 'sgst_amount']),
        igst: findColIndex(headers, ['igst', 'igst_amount']),
        category: findColIndex(headers, ['account_name', 'item_category', 'category', 'expense_account']),
        isRcm: findColIndex(headers, ['is_reverse_charge_applied', 'reverse_charge', 'is_rcm', 'rcm'])
    };

    if (colIndex.billNo === -1 || (colIndex.totalAmount === -1 && colIndex.taxableAmount === -1)) {
        throw new Error('[@mudraforge/statutory] Zoho Books CSV must include a Bill Number and Total/Taxable Amount column.');
    }

    const bills = [];

    for (let i = 1; i < lines.length; i++) {
        const row = parseCsvRow(lines[i], delimiter);
        if (row.length === 0 || row.every(cell => !cell || !cell.trim())) continue;

        const rawDate = colIndex.date !== -1 ? row[colIndex.date] : null;
        const billDate = normalizeIsoDate(rawDate);

        const rawDueDate = colIndex.dueDate !== -1 ? row[colIndex.dueDate] : null;
        const dueDate = normalizeIsoDate(rawDueDate);

        const billNumber = colIndex.billNo !== -1 ? (row[colIndex.billNo] || `BILL-${i}`).trim() : `BILL-${i}`;
        const vendorName = colIndex.vendorName !== -1 ? (row[colIndex.vendorName] || 'Unknown Vendor').trim() : 'Unknown Vendor';
        const rawGstin = colIndex.gstin !== -1 ? (row[colIndex.gstin] || '').trim().toUpperCase() : '';
        const normalizedGstinObj = normalizeGstin(rawGstin);

        const status = colIndex.status !== -1 ? (row[colIndex.status] || 'unpaid').trim().toLowerCase() : 'unpaid';
        const category = colIndex.category !== -1 ? (row[colIndex.category] || '').trim() : '';
        const rawPos = colIndex.pos !== -1 ? (row[colIndex.pos] || '').trim() : '';

        const rawTaxable = colIndex.taxableAmount !== -1 ? row[colIndex.taxableAmount] : '0';
        const rawTotal = colIndex.totalAmount !== -1 ? row[colIndex.totalAmount] : rawTaxable;
        const rawBalance = colIndex.balance !== -1 ? row[colIndex.balance] : '0';

        const rawCgst = colIndex.cgst !== -1 ? row[colIndex.cgst] : '0';
        const rawSgst = colIndex.sgst !== -1 ? row[colIndex.sgst] : '0';
        const rawIgst = colIndex.igst !== -1 ? row[colIndex.igst] : '0';

        const isCommercialRentRcm = isCommercialRentCategory(category) &&
            (!normalizedGstinObj.gstin || normalizedGstinObj.gstin === 'UNREGISTERED' || normalizedGstinObj.gstin.length < 15) &&
            (!billDate || billDate >= '2024-10-10');
        const isRcm = Boolean((colIndex.isRcm !== -1 ? /true|yes|y|1/i.test(row[colIndex.isRcm] || '') : false) || isCommercialRentRcm);

        const totalAmount = cleanNumericAmount(rawTotal);
        const taxableAmount = colIndex.taxableAmount !== -1 ? cleanNumericAmount(rawTaxable) : totalAmount;
        const balance = cleanNumericAmount(rawBalance);

        const cgst = cleanNumericAmount(rawCgst);
        const sgst = cleanNumericAmount(rawSgst);
        const igst = cleanNumericAmount(rawIgst);
        const totalTax = roundToPaisa(cgst + sgst + igst);

        const { exactKey, alphaNumericKey } = normalizeInvoiceNumber(billNumber);

        // Check if category indicates Section 17(5) blocked credit
        const isBlocked17_5 = /motor|vehicle|food|beverage|catering|club|fitness|personal|gift/i.test(category);

        bills.push({
            source: 'ZOHO_BOOKS',
            docType: 'BILL',
            rowNumber: i + 1,
            billNumber,
            exactKey,
            alphaNumericKey,
            billDate,
            dueDate,
            vendorName,
            vendorGstin: normalizedGstinObj.gstin,
            vendorPan: normalizedGstinObj.pan,
            isGstinValid: normalizedGstinObj.isValid,
            posStateCode: rawPos ? rawPos.slice(0, 2) : (normalizedGstinObj.stateCode || null),
            status,
            category,
            isBlocked17_5,
            isRcm,
            isCommercialRentRcm,
            isSchedule1DeemedSupply: /distinct|related|deemed|schedule\s*1/i.test(category),
            taxableAmountInr: roundToPaisa(taxableAmount),
            cgstInr: roundToPaisa(cgst),
            sgstInr: roundToPaisa(sgst),
            igstInr: roundToPaisa(igst),
            totalTaxInr: totalTax,
            totalAmountInr: roundToPaisa(totalAmount),
            balanceInr: roundToPaisa(balance),
            isFullyPaid: balance <= 0 || status === 'paid'
        });
    }

    return bills;
}

/**
 * Parses Zoho Books API JSON response into normalized bill and vendor credit records.
 * Supports bills array, vendor_credits array, line items, and pagination context.
 *
 * @param {Object|string} jsonData - Raw Zoho Books API response object or JSON string
 * @returns {Array<Object>}
 */
export function parseZohoBillsJson(jsonData) {
    const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;

    // Handle Zoho API error responses
    if (data && typeof data.code === 'number' && data.code !== 0) {
        throw new Error(`[@mudraforge/statutory] Zoho Books API Error (code ${data.code}): ${data.message || 'Unknown API failure'}`);
    }

    const rawBills = Array.isArray(data) ? data : (Array.isArray(data.bills) ? data.bills : []);
    const rawCredits = Array.isArray(data.vendor_credits) ? data.vendor_credits : [];

    const records = [];

    // 1. Process Bills
    for (let idx = 0; idx < rawBills.length; idx++) {
        const b = rawBills[idx];
        const billNumber = (b.bill_number || b.invoice_number || `ZOHO-BILL-${idx + 1}`).trim();
        const { exactKey, alphaNumericKey } = normalizeInvoiceNumber(billNumber);
        const rawGstin = (b.gst_no || b.gstin || b.vendor_gstin || '').trim().toUpperCase();
        const normalizedGstinObj = normalizeGstin(rawGstin);

        const taxableAmount = cleanNumericAmount(b.sub_total || b.taxable_amount || b.total || 0);
        const totalAmount = cleanNumericAmount(b.total || taxableAmount);
        const balance = cleanNumericAmount(b.balance !== undefined ? b.balance : (b.status === 'paid' ? 0 : totalAmount));

        const cgst = cleanNumericAmount(b.cgst_amount || 0);
        const sgst = cleanNumericAmount(b.sgst_amount || 0);
        const igst = cleanNumericAmount(b.igst_amount || 0);
        const totalTax = roundToPaisa(cgst + sgst + igst);

        let category = String(b.category_name || b.account_name || '').trim();
        let isBlocked17_5 = Boolean(b.is_blocked_17_5) || /motor|vehicle|food|beverage|catering|club|fitness|personal|gift/i.test(category);

        // Inspect line items if present
        if (Array.isArray(b.line_items) && b.line_items.length > 0) {
            for (const item of b.line_items) {
                const itemCat = String(item.account_name || item.name || item.description || '');
                if (/motor|vehicle|food|beverage|catering|club|fitness|personal|gift/i.test(itemCat)) {
                    isBlocked17_5 = true;
                    if (!category) category = itemCat;
                }
            }
        }

        const billDateNorm = normalizeIsoDate(b.date || b.bill_date);
        const isCommercialRentRcm = isCommercialRentCategory(category) &&
            (!normalizedGstinObj.gstin || normalizedGstinObj.gstin === 'UNREGISTERED' || normalizedGstinObj.gstin.length < 15) &&
            (!billDateNorm || billDateNorm >= '2024-10-10');
        const isRcm = Boolean(b.is_reverse_charge_applied || b.reverse_charge_vat_registered || b.is_rcm || isCommercialRentRcm);
        const rawPos = String(b.place_of_supply || b.destination_state || '').trim();

        records.push({
            source: 'ZOHO_BOOKS_API',
            docType: 'BILL',
            rowNumber: idx + 1,
            billId: b.bill_id || null,
            billNumber,
            exactKey,
            alphaNumericKey,
            billDate: normalizeIsoDate(b.date || b.bill_date),
            dueDate: normalizeIsoDate(b.due_date),
            vendorName: (b.vendor_name || 'Unknown Vendor').trim(),
            vendorGstin: normalizedGstinObj.gstin,
            vendorPan: normalizedGstinObj.pan,
            isGstinValid: normalizedGstinObj.isValid,
            posStateCode: rawPos ? rawPos.slice(0, 2) : (normalizedGstinObj.stateCode || null),
            status: String(b.status || 'unpaid').toLowerCase(),
            category,
            isBlocked17_5,
            isRcm,
            isCommercialRentRcm,
            isSchedule1DeemedSupply: /distinct|related|deemed|schedule\s*1/i.test(category),
            taxableAmountInr: roundToPaisa(taxableAmount),
            cgstInr: roundToPaisa(cgst),
            sgstInr: roundToPaisa(sgst),
            igstInr: roundToPaisa(igst),
            totalTaxInr: totalTax,
            totalAmountInr: roundToPaisa(totalAmount),
            balanceInr: roundToPaisa(balance),
            isFullyPaid: balance <= 0 || b.status === 'paid'
        });
    }

    // 2. Process Vendor Credits (Credit Notes)
    for (let cIdx = 0; cIdx < rawCredits.length; cIdx++) {
        const c = rawCredits[cIdx];
        const creditNumber = (c.vendor_credit_number || c.credit_note_number || `ZOHO-CREDIT-${cIdx + 1}`).trim();
        const { exactKey, alphaNumericKey } = normalizeInvoiceNumber(creditNumber);
        const rawGstin = (c.gst_no || c.gstin || c.vendor_gstin || '').trim().toUpperCase();
        const normalizedGstinObj = normalizeGstin(rawGstin);

        const rawTaxable = cleanNumericAmount(c.sub_total || c.taxable_amount || c.total || 0);
        const rawTotal = cleanNumericAmount(c.total || rawTaxable);
        const rawCgst = cleanNumericAmount(c.cgst_amount || 0);
        const rawSgst = cleanNumericAmount(c.sgst_amount || 0);
        const rawIgst = cleanNumericAmount(c.igst_amount || 0);

        records.push({
            source: 'ZOHO_BOOKS_API',
            docType: 'VENDOR_CREDIT',
            rowNumber: rawBills.length + cIdx + 1,
            billId: c.vendor_credit_id || null,
            billNumber: creditNumber,
            originalInvoiceNumber: c.reference_number || c.bill_number || null,
            exactKey,
            alphaNumericKey,
            billDate: normalizeIsoDate(c.date),
            dueDate: null,
            vendorName: (c.vendor_name || 'Unknown Vendor').trim(),
            vendorGstin: normalizedGstinObj.gstin,
            vendorPan: normalizedGstinObj.pan,
            isGstinValid: normalizedGstinObj.isValid,
            posStateCode: normalizedGstinObj.stateCode || null,
            status: String(c.status || 'open').toLowerCase(),
            category: 'Vendor Credit / Purchase Return',
            isBlocked17_5: false,
            isRcm: false,
            isSchedule1DeemedSupply: false,
            taxableAmountInr: roundToPaisa(-Math.abs(rawTaxable)),
            cgstInr: roundToPaisa(-Math.abs(rawCgst)),
            sgstInr: roundToPaisa(-Math.abs(rawSgst)),
            igstInr: roundToPaisa(-Math.abs(rawIgst)),
            totalTaxInr: roundToPaisa(-Math.abs(rawCgst + rawSgst + rawIgst)),
            totalAmountInr: roundToPaisa(-Math.abs(rawTotal)),
            balanceInr: 0,
            isFullyPaid: true
        });
    }

    if (data && data.page_context && typeof data.page_context === 'object') {
        records.pageContext = {
            page: Number(data.page_context.page) || 1,
            perPage: Number(data.page_context.per_page) || 200,
            hasMorePage: Boolean(data.page_context.has_more_page),
            total: Number(data.page_context.total) || records.length
        };
    }

    return records;
}

/**
 * Parses GST Portal GSTR-2B JSON data into flat normalized invoice entries.
 * Supports standard GSTN schema including b2b and cdnr sections.
 *
 * @param {Object|string} gstr2bData - Raw GSTR-2B JSON or parsed object
 * @returns {Array<Object>}
 */
export function parseGstr2bJson(gstr2bData) {
    const root = typeof gstr2bData === 'string' ? JSON.parse(gstr2bData) : gstr2bData;
    const data = root.data || root;
    const recipientGstin = (root.gstin || data.gstin || '').trim().toUpperCase();

    const normalizedRecords = [];

    // 1. B2B Invoices
    const b2bList = Array.isArray(data.b2b) ? data.b2b : [];
    for (const supplier of b2bList) {
        const supplierGstin = String(supplier.ctin || '').trim().toUpperCase();
        const normSupplierGstin = normalizeGstin(supplierGstin);
        const supplierName = (supplier.cname || supplier.trade_name || 'Registered Supplier').trim();

        const invoices = Array.isArray(supplier.inv) ? supplier.inv : [];
        for (const inv of invoices) {
            const rawInvNum = String(inv.inum || '').trim();
            const { exactKey, alphaNumericKey } = normalizeInvoiceNumber(rawInvNum);

            const invoiceDate = parseGstPortalDate(inv.idt);
            const totalInvoiceValue = cleanNumericAmount(inv.val || 0);
            const posStateCode = String(inv.pos || '').trim();
            const isRcm = String(inv.rchrg || 'N').trim().toUpperCase() === 'Y';
            const itcAvailable = String(inv.itcavl || 'Y').trim().toUpperCase() === 'Y';
            const itcRevReason = String(inv.rsn || '').trim();

            let taxableSum = 0;
            let igstSum = 0;
            let cgstSum = 0;
            let sgstSum = 0;
            let cessSum = 0;

            const items = Array.isArray(inv.items || inv.itm_det) ? (inv.items || inv.itm_det) : [];
            for (const it of items) {
                taxableSum += cleanNumericAmount(it.txval || 0);
                igstSum += cleanNumericAmount(it.igst || 0);
                cgstSum += cleanNumericAmount(it.cgst || 0);
                sgstSum += cleanNumericAmount(it.sgst || 0);
                cessSum += cleanNumericAmount(it.cess || 0);
            }

            const totalTax = roundToPaisa(igstSum + cgstSum + sgstSum + cessSum);

            normalizedRecords.push({
                source: 'GSTR_2B',
                docType: 'INVOICE',
                invoiceNumber: rawInvNum,
                exactKey,
                alphaNumericKey,
                invoiceDate,
                supplierGstin: normSupplierGstin.gstin,
                supplierPan: normSupplierGstin.pan,
                supplierName,
                recipientGstin,
                posStateCode,
                isRcm,
                itcAvailable,
                itcRevReason: itcRevReason || null,
                taxableAmountInr: roundToPaisa(taxableSum),
                igstInr: roundToPaisa(igstSum),
                cgstInr: roundToPaisa(cgstSum),
                sgstInr: roundToPaisa(sgstSum),
                cessInr: roundToPaisa(cessSum),
                totalTaxInr: totalTax,
                totalAmountInr: roundToPaisa(totalInvoiceValue || (taxableSum + totalTax))
            });
        }
    }

    // 2. CDNR Credit / Debit Notes
    const cdnrList = Array.isArray(data.cdnr) ? data.cdnr : [];
    for (const supplier of cdnrList) {
        const supplierGstin = String(supplier.ctin || '').trim().toUpperCase();
        const normSupplierGstin = normalizeGstin(supplierGstin);
        const supplierName = (supplier.cname || supplier.trade_name || 'Registered Supplier').trim();

        const notes = Array.isArray(supplier.nt) ? supplier.nt : [];
        for (const nt of notes) {
            const rawNoteNum = String(nt.nt_num || '').trim();
            const { exactKey, alphaNumericKey } = normalizeInvoiceNumber(rawNoteNum);
            const noteDate = parseGstPortalDate(nt.nt_dt);
            const originalInvoiceNum = String(nt.inum || '').trim();
            const noteType = String(nt.typ || 'C').toUpperCase(); // 'C' = Credit Note, 'D' = Debit Note
            const isCreditNote = noteType === 'C';

            let multiplier = isCreditNote ? -1 : 1;
            const totalNoteValue = cleanNumericAmount(nt.val || 0) * multiplier;
            const posStateCode = String(nt.pos || '').trim();
            const isRcm = String(nt.rchrg || 'N').trim().toUpperCase() === 'Y';
            const itcAvailable = String(nt.itcavl || 'Y').trim().toUpperCase() === 'Y';
            const itcRevReason = String(nt.rsn || '').trim();

            let taxableSum = 0;
            let igstSum = 0;
            let cgstSum = 0;
            let sgstSum = 0;
            let cessSum = 0;

            const items = Array.isArray(nt.items || nt.itm_det) ? (nt.items || nt.itm_det) : [];
            for (const it of items) {
                taxableSum += cleanNumericAmount(it.txval || 0) * multiplier;
                igstSum += cleanNumericAmount(it.igst || 0) * multiplier;
                cgstSum += cleanNumericAmount(it.cgst || 0) * multiplier;
                sgstSum += cleanNumericAmount(it.sgst || 0) * multiplier;
                cessSum += cleanNumericAmount(it.cess || 0) * multiplier;
            }

            const totalTax = roundToPaisa(igstSum + cgstSum + sgstSum + cessSum);

            normalizedRecords.push({
                source: 'GSTR_2B',
                docType: isCreditNote ? 'CREDIT_NOTE' : 'DEBIT_NOTE',
                invoiceNumber: rawNoteNum,
                originalInvoiceNumber: originalInvoiceNum,
                exactKey,
                alphaNumericKey,
                invoiceDate: noteDate,
                supplierGstin: normSupplierGstin.gstin,
                supplierPan: normSupplierGstin.pan,
                supplierName,
                recipientGstin,
                posStateCode,
                isRcm,
                itcAvailable,
                itcRevReason: itcRevReason || null,
                taxableAmountInr: roundToPaisa(taxableSum),
                igstInr: roundToPaisa(igstSum),
                cgstInr: roundToPaisa(cgstSum),
                sgstInr: roundToPaisa(sgstSum),
                cessInr: roundToPaisa(cessSum),
                totalTaxInr: totalTax,
                totalAmountInr: roundToPaisa(totalNoteValue)
            });
        }
    }

    return normalizedRecords;
}

/**
 * Accounts Payable Reconciliation Engine:
 * Reconciles Zoho Books Bills with Form GSTR-2B.
 *
 * Implements decoupled jurisdictional decisions, Rule 37 payment appropriation,
 * Rule 88B(3) Electronic Credit Ledger balance analysis, and explicit uncertainty routing.
 *
 * @param {Object} params
 * @param {Array<Object>|string} params.zohoBills - Array of parsed Zoho bills or raw CSV text
 * @param {Array<Object>|string} params.gstr2b - Array of parsed GSTR-2B invoices or raw JSON text
 * @param {Object} [params.options]
 * @param {number} [params.options.toleranceInr=1.00] - Rounding tolerance threshold (default ₹1.00)
 * @param {string} [params.options.asOfDate] - Audit date for Rule 37 aging (default today ISO)
 * @param {string} [params.options.recipientGstin] - Current filing recipient GSTIN
 * @param {Array<string>} [params.options.recipientRegisteredStates] - Array of state codes where recipient has distinct registrations
 * @param {Array<string>} [params.options.recipientRegisteredGstins] - Array of recipient pan-India GSTINs
 * @param {'PROPORTIONATE'|'VALUE_FIRST'|'TAX_FIRST'} [params.options.paymentAppropriationMethod='PROPORTIONATE'] - Payment application logic under Rule 37
 * @param {number} [params.options.minimumEclBalanceInr] - Lowest daily closing balance in Electronic Credit Ledger for Rule 88B(3)
 * @param {'UTILIZED'|'UNUTILIZED'|'UNKNOWN'} [params.options.eclUtilizationStatus='UTILIZED'] - ECL status fallback if minimumEclBalanceInr omitted
 * @param {number} [params.options.goodsInTransitWindowDays=15] - Threshold days to classify missing books bill as goods in transit
 * @returns {Object} Full reconciliation payload with metrics and audit trail
 */
export function reconcileZohoGstr2b({ zohoBills, gstr2b, options = {} }) {
    const {
        toleranceInr = 1.00,
        asOfDate = new Date().toISOString().slice(0, 10),
        recipientGstin = null,
        recipientRegisteredStates = [],
        recipientRegisteredGstins = [],
        paymentAppropriationMethod = 'PROPORTIONATE',
        recipientTaxScheme: rawRecipientScheme = 'REGULAR',
        recipientScheme,
        isCompositionDealer = false,
        minimumEclBalanceInr = undefined,
        eclLedgerHistory = [],
        eclUtilizationStatus = 'UTILIZED',
        goodsInTransitWindowDays = 15
    } = options;

    const normalizedRecipientScheme = isCompositionDealer
        ? 'COMPOSITION'
        : (/COMPOSITION/i.test(String(recipientScheme || rawRecipientScheme || ''))
            ? 'COMPOSITION'
            : (/UNKNOWN|INDETERMINATE/i.test(String(recipientScheme || rawRecipientScheme || ''))
                ? 'INDETERMINATE'
                : 'REGULAR'));

    const tolerancePaise = toIntegerPaise(toleranceInr, 'toleranceInr');

    // 1. Ingest & Normalize Inputs
    const rawBills = typeof zohoBills === 'string' ? parseZohoBillsCsv(zohoBills) : (Array.isArray(zohoBills) ? zohoBills : []);
    const raw2b = typeof gstr2b === 'string' ? parseGstr2bJson(gstr2b) : (Array.isArray(gstr2b) ? gstr2b : []);

    const parsedBills = rawBills.map((b, idx) => {
        const billNum = String(b.billNumber || b.invoiceNumber || b.bill_number || b.invoice_number || `BILL-${idx + 1}`).trim();
        const keys = (b.exactKey && b.alphaNumericKey) ? { exactKey: b.exactKey, alphaNumericKey: b.alphaNumericKey } : normalizeInvoiceNumber(billNum);
        const vendorGstin = String(b.vendorGstin || b.gstin || b.gst_no || b.vendor_gstin || '').trim().toUpperCase();
        const gstinObj = vendorGstin ? normalizeGstin(vendorGstin) : null;
        const isGstinValid = typeof b.isGstinValid === 'boolean' ? b.isGstinValid : (options.validateGstinChecksum === true && gstinObj ? gstinObj.isValid : undefined);
        let taxableAmountInr = cleanNumericAmount(b.taxableAmountInr ?? b.taxable_amount ?? b.sub_total ?? 0);
        let cgstInr = cleanNumericAmount(b.cgstInr ?? b.cgst_amount ?? 0);
        let sgstInr = cleanNumericAmount(b.sgstInr ?? b.sgst_amount ?? 0);
        let igstInr = cleanNumericAmount(b.igstInr ?? b.igst_amount ?? 0);

        const itemsArr = Array.isArray(b.lineItems) ? b.lineItems : (Array.isArray(b.line_items) ? b.line_items : []);
        if (itemsArr.length > 0 && taxableAmountInr === 0 && cgstInr === 0 && sgstInr === 0 && igstInr === 0) {
            for (const item of itemsArr) {
                taxableAmountInr += cleanNumericAmount(item.taxableAmount ?? item.taxable_amount ?? item.item_total ?? 0);
                cgstInr += cleanNumericAmount(item.cgstAmount ?? item.cgst_amount ?? 0);
                sgstInr += cleanNumericAmount(item.sgstAmount ?? item.sgst_amount ?? 0);
                igstInr += cleanNumericAmount(item.igstAmount ?? item.igst_amount ?? 0);
            }
            taxableAmountInr = roundToPaisa(taxableAmountInr);
            cgstInr = roundToPaisa(cgstInr);
            sgstInr = roundToPaisa(sgstInr);
            igstInr = roundToPaisa(igstInr);
        }

        const totalTaxInr = b.totalTaxInr !== undefined ? cleanNumericAmount(b.totalTaxInr) : roundToPaisa(cgstInr + sgstInr + igstInr);
        const totalAmountInr = b.totalAmountInr !== undefined ? cleanNumericAmount(b.totalAmountInr) : roundToPaisa(taxableAmountInr + totalTaxInr);
        const balanceInr = b.balanceInr !== undefined ? cleanNumericAmount(b.balanceInr) : (b.balance !== undefined ? cleanNumericAmount(b.balance) : (b.isFullyPaid || b.status === 'paid' ? 0 : totalAmountInr));
        const isFullyPaid = typeof b.isFullyPaid === 'boolean' ? b.isFullyPaid : (balanceInr <= 0 || b.status === 'paid');
        const posStateCode = b.posStateCode !== undefined ? b.posStateCode : (gstinObj ? gstinObj.stateCode : null);
        const isBlocked17_5 = typeof b.isBlocked17_5 === 'boolean' ? b.isBlocked17_5 : /motor|vehicle|food|beverage|catering|club|fitness|personal|gift/i.test(b.category || '');

        const descText = Array.isArray(b.lineItems) ? b.lineItems.map(l => l.description || '').join(' ') : '';
        const isCommercialRent = isCommercialRentCategory((b.category || '') + ' ' + descText) || Boolean(b.isCommercialRent || b.isCommercialRentRcm);
        const isUnregLandlord = (!vendorGstin || vendorGstin === 'UNREGISTERED' || vendorGstin.length < 15);
        const billDateStr = b.billDate || null;

        let isCommercialRentRcm = false;
        let isCompositionExcludedFromRentRcm = false;
        let requiresRentSchemeVerification = false;
        let isInterveningCompositionRegularizedPaid = false;
        let isInterveningCompositionRegularizedUnpaid = false;
        let requiresInterveningRcmPaymentVerification = false;

        if (isCommercialRent && isUnregLandlord) {
            if (!billDateStr || billDateStr < '2024-10-10') {
                isCommercialRentRcm = false;
            } else if (billDateStr >= '2024-10-10' && billDateStr < '2025-01-16') {
                // Intervening period under 55th GST Council meeting recommendation (regularized "as is where is")
                if (normalizedRecipientScheme === 'COMPOSITION') {
                    const hasPaid = b.isRcmPaid === true || b.isRcmTaxPaidInCash === true || b.rcmPaymentStatus === 'PAID' || b.is_rcm_paid === true;
                    const hasUnpaid = b.isRcmPaid === false || b.isRcmTaxPaidInCash === false || b.rcmPaymentStatus === 'UNPAID' || b.is_rcm_paid === false;
                    if (hasPaid) {
                        isInterveningCompositionRegularizedPaid = true;
                    } else if (hasUnpaid) {
                        isInterveningCompositionRegularizedUnpaid = true;
                    } else {
                        requiresInterveningRcmPaymentVerification = true;
                    }
                    isCommercialRentRcm = false;
                } else if (normalizedRecipientScheme === 'INDETERMINATE') {
                    requiresRentSchemeVerification = true;
                    isCommercialRentRcm = false;
                } else {
                    isCommercialRentRcm = true;
                }
            } else {
                // On or after 16 Jan 2025: Notification No. 07/2025-Central Tax (Rate)
                if (normalizedRecipientScheme === 'COMPOSITION') {
                    isCompositionExcludedFromRentRcm = true;
                    isCommercialRentRcm = false;
                } else if (normalizedRecipientScheme === 'INDETERMINATE') {
                    requiresRentSchemeVerification = true;
                    isCommercialRentRcm = false;
                } else {
                    isCommercialRentRcm = true;
                }
            }
        }

        if (b.isCompositionExcludedFromRentRcm !== undefined) {
            isCompositionExcludedFromRentRcm = Boolean(b.isCompositionExcludedFromRentRcm);
        }
        if (b.requiresRentSchemeVerification !== undefined) {
            requiresRentSchemeVerification = Boolean(b.requiresRentSchemeVerification);
        }
        if (b.isInterveningCompositionRegularizedPaid !== undefined) {
            isInterveningCompositionRegularizedPaid = Boolean(b.isInterveningCompositionRegularizedPaid);
        }
        if (b.isInterveningCompositionRegularizedUnpaid !== undefined) {
            isInterveningCompositionRegularizedUnpaid = Boolean(b.isInterveningCompositionRegularizedUnpaid);
        }
        if (b.requiresInterveningRcmPaymentVerification !== undefined) {
            requiresInterveningRcmPaymentVerification = Boolean(b.requiresInterveningRcmPaymentVerification);
        }

        const isRcmExcludedOrPending = isCompositionExcludedFromRentRcm || requiresRentSchemeVerification || isInterveningCompositionRegularizedPaid || isInterveningCompositionRegularizedUnpaid || requiresInterveningRcmPaymentVerification;
        if (isRcmExcludedOrPending) {
            isCommercialRentRcm = false;
        } else if (b.isCommercialRentRcm !== undefined && !isCommercialRent) {
            isCommercialRentRcm = Boolean(b.isCommercialRentRcm);
        }

        const isRcm = Boolean((!isRcmExcludedOrPending && (b.isRcm || /true|yes|y|1/i.test(String(b.is_rcm || '')))) || isCommercialRentRcm);
        const isSchedule1DeemedSupply = Boolean(b.isSchedule1DeemedSupply || /distinct|related|deemed|schedule\s*1/i.test(b.category || ''));

        return {
            ...b,
            billNumber: billNum,
            exactKey: keys.exactKey,
            alphaNumericKey: keys.alphaNumericKey,
            vendorGstin,
            vendorPan: b.vendorPan || (gstinObj ? gstinObj.pan : null),
            isGstinValid,
            posStateCode,
            isBlocked17_5,
            isRcm,
            isCommercialRentRcm,
            isCompositionExcludedFromRentRcm,
            requiresRentSchemeVerification,
            isInterveningCompositionRegularizedPaid,
            isInterveningCompositionRegularizedUnpaid,
            requiresInterveningRcmPaymentVerification,
            isSchedule1DeemedSupply,
            taxableAmountInr,
            cgstInr,
            sgstInr,
            igstInr,
            totalTaxInr,
            totalAmountInr,
            balanceInr,
            isFullyPaid
        };
    });

    const parsed2b = raw2b.map((r, idx) => {
        const invNum = String(r.invoiceNumber || r.billNumber || r.inum || r.invoice_number || `INV-${idx + 1}`).trim();
        const keys = (r.exactKey && r.alphaNumericKey) ? { exactKey: r.exactKey, alphaNumericKey: r.alphaNumericKey } : normalizeInvoiceNumber(invNum);
        const supplierGstin = String(r.supplierGstin || r.ctin || r.gstin || '').trim().toUpperCase();
        const gstinObj = supplierGstin ? normalizeGstin(supplierGstin) : null;
        const isGstinValid = typeof r.isGstinValid === 'boolean' ? r.isGstinValid : (options.validateGstinChecksum === true && gstinObj ? gstinObj.isValid : undefined);
        const taxableAmountInr = cleanNumericAmount(r.taxableAmountInr ?? r.taxable_amount ?? r.txval ?? 0);
        const cgstInr = cleanNumericAmount(r.cgstInr ?? r.cgst_amount ?? 0);
        const sgstInr = cleanNumericAmount(r.sgstInr ?? r.sgst_amount ?? 0);
        const igstInr = cleanNumericAmount(r.igstInr ?? r.igst_amount ?? 0);
        const totalTaxInr = r.totalTaxInr !== undefined ? cleanNumericAmount(r.totalTaxInr) : roundToPaisa(cgstInr + sgstInr + igstInr);
        const totalAmountInr = r.totalAmountInr !== undefined ? cleanNumericAmount(r.totalAmountInr) : roundToPaisa(taxableAmountInr + totalTaxInr);
        const posStateCode = r.posStateCode !== undefined ? r.posStateCode : (gstinObj ? gstinObj.stateCode : null);
        const isRcm = Boolean(r.isRcm || /true|yes|y|1/i.test(String(r.is_rcm || '')));

        return {
            ...r,
            invoiceNumber: invNum,
            exactKey: keys.exactKey,
            alphaNumericKey: keys.alphaNumericKey,
            supplierGstin,
            isGstinValid,
            posStateCode,
            isRcm,
            taxableAmountInr,
            cgstInr,
            sgstInr,
            igstInr,
            totalTaxInr,
            totalAmountInr
        };
    });

    const recipientFilingState = recipientGstin ? recipientGstin.slice(0, 2) : null;

    // Assemble comprehensive recipient state portfolio (distinct persons under Section 25(4))
    const recipientStateSet = new Set();
    if (recipientFilingState) {
        recipientStateSet.add(recipientFilingState);
    }
    for (const g of recipientRegisteredGstins) {
        if (typeof g === 'string' && g.length >= 2) {
            recipientStateSet.add(g.slice(0, 2));
        }
    }
    for (const s of recipientRegisteredStates) {
        if (typeof s === 'string' && s.length >= 2) {
            recipientStateSet.add(s.slice(0, 2));
        }
    }

    // Index GSTR-2B by composite key with duplicate detection
    const gstr2bExactMap = new Map();
    const gstr2bAlphaMap = new Map();
    const duplicate2bKeys = new Set();
    const matched2bSet = new Set();

    for (let i = 0; i < parsed2b.length; i++) {
        const record = parsed2b[i];
        const gstinKey = record.supplierGstin || 'UNKNOWN_GSTIN';
        const exactComposite = `${gstinKey}|${record.exactKey}`;
        const alphaComposite = `${gstinKey}|${record.alphaNumericKey}`;

        if (gstr2bExactMap.has(exactComposite)) {
            duplicate2bKeys.add(exactComposite);
        }
        if (gstr2bAlphaMap.has(alphaComposite)) {
            duplicate2bKeys.add(alphaComposite);
        }

        gstr2bExactMap.set(exactComposite, { record, index: i });
        gstr2bAlphaMap.set(alphaComposite, { record, index: i });
    }

    // Detect duplicate bills within Zoho Books
    const seenBooksExactKeys = new Set();
    const duplicateBooksKeys = new Set();
    for (const bill of parsedBills) {
        const gstinKey = bill.vendorGstin || 'UNKNOWN_GSTIN';
        const exactComposite = `${gstinKey}|${bill.exactKey}`;
        if (seenBooksExactKeys.has(exactComposite)) {
            duplicateBooksKeys.add(exactComposite);
        }
        seenBooksExactKeys.add(exactComposite);
    }

    const items = [];

    let totalBooksTaxablePaise = 0;
    let totalBooksTaxPaise = 0;
    let total2bTaxablePaise = 0;
    let total2bTaxPaise = 0;

    let matchedEligibleCount = 0;
    let eligibleItcPaise = 0;

    let rcmUnregisteredEligibleCount = 0;
    let rcmUnregisteredEligibleItcPaise = 0;

    let compositionExcludedCount = 0;
    let compositionExcludedItcPaise = 0;

    let interveningRegularizedPaidCount = 0;
    let interveningRegularizedUnpaidCount = 0;
    let interveningRegularizedTaxPaise = 0;

    let amountMismatchCount = 0;
    let mismatchedItcPaise = 0;

    let blocked17_5Count = 0;
    let blocked17_5ItcPaise = 0;

    let posMismatchCount = 0;
    let posMismatchItcPaise = 0;

    let routableToBranchCount = 0;
    let routableToBranchItcPaise = 0;

    let strandedLocalCount = 0;
    let strandedLocalItcPaise = 0;

    let gstr2bPortalIneligibleCount = 0;
    let gstr2bPortalIneligibleItcPaise = 0;

    let requiresHumanVerificationCount = 0;
    let requiresHumanVerificationItcPaise = 0;

    let missingIn2bCount = 0;
    let atRiskUnfiledItcPaise = 0;

    let rule37OverdueCount = 0;
    let rule37ReversalAmountPaise = 0;
    let rule37InterestExposurePaise = 0;

    // 2. Iterate Zoho Bills & Match against GSTR-2B
    for (const bill of parsedBills) {
        const gstinKey = bill.vendorGstin || 'UNKNOWN_GSTIN';
        const exactComposite = `${gstinKey}|${bill.exactKey}`;
        const alphaComposite = `${gstinKey}|${bill.alphaNumericKey}`;

        const booksTaxablePaise = toIntegerPaise(bill.taxableAmountInr);
        const booksTaxPaise = toIntegerPaise(bill.totalTaxInr);
        totalBooksTaxablePaise += booksTaxablePaise;
        totalBooksTaxPaise += booksTaxPaise;

        let matchEntry = gstr2bExactMap.get(exactComposite) || gstr2bAlphaMap.get(alphaComposite) || null;
        const isRcm = bill.isRcm || (matchEntry && matchEntry.record.isRcm);

        // ── Rule 37 180-Day Aging & Section 50(1) Evaluation ──
        let isRule37Overdue = false;
        let daysElapsedSinceBill = 0;
        let rule37Status = 'COMPLIANT_OR_NOT_APPLICABLE';
        let rule37ReversalTaxInr = 0;
        let rule37InterestInr = 0;
        let rule37InterestExplanation = '';
        let isReclaimableUponPayment = false;
        let paymentAppropriationDetails = null;

        const isFullyPaid = bill.isFullyPaid || bill.balanceInr <= 0;

        if (bill.billDate) {
            daysElapsedSinceBill = calculateDaysElapsed(bill.billDate, asOfDate);

            if (isRcm) {
                rule37Status = 'EXEMPT_RCM_SUPPLY'; // Proviso 1 to Rule 37(1)
            } else if (bill.isSchedule1DeemedSupply) {
                rule37Status = 'EXEMPT_SCHEDULE_1_DEEMED_SUPPLY'; // Proviso 2 to Rule 37(1)
            } else if (isFullyPaid) {
                rule37Status = 'COMPLIANT_FULLY_PAID';
            } else if (daysElapsedSinceBill <= 180) {
                rule37Status = 'WITHIN_180_DAYS_WINDOW';
            } else {
                // Bill exceeds 180 days unpaid!
                isRule37Overdue = true;
                rule37OverdueCount++;
                rule37Status = 'OVERDUE_REVERSAL_REQUIRED';
                isReclaimableUponPayment = true;

                const totalAmt = bill.totalAmountInr;
                const balanceAmt = bill.balanceInr;
                const taxableAmt = bill.taxableAmountInr;
                const taxAmt = bill.totalTaxInr;
                const paidAmt = Math.max(0, totalAmt - balanceAmt);

                let reversalPaise = 0;
                let valuePaid = 0;
                let taxPaid = 0;

                if (paymentAppropriationMethod === 'VALUE_FIRST') {
                    valuePaid = Math.min(taxableAmt, paidAmt);
                    taxPaid = Math.max(0, paidAmt - taxableAmt);
                    const unpaidTax = Math.max(0, taxAmt - taxPaid);
                    reversalPaise = toIntegerPaise(unpaidTax);
                } else if (paymentAppropriationMethod === 'TAX_FIRST') {
                    taxPaid = Math.min(taxAmt, paidAmt);
                    valuePaid = Math.max(0, paidAmt - taxAmt);
                    // Failure to pay value along with tax still triggers reversal proportionate to unpaid consideration
                    const unpaidRatio = totalAmt > 0 ? (balanceAmt / totalAmt) : 1;
                    reversalPaise = Math.round(booksTaxPaise * Math.min(1, Math.max(0, unpaidRatio)));
                } else {
                    // PROPORTIONATE (Standard statutory baseline)
                    const unpaidRatio = totalAmt > 0 ? (balanceAmt / totalAmt) : 1;
                    valuePaid = Math.round(taxableAmt * (1 - unpaidRatio) * 100) / 100;
                    taxPaid = Math.round(taxAmt * (1 - unpaidRatio) * 100) / 100;
                    reversalPaise = Math.round(booksTaxPaise * Math.min(1, Math.max(0, unpaidRatio)));
                }

                rule37ReversalAmountPaise += reversalPaise;
                rule37ReversalTaxInr = fromIntegerPaise(reversalPaise);

                paymentAppropriationDetails = {
                    method: paymentAppropriationMethod,
                    isStatutoryStandard: paymentAppropriationMethod === 'PROPORTIONATE',
                    statutoryNote: paymentAppropriationMethod === 'PROPORTIONATE'
                        ? 'CGST Act Section 16(2) second proviso read with Rule 37(1) canonical statutory baseline: proportional reversal on unpaid consideration and tax.'
                        : `Alternative accounting allocation assumption (${paymentAppropriationMethod}). In statutory audit and tax litigation, proportional allocation remains the default baseline unless contractually documented.`,
                    totalInvoiceInr: totalAmt,
                    balanceDueInr: balanceAmt,
                    amountPaidInr: paidAmt,
                    imputedValuePaidInr: valuePaid,
                    imputedTaxPaidInr: taxPaid,
                    reversalTaxInr: rule37ReversalTaxInr
                };

                // Section 50(1) interest evaluated against Rule 88B(3) ECL balance
                const overdueDaysPast180 = daysElapsedSinceBill - 180;

                if (Array.isArray(eclLedgerHistory) && eclLedgerHistory.length > 0) {
                    const overdueStartDate = calculateOverdueStartDate(bill.billDate);
                    const eclRes = calculateEclUtilizationInterest({
                        unreversedItcInr: rule37ReversalTaxInr,
                        overdueStartDate,
                        asOfDate,
                        reversalDate: bill.reversalDate || null,
                        eclLedgerHistory
                    });
                    rule37InterestInr = eclRes.totalInterestInr;
                    rule37InterestExplanation = eclRes.explanation;
                    rule37InterestExposurePaise += eclRes.totalInterestPaise;
                } else if (minimumEclBalanceInr !== undefined && minimumEclBalanceInr !== null) {
                    const minEcl = cleanNumericAmount(minimumEclBalanceInr);
                    const wrongfulUtilizedInr = Math.max(0, roundToPaisa(rule37ReversalTaxInr - minEcl));
                    if (wrongfulUtilizedInr <= 0) {
                        rule37InterestInr = 0;
                        rule37InterestExplanation = `Rule 88B(3) Proviso: Minimum Electronic Credit Ledger balance (₹${minEcl.toLocaleString('en-IN')}) exceeded unreversed ITC (₹${rule37ReversalTaxInr.toLocaleString('en-IN')}). Credit remained unutilized; zero interest payable.`;
                    } else {
                        const interestPaise = Math.round(toIntegerPaise(wrongfulUtilizedInr) * (0.18 / 365) * overdueDaysPast180);
                        rule37InterestExposurePaise += interestPaise;
                        rule37InterestInr = fromIntegerPaise(interestPaise);
                        rule37InterestExplanation = `Rule 88B(3): Minimum ECL balance (₹${minEcl.toLocaleString('en-IN')}) dipped below unreversed ITC by ₹${wrongfulUtilizedInr.toLocaleString('en-IN')}. 18% annual interest computed on utilized balance for ${overdueDaysPast180} overdue days.`;
                    }
                } else if (eclUtilizationStatus === 'UNUTILIZED') {
                    rule37InterestInr = 0;
                    rule37InterestExplanation = 'Rule 88B(3) Proviso: Upstream attestation confirms ECL balance never fell below unreversed ITC. Zero interest payable.';
                } else if (eclUtilizationStatus === 'UTILIZED') {
                    const interestPaise = Math.round(reversalPaise * (0.18 / 365) * overdueDaysPast180);
                    rule37InterestExposurePaise += interestPaise;
                    rule37InterestInr = fromIntegerPaise(interestPaise);
                    rule37InterestExplanation = `Section 50(1): 18% annual interest computed on full reversal amount (₹${rule37ReversalTaxInr.toLocaleString('en-IN')}) across ${overdueDaysPast180} overdue days.`;
                } else {
                    rule37InterestInr = 0;
                    rule37InterestExplanation = 'ECL balance history unavailable. Rule 88B(3) utilization amount cannot be determined without ledger closing balances. Human verification required.';
                }
            }
        }

        // ── Uncertainty Check 1: Invalid Supplier GSTIN Checksum ──
        if (bill.vendorGstin && bill.isGstinValid === false) {
            requiresHumanVerificationCount++;
            requiresHumanVerificationItcPaise += booksTaxPaise;

            items.push({
                disposition: 'REQUIRES_HUMAN_VERIFICATION',
                uncertaintyReason: 'INVALID_SUPPLIER_GSTIN_CHECKSUM',
                itcStatus: 'INDETERMINATE_INVALID_IDENTIFIER',
                statutorySection: 'CGST Act Section 22/25 & Rule 8 (Taxpayer Identity Verification)',
                vendorName: bill.vendorName,
                vendorGstin: bill.vendorGstin,
                billNumber: bill.billNumber,
                billDate: bill.billDate,
                booksTaxableInr: bill.taxableAmountInr,
                booksTaxInr: bill.totalTaxInr,
                gstr2bTaxableInr: 0,
                gstr2bTaxInr: 0,
                varianceTaxableInr: bill.taxableAmountInr,
                varianceTaxInr: bill.totalTaxInr,
                isRule37Overdue,
                daysElapsedSinceBill,
                rule37Status,
                rule37ReversalTaxInr,
                rule37InterestInr,
                rule37InterestExplanation,
                isReclaimableUponPayment,
                paymentAppropriationDetails,
                jurisdictionDecisions: {
                    taxClassification: 'INDETERMINATE',
                    recipientJurisdiction: 'INDETERMINATE',
                    itcEligibility: 'INDETERMINATE',
                    operationalRouting: 'MANUAL_HUMAN_INVESTIGATION_REQUIRED'
                },
                statutoryAction: 'Supplier GSTIN failed ISO Mod-36 checksum validation. Withhold automated processing; human review required to verify vendor master or demand corrected tax invoice.',
                auditEvidence: {
                    inBooks: true,
                    inGstr2b: false,
                    invalidGstin: bill.vendorGstin
                },
                evidenceProvenance: buildEvidenceProvenance({
                    bill,
                    record2b: null,
                    matchType: 'NONE',
                    disposition: 'REQUIRES_HUMAN_VERIFICATION',
                    statutorySection: 'CGST Act Section 22/25 & Rule 8 (Taxpayer Identity Verification)',
                    jurisdictionDecisions: {
                        taxClassification: 'INDETERMINATE',
                        recipientJurisdiction: 'INDETERMINATE',
                        itcEligibility: 'INDETERMINATE',
                        operationalRouting: 'MANUAL_HUMAN_INVESTIGATION_REQUIRED'
                    },
                    uncertaintyReason: 'INVALID_SUPPLIER_GSTIN_CHECKSUM',
                    asOfDate
                })
            });
            continue;
        }

        // ── Uncertainty Check 2: Ambiguous Duplicate Invoices in Books or GSTR-2B ──
        if (duplicateBooksKeys.has(exactComposite) || (matchEntry && duplicate2bKeys.has(exactComposite))) {
            requiresHumanVerificationCount++;
            requiresHumanVerificationItcPaise += booksTaxPaise;

            items.push({
                disposition: 'REQUIRES_HUMAN_VERIFICATION',
                uncertaintyReason: 'AMBIGUOUS_DUPLICATE_INVOICE_MATCH',
                itcStatus: 'INDETERMINATE_AMBIGUOUS_BILLING',
                statutorySection: 'CGST Act Section 31 & General Accounting Internal Controls',
                vendorName: bill.vendorName,
                vendorGstin: bill.vendorGstin,
                billNumber: bill.billNumber,
                billDate: bill.billDate,
                booksTaxableInr: bill.taxableAmountInr,
                booksTaxInr: bill.totalTaxInr,
                gstr2bTaxableInr: matchEntry ? matchEntry.record.taxableAmountInr : 0,
                gstr2bTaxInr: matchEntry ? matchEntry.record.totalTaxInr : 0,
                varianceTaxableInr: 0,
                varianceTaxInr: 0,
                isRule37Overdue,
                daysElapsedSinceBill,
                rule37Status,
                rule37ReversalTaxInr,
                rule37InterestInr,
                rule37InterestExplanation,
                isReclaimableUponPayment,
                paymentAppropriationDetails,
                jurisdictionDecisions: {
                    taxClassification: 'INDETERMINATE',
                    recipientJurisdiction: 'INDETERMINATE',
                    itcEligibility: 'INDETERMINATE',
                    operationalRouting: 'MANUAL_HUMAN_INVESTIGATION_REQUIRED'
                },
                statutoryAction: 'Multiple candidate records detected sharing the identical supplier GSTIN and invoice number. Automated engine refuses to guess match. Human auditor must confirm if this represents duplicate billing or an amended voucher.',
                auditEvidence: {
                    inBooks: true,
                    inGstr2b: Boolean(matchEntry),
                    duplicateCompositeKey: exactComposite
                },
                evidenceProvenance: buildEvidenceProvenance({
                    bill,
                    record2b: matchEntry ? matchEntry.record : null,
                    matchType: exactComposite === `${gstinKey}|${(matchEntry && matchEntry.record.exactKey)}` ? 'EXACT' : 'ALPHANUMERIC',
                    disposition: 'REQUIRES_HUMAN_VERIFICATION',
                    statutorySection: 'CGST Act Section 31 & General Accounting Internal Controls',
                    jurisdictionDecisions: {
                        taxClassification: 'INDETERMINATE',
                        recipientJurisdiction: 'INDETERMINATE',
                        itcEligibility: 'INDETERMINATE',
                        operationalRouting: 'MANUAL_HUMAN_INVESTIGATION_REQUIRED'
                    },
                    uncertaintyReason: 'AMBIGUOUS_DUPLICATE_INVOICE_MATCH',
                    asOfDate
                })
            });
            continue;
        }

        // ── Uncertainty Check 3: Contradictory Tax Split ──
        const hasLocalTax = (bill.cgstInr > 0 || bill.sgstInr > 0);
        const hasIgst = bill.igstInr > 0;
        if (hasLocalTax && hasIgst) {
            requiresHumanVerificationCount++;
            requiresHumanVerificationItcPaise += booksTaxPaise;

            items.push({
                disposition: 'REQUIRES_HUMAN_VERIFICATION',
                uncertaintyReason: 'CONTRADICTORY_TAX_SPLIT',
                itcStatus: 'DEFECTIVE_TAX_INVOICE_SPLIT',
                statutorySection: 'CGST Act Section 31 & IGST Act Section 5',
                vendorName: bill.vendorName,
                vendorGstin: bill.vendorGstin,
                billNumber: bill.billNumber,
                billDate: bill.billDate,
                booksTaxableInr: bill.taxableAmountInr,
                booksTaxInr: bill.totalTaxInr,
                gstr2bTaxableInr: matchEntry ? matchEntry.record.taxableAmountInr : 0,
                gstr2bTaxInr: matchEntry ? matchEntry.record.totalTaxInr : 0,
                varianceTaxableInr: 0,
                varianceTaxInr: 0,
                isRule37Overdue,
                daysElapsedSinceBill,
                rule37Status,
                rule37ReversalTaxInr,
                rule37InterestInr,
                rule37InterestExplanation,
                isReclaimableUponPayment,
                paymentAppropriationDetails,
                jurisdictionDecisions: {
                    taxClassification: 'INDETERMINATE',
                    recipientJurisdiction: 'INDETERMINATE',
                    itcEligibility: 'INELIGIBLE_DEFECTIVE_INVOICE',
                    operationalRouting: 'MANUAL_HUMAN_INVESTIGATION_REQUIRED'
                },
                statutoryAction: 'Invoice contains contradictory tax components (concurrent CGST/SGST and IGST). Legally defective on its face under Section 31. Demand amended invoice from supplier.',
                auditEvidence: {
                    cgstInr: bill.cgstInr,
                    sgstInr: bill.sgstInr,
                    igstInr: bill.igstInr
                },
                evidenceProvenance: buildEvidenceProvenance({
                    bill,
                    record2b: matchEntry ? matchEntry.record : null,
                    matchType: matchEntry ? (exactComposite === `${gstinKey}|${matchEntry.record.exactKey}` ? 'EXACT' : 'ALPHANUMERIC') : 'UNMATCHED',
                    disposition: 'REQUIRES_HUMAN_VERIFICATION',
                    statutorySection: 'CGST Act Section 31 & IGST Act Section 5',
                    jurisdictionDecisions: {
                        taxClassification: 'INDETERMINATE',
                        recipientJurisdiction: 'INDETERMINATE',
                        itcEligibility: 'INELIGIBLE_DEFECTIVE_INVOICE',
                        operationalRouting: 'MANUAL_HUMAN_INVESTIGATION_REQUIRED'
                    },
                    uncertaintyReason: 'CONTRADICTORY_TAX_SPLIT',
                    asOfDate
                })
            });
            continue;
        }

        // ── Missing in GSTR-2B or Unregistered RCM Supply ──
        if (!matchEntry) {
            // Check for Indeterminate Recipient Scheme (Notification 07/2025-CT(Rate))
            if (bill.requiresRentSchemeVerification) {
                requiresHumanVerificationCount++;
                requiresHumanVerificationItcPaise += booksTaxPaise;

                items.push({
                    disposition: 'REQUIRES_HUMAN_VERIFICATION',
                    uncertaintyReason: 'INDETERMINATE_RECIPIENT_REGISTRATION_SCHEME',
                    itcStatus: 'INDETERMINATE_REGISTRATION_SCHEME',
                    statutorySection: 'CGST Act Section 9(3) read with Notification No. 07/2025-CT(Rate)',
                    vendorName: bill.vendorName,
                    vendorGstin: bill.vendorGstin || 'UNREGISTERED',
                    billNumber: bill.billNumber,
                    billDate: bill.billDate,
                    booksTaxableInr: bill.taxableAmountInr,
                    booksTaxInr: bill.totalTaxInr,
                    gstr2bTaxableInr: 0,
                    gstr2bTaxInr: 0,
                    varianceTaxableInr: bill.taxableAmountInr,
                    varianceTaxInr: bill.totalTaxInr,
                    isRule37Overdue: false,
                    daysElapsedSinceBill,
                    rule37Status: 'EXEMPT_RCM_SUPPLY',
                    rule37ReversalTaxInr: 0,
                    rule37InterestInr: 0,
                    rule37InterestExplanation: '',
                    isReclaimableUponPayment: false,
                    paymentAppropriationDetails: null,
                    isRcm: false,
                    jurisdictionDecisions: {
                        taxClassification: hasIgst ? 'INTERSTATE_CORRECT' : 'INTRASTATE_CORRECT',
                        recipientJurisdiction: 'INDETERMINATE',
                        itcEligibility: 'INDETERMINATE',
                        operationalRouting: 'MANUAL_HUMAN_INVESTIGATION_REQUIRED'
                    },
                    statutoryAction: 'Notification No. 07/2025-CT(Rate) w.e.f. 16 Jan 2025 excludes composition taxpayers (Section 10) from Entry 5AB commercial rent RCM. Verify recipient GST registration scheme (Regular vs Section 10 Composition) to determine RCM liability.',
                    auditEvidence: {
                        inBooks: true,
                        inGstr2b: false,
                        matchType: 'UNMATCHED',
                        isCommercialRent: true,
                        requiresRentSchemeVerification: true
                    },
                    evidenceProvenance: buildEvidenceProvenance({
                        bill,
                        record2b: null,
                        matchType: 'UNMATCHED',
                        disposition: 'REQUIRES_HUMAN_VERIFICATION',
                        statutorySection: 'CGST Act Section 9(3) read with Notification No. 07/2025-CT(Rate)',
                        jurisdictionDecisions: {
                            taxClassification: hasIgst ? 'INTERSTATE_CORRECT' : 'INTRASTATE_CORRECT',
                            recipientJurisdiction: 'INDETERMINATE',
                            itcEligibility: 'INDETERMINATE',
                            operationalRouting: 'MANUAL_HUMAN_INVESTIGATION_REQUIRED'
                        },
                        uncertaintyReason: 'INDETERMINATE_RECIPIENT_REGISTRATION_SCHEME',
                        asOfDate
                    })
                });
                continue;
            }

            // Check for Intervening Period RCM Payment Verification (55th GST Council Meeting)
            if (bill.requiresInterveningRcmPaymentVerification) {
                requiresHumanVerificationCount++;
                requiresHumanVerificationItcPaise += booksTaxPaise;

                items.push({
                    disposition: 'REQUIRES_HUMAN_VERIFICATION',
                    uncertaintyReason: 'INDETERMINATE_INTERVENING_RCM_DISCHARGE',
                    itcStatus: 'INDETERMINATE_INTERVENING_RCM_DISCHARGE',
                    statutorySection: 'CGST Act Section 9(3) read with 55th GST Council Meeting Recommendations',
                    vendorName: bill.vendorName,
                    vendorGstin: bill.vendorGstin || 'UNREGISTERED',
                    billNumber: bill.billNumber,
                    billDate: bill.billDate,
                    booksTaxableInr: bill.taxableAmountInr,
                    booksTaxInr: bill.totalTaxInr,
                    gstr2bTaxableInr: 0,
                    gstr2bTaxInr: 0,
                    varianceTaxableInr: bill.taxableAmountInr,
                    varianceTaxInr: bill.totalTaxInr,
                    isRule37Overdue: false,
                    daysElapsedSinceBill,
                    rule37Status: 'EXEMPT_RCM_SUPPLY',
                    rule37ReversalTaxInr: 0,
                    rule37InterestInr: 0,
                    rule37InterestExplanation: '',
                    isReclaimableUponPayment: false,
                    paymentAppropriationDetails: null,
                    isRcm: false,
                    jurisdictionDecisions: {
                        taxClassification: hasIgst ? 'INTERSTATE_CORRECT' : 'INTRASTATE_CORRECT',
                        recipientJurisdiction: 'INDETERMINATE',
                        itcEligibility: 'INDETERMINATE',
                        operationalRouting: 'MANUAL_HUMAN_INVESTIGATION_REQUIRED'
                    },
                    statutoryAction: 'Intervening period (10 Oct 2024 to 15 Jan 2025) commercial rent regularized on "as is where is" basis per 55th GST Council meeting. Verify historical cash ledger to confirm whether RCM tax was discharged.',
                    auditEvidence: {
                        inBooks: true,
                        inGstr2b: false,
                        matchType: 'UNMATCHED',
                        isCommercialRent: true,
                        requiresInterveningRcmPaymentVerification: true
                    },
                    evidenceProvenance: buildEvidenceProvenance({
                        bill,
                        record2b: null,
                        matchType: 'UNMATCHED',
                        disposition: 'REQUIRES_HUMAN_VERIFICATION',
                        statutorySection: 'CGST Act Section 9(3) read with 55th GST Council Meeting Recommendations',
                        jurisdictionDecisions: {
                            taxClassification: hasIgst ? 'INTERSTATE_CORRECT' : 'INTRASTATE_CORRECT',
                            recipientJurisdiction: 'INDETERMINATE',
                            itcEligibility: 'INDETERMINATE',
                            operationalRouting: 'MANUAL_HUMAN_INVESTIGATION_REQUIRED'
                        },
                        uncertaintyReason: 'INDETERMINATE_INTERVENING_RCM_DISCHARGE',
                        asOfDate
                    })
                });
                continue;
            }

            // Check for Intervening Period Regularized Paid (55th GST Council Meeting)
            if (bill.isInterveningCompositionRegularizedPaid) {
                interveningRegularizedPaidCount++;
                interveningRegularizedTaxPaise += booksTaxPaise;

                items.push({
                    disposition: 'RCM_COMPOSITION_INTERVENING_REGULARIZED_PAID',
                    itcStatus: 'INELIGIBLE_COMPOSITION_SCHEME_SEC10_4',
                    statutorySection: 'CGST Act Section 9(3) read with 55th GST Council Meeting Recommendations & Section 10(4)',
                    vendorName: bill.vendorName,
                    vendorGstin: bill.vendorGstin || 'UNREGISTERED',
                    billNumber: bill.billNumber,
                    billDate: bill.billDate,
                    booksTaxableInr: bill.taxableAmountInr,
                    booksTaxInr: bill.totalTaxInr,
                    gstr2bTaxableInr: 0,
                    gstr2bTaxInr: 0,
                    varianceTaxableInr: 0,
                    varianceTaxInr: 0,
                    isRule37Overdue: false,
                    daysElapsedSinceBill,
                    rule37Status: 'EXEMPT_NON_GST_SUPPLY',
                    rule37ReversalTaxInr: 0,
                    rule37InterestInr: 0,
                    rule37InterestExplanation: '',
                    isReclaimableUponPayment: false,
                    paymentAppropriationDetails: null,
                    isRcm: false,
                    isCompositionExcluded: true,
                    isInterveningRegularizedPaid: true,
                    jurisdictionDecisions: {
                        taxClassification: hasIgst ? 'INTERSTATE_CORRECT' : 'INTRASTATE_CORRECT',
                        recipientJurisdiction: 'FILING_GSTIN_MATCHES_POS',
                        itcEligibility: 'INELIGIBLE_STRANDED_LOCAL_LEVY',
                        operationalRouting: 'BOOK_AS_EXPENSE_NO_ITC'
                    },
                    statutoryAction: 'Intervening period (10 Oct 2024 to 15 Jan 2025) regularized on "as is where is" basis per 55th GST Council meeting. RCM tax already discharged in cash cannot be claimed as refund; expensed under Section 10(4).',
                    auditEvidence: {
                        inBooks: true,
                        inGstr2b: false,
                        matchType: 'INTERVENING_REGULARIZED_PAID',
                        isCompositionRegularizedPaid: true
                    },
                    evidenceProvenance: buildEvidenceProvenance({
                        bill,
                        record2b: null,
                        matchType: 'INTERVENING_REGULARIZED_PAID',
                        disposition: 'RCM_COMPOSITION_INTERVENING_REGULARIZED_PAID',
                        statutorySection: 'CGST Act Section 9(3) read with 55th GST Council Meeting Recommendations & Section 10(4)',
                        jurisdictionDecisions: {
                            taxClassification: hasIgst ? 'INTERSTATE_CORRECT' : 'INTRASTATE_CORRECT',
                            recipientJurisdiction: 'FILING_GSTIN_MATCHES_POS',
                            itcEligibility: 'INELIGIBLE_STRANDED_LOCAL_LEVY',
                            operationalRouting: 'BOOK_AS_EXPENSE_NO_ITC'
                        },
                        uncertaintyReason: null,
                        asOfDate
                    })
                });
                continue;
            }

            // Check for Intervening Period Regularized Unpaid (55th GST Council Meeting)
            if (bill.isInterveningCompositionRegularizedUnpaid) {
                interveningRegularizedUnpaidCount++;
                interveningRegularizedTaxPaise += booksTaxPaise;

                items.push({
                    disposition: 'RCM_COMPOSITION_INTERVENING_REGULARIZED_UNPAID',
                    itcStatus: 'INELIGIBLE_COMPOSITION_SCHEME_SEC10_4',
                    statutorySection: 'CGST Act Section 9(3) read with 55th GST Council Meeting Recommendations & Section 10(4)',
                    vendorName: bill.vendorName,
                    vendorGstin: bill.vendorGstin || 'UNREGISTERED',
                    billNumber: bill.billNumber,
                    billDate: bill.billDate,
                    booksTaxableInr: bill.taxableAmountInr,
                    booksTaxInr: bill.totalTaxInr,
                    gstr2bTaxableInr: 0,
                    gstr2bTaxInr: 0,
                    varianceTaxableInr: 0,
                    varianceTaxInr: 0,
                    isRule37Overdue: false,
                    daysElapsedSinceBill,
                    rule37Status: 'EXEMPT_NON_GST_SUPPLY',
                    rule37ReversalTaxInr: 0,
                    rule37InterestInr: 0,
                    rule37InterestExplanation: '',
                    isReclaimableUponPayment: false,
                    paymentAppropriationDetails: null,
                    isRcm: false,
                    isCompositionExcluded: true,
                    isInterveningRegularizedUnpaid: true,
                    jurisdictionDecisions: {
                        taxClassification: hasIgst ? 'INTERSTATE_CORRECT' : 'INTRASTATE_CORRECT',
                        recipientJurisdiction: 'FILING_GSTIN_MATCHES_POS',
                        itcEligibility: 'INELIGIBLE_STRANDED_LOCAL_LEVY',
                        operationalRouting: 'BOOK_AS_EXPENSE_NO_ITC'
                    },
                    statutoryAction: 'Intervening period (10 Oct 2024 to 15 Jan 2025) regularized on "as is where is" basis per 55th GST Council meeting. No retrospective recovery or penal demand payable by composition taxpayer; zero RCM cash discharge required; consideration expensed.',
                    auditEvidence: {
                        inBooks: true,
                        inGstr2b: false,
                        matchType: 'INTERVENING_REGULARIZED_UNPAID',
                        isCompositionRegularizedUnpaid: true
                    },
                    evidenceProvenance: buildEvidenceProvenance({
                        bill,
                        record2b: null,
                        matchType: 'INTERVENING_REGULARIZED_UNPAID',
                        disposition: 'RCM_COMPOSITION_INTERVENING_REGULARIZED_UNPAID',
                        statutorySection: 'CGST Act Section 9(3) read with 55th GST Council Meeting Recommendations & Section 10(4)',
                        jurisdictionDecisions: {
                            taxClassification: hasIgst ? 'INTERSTATE_CORRECT' : 'INTRASTATE_CORRECT',
                            recipientJurisdiction: 'FILING_GSTIN_MATCHES_POS',
                            itcEligibility: 'INELIGIBLE_STRANDED_LOCAL_LEVY',
                            operationalRouting: 'BOOK_AS_EXPENSE_NO_ITC'
                        },
                        uncertaintyReason: null,
                        asOfDate
                    })
                });
                continue;
            }

            // Check for Composition Scheme Exclusion (Notification 07/2025-CT(Rate))
            if (bill.isCompositionExcludedFromRentRcm) {
                compositionExcludedCount++;
                compositionExcludedItcPaise += booksTaxPaise;

                items.push({
                    disposition: 'COMPOSITION_EXCLUDED_RCM_SUPPLY',
                    itcStatus: 'INELIGIBLE_COMPOSITION_SCHEME_SEC10_4',
                    statutorySection: 'CGST Act Section 9(3) read with Notification No. 07/2025-CT(Rate) & Section 10(4)',
                    vendorName: bill.vendorName,
                    vendorGstin: bill.vendorGstin || 'UNREGISTERED',
                    billNumber: bill.billNumber,
                    billDate: bill.billDate,
                    booksTaxableInr: bill.taxableAmountInr,
                    booksTaxInr: bill.totalTaxInr,
                    gstr2bTaxableInr: 0,
                    gstr2bTaxInr: 0,
                    varianceTaxableInr: 0,
                    varianceTaxInr: 0,
                    isRule37Overdue: false,
                    daysElapsedSinceBill,
                    rule37Status: 'EXEMPT_NON_GST_SUPPLY',
                    rule37ReversalTaxInr: 0,
                    rule37InterestInr: 0,
                    rule37InterestExplanation: '',
                    isReclaimableUponPayment: false,
                    paymentAppropriationDetails: null,
                    isRcm: false,
                    isCompositionExcluded: true,
                    jurisdictionDecisions: {
                        taxClassification: hasIgst ? 'INTERSTATE_CORRECT' : 'INTRASTATE_CORRECT',
                        recipientJurisdiction: 'FILING_GSTIN_MATCHES_POS',
                        itcEligibility: 'INELIGIBLE_STRANDED_LOCAL_LEVY',
                        operationalRouting: 'BOOK_AS_EXPENSE_NO_ITC'
                    },
                    statutoryAction: 'Commercial property renting from unregistered person is excluded from RCM for composition taxpayers w.e.f. 16 January 2025 per Notification No. 07/2025-CT(Rate). No reverse charge tax payable; zero ITC available under Section 10(4). Book full consideration as business expense.',
                    auditEvidence: {
                        inBooks: true,
                        inGstr2b: false,
                        matchType: 'COMPOSITION_EXCLUDED_RCM',
                        isCompositionExcluded: true
                    },
                    evidenceProvenance: buildEvidenceProvenance({
                        bill,
                        record2b: null,
                        matchType: 'COMPOSITION_EXCLUDED_RCM',
                        disposition: 'COMPOSITION_EXCLUDED_RCM_SUPPLY',
                        statutorySection: 'CGST Act Section 9(3) read with Notification No. 07/2025-CT(Rate) & Section 10(4)',
                        jurisdictionDecisions: {
                            taxClassification: hasIgst ? 'INTERSTATE_CORRECT' : 'INTRASTATE_CORRECT',
                            recipientJurisdiction: 'FILING_GSTIN_MATCHES_POS',
                            itcEligibility: 'INELIGIBLE_STRANDED_LOCAL_LEVY',
                            operationalRouting: 'BOOK_AS_EXPENSE_NO_ITC'
                        },
                        uncertaintyReason: null,
                        asOfDate
                    })
                });
                continue;
            }

            if (isRcm && (!bill.vendorGstin || bill.vendorGstin === 'UNREGISTERED' || bill.isCommercialRentRcm)) {
                rcmUnregisteredEligibleCount++;
                rcmUnregisteredEligibleItcPaise += booksTaxPaise;
                eligibleItcPaise += booksTaxPaise;

                const statutorySection = bill.isCommercialRentRcm
                    ? 'CGST Act Section 9(3) read with Notification No. 09/2024-CT(Rate) Entry 5AB & Section 31(3)(f)'
                    : 'CGST Act Section 9(3)/9(4) read with Section 31(3)(f)';

                const statutoryAction = bill.isCommercialRentRcm
                    ? 'Commercial property renting by unregistered supplier (Entry 5AB, Notification No. 09/2024-CT(Rate) w.e.f. 10 Oct 2024). Recipient must issue self-invoice (Sec 31(3)(f)), payment voucher (Sec 31(3)(g)), pay 18% GST in cash in Table 3.1(d), and claim ITC in Table 4(A)(3).'
                    : 'Inward supply liable to reverse charge from unregistered person. Recipient must issue self-invoice (Sec 31(3)(f)), pay tax in cash in Table 3.1(d), and claim ITC in Table 4(A)(3).';

                items.push({
                    disposition: 'RCM_UNREGISTERED_SUPPLIER_ELIGIBLE',
                    itcStatus: 'ELIGIBLE_RCM_TABLE_4A3',
                    statutorySection,
                    vendorName: bill.vendorName,
                    vendorGstin: bill.vendorGstin || 'UNREGISTERED',
                    billNumber: bill.billNumber,
                    billDate: bill.billDate,
                    booksTaxableInr: bill.taxableAmountInr,
                    booksTaxInr: bill.totalTaxInr,
                    gstr2bTaxableInr: 0,
                    gstr2bTaxInr: 0,
                    varianceTaxableInr: 0,
                    varianceTaxInr: 0,
                    isRule37Overdue: false,
                    daysElapsedSinceBill,
                    rule37Status: 'EXEMPT_RCM_SUPPLY',
                    rule37ReversalTaxInr: 0,
                    rule37InterestInr: 0,
                    rule37InterestExplanation: '',
                    isReclaimableUponPayment: false,
                    paymentAppropriationDetails: null,
                    isRcm: true,
                    isCommercialRentRcm: Boolean(bill.isCommercialRentRcm),
                    jurisdictionDecisions: {
                        taxClassification: hasIgst ? 'INTERSTATE_CORRECT' : 'INTRASTATE_CORRECT',
                        recipientJurisdiction: 'FILING_GSTIN_MATCHES_POS',
                        itcEligibility: 'ELIGIBLE_INWARD_RCM',
                        operationalRouting: 'ISSUE_SELF_INVOICE_AND_PAY_CASH_TABLE_3_1_D'
                    },
                    statutoryAction,
                    auditEvidence: {
                        inBooks: true,
                        inGstr2b: false,
                        matchType: 'RCM_UNREGISTERED_SUPPLY',
                        isRcm: true,
                        isCommercialRentRcm: Boolean(bill.isCommercialRentRcm)
                    },
                    evidenceProvenance: buildEvidenceProvenance({
                        bill,
                        record2b: null,
                        matchType: 'RCM_UNREGISTERED_SUPPLY',
                        disposition: 'RCM_UNREGISTERED_SUPPLIER_ELIGIBLE',
                        statutorySection,
                        jurisdictionDecisions: {
                            taxClassification: hasIgst ? 'INTERSTATE_CORRECT' : 'INTRASTATE_CORRECT',
                            recipientJurisdiction: 'FILING_GSTIN_MATCHES_POS',
                            itcEligibility: 'ELIGIBLE_INWARD_RCM',
                            operationalRouting: 'ISSUE_SELF_INVOICE_AND_PAY_CASH_TABLE_3_1_D'
                        },
                        uncertaintyReason: null,
                        asOfDate
                    })
                });
                continue;
            }

            missingIn2bCount++;
            atRiskUnfiledItcPaise += booksTaxPaise;

            const isTimingDifference = daysElapsedSinceBill <= 30;
            const disposition = isTimingDifference ? 'MISSING_IN_GSTR2B_TIMING' : 'MISSING_IN_GSTR2B';
            const itcStatus = isTimingDifference ? 'PROVISIONAL_PENDING_NEXT_GSTR2B' : 'PROVISIONAL_AT_RISK_RESTRICTED';

            items.push({
                disposition,
                itcStatus,
                statutorySection: 'CGST Act Section 16(2)(aa) read with Rule 36(4)',
                vendorName: bill.vendorName,
                vendorGstin: bill.vendorGstin,
                billNumber: bill.billNumber,
                billDate: bill.billDate,
                booksTaxableInr: bill.taxableAmountInr,
                booksTaxInr: bill.totalTaxInr,
                gstr2bTaxableInr: 0,
                gstr2bTaxInr: 0,
                varianceTaxableInr: bill.taxableAmountInr,
                varianceTaxInr: bill.totalTaxInr,
                isRule37Overdue,
                daysElapsedSinceBill,
                rule37Status,
                rule37ReversalTaxInr,
                rule37InterestInr,
                rule37InterestExplanation,
                isReclaimableUponPayment,
                paymentAppropriationDetails,
                jurisdictionDecisions: {
                    taxClassification: hasIgst ? 'INTERSTATE_CORRECT' : 'INTRASTATE_CORRECT',
                    recipientJurisdiction: 'FILING_GSTIN_MATCHES_POS',
                    itcEligibility: 'PROVISIONAL_PENDING_FILING',
                    operationalRouting: 'WITHHOLD_CLAIM_PENDING_SUPPLIER_GSTR1'
                },
                statutoryAction: isTimingDifference
                    ? 'Invoice dated within recent tax cycle. May appear in subsequent Form GSTR-2B or vendor IFF filing. Withhold claim until populated.'
                    : 'Invoice unfiled by vendor. Provisional ITC restricted under Section 16(2)(aa) & Rule 36(4). Withhold claim in GSTR-3B Table 4(A)(5). Issue vendor notice.',
                auditEvidence: {
                    inBooks: true,
                    inGstr2b: false,
                    matchType: 'UNMATCHED',
                    isTimingDifference
                },
                evidenceProvenance: buildEvidenceProvenance({
                    bill,
                    record2b: null,
                    matchType: 'UNMATCHED',
                    disposition,
                    statutorySection: 'CGST Act Section 16(2)(aa) read with Rule 36(4)',
                    jurisdictionDecisions: {
                        taxClassification: hasIgst ? 'INTERSTATE_CORRECT' : 'INTRASTATE_CORRECT',
                        recipientJurisdiction: 'FILING_GSTIN_MATCHES_POS',
                        itcEligibility: 'PROVISIONAL_PENDING_FILING',
                        operationalRouting: 'WITHHOLD_CLAIM_PENDING_SUPPLIER_GSTR1'
                    },
                    uncertaintyReason: null,
                    asOfDate
                })
            });
            continue;
        }

        // Mark 2B record as matched
        matched2bSet.add(matchEntry.index);
        const record2b = matchEntry.record;

        const gstr2bTaxablePaise = toIntegerPaise(record2b.taxableAmountInr);
        const gstr2bTaxPaise = toIntegerPaise(record2b.totalTaxInr);

        const diffTaxablePaise = Math.abs(booksTaxablePaise - gstr2bTaxablePaise);
        const diffTaxPaise = Math.abs(booksTaxPaise - gstr2bTaxPaise);

        // ── 4-Way Place of Supply (POS) Triangulation & Decoupled Decisions ──
        const supplierStateCode = record2b.supplierGstin ? record2b.supplierGstin.slice(0, 2) : (bill.vendorGstin ? bill.vendorGstin.slice(0, 2) : null);
        const posStateCode = record2b.posStateCode || bill.posStateCode || null;

        // Uncertainty Check 4: Missing POS
        if (!posStateCode) {
            requiresHumanVerificationCount++;
            requiresHumanVerificationItcPaise += booksTaxPaise;

            const itemMatchType = exactComposite === `${gstinKey}|${record2b.exactKey}` ? 'EXACT' : 'ALPHANUMERIC';
            items.push({
                disposition: 'REQUIRES_HUMAN_VERIFICATION',
                uncertaintyReason: 'MISSING_POS_DATA',
                itcStatus: 'INDETERMINATE_MISSING_JURISDICTION',
                statutorySection: 'IGST Act Section 10 & 12 (Place of Supply Determination)',
                vendorName: bill.vendorName,
                vendorGstin: bill.vendorGstin,
                billNumber: bill.billNumber,
                billDate: bill.billDate,
                booksTaxableInr: bill.taxableAmountInr,
                booksTaxInr: bill.totalTaxInr,
                gstr2bTaxableInr: record2b.taxableAmountInr,
                gstr2bTaxInr: record2b.totalTaxInr,
                varianceTaxableInr: fromIntegerPaise(diffTaxablePaise),
                varianceTaxInr: fromIntegerPaise(diffTaxPaise),
                isRule37Overdue,
                daysElapsedSinceBill,
                rule37Status,
                rule37ReversalTaxInr,
                rule37InterestInr,
                rule37InterestExplanation,
                isReclaimableUponPayment,
                paymentAppropriationDetails,
                jurisdictionDecisions: {
                    taxClassification: 'INDETERMINATE',
                    recipientJurisdiction: 'INDETERMINATE',
                    itcEligibility: 'INDETERMINATE',
                    operationalRouting: 'MANUAL_HUMAN_INVESTIGATION_REQUIRED'
                },
                statutoryAction: 'Place of Supply information is missing or indeterminate in both Books and GSTR-2B. Human intervention required to ascertain place of supply from shipping or service delivery documentation.',
                auditEvidence: { inBooks: true, inGstr2b: true, missingPos: true },
                evidenceProvenance: buildEvidenceProvenance({
                    bill,
                    record2b,
                    matchType: itemMatchType,
                    disposition: 'REQUIRES_HUMAN_VERIFICATION',
                    statutorySection: 'IGST Act Section 10 & 12 (Place of Supply Determination)',
                    jurisdictionDecisions: {
                        taxClassification: 'INDETERMINATE',
                        recipientJurisdiction: 'INDETERMINATE',
                        itcEligibility: 'INDETERMINATE',
                        operationalRouting: 'MANUAL_HUMAN_INVESTIGATION_REQUIRED'
                    },
                    uncertaintyReason: 'MISSING_POS_DATA',
                    asOfDate
                })
            });
            continue;
        }

        const isIntrastateLevy = (record2b.cgstInr > 0 || record2b.sgstInr > 0 || bill.cgstInr > 0 || bill.sgstInr > 0);
        const isSupplierLocal = supplierStateCode && posStateCode && supplierStateCode === posStateCode;

        // Decoupled Decision 1: Tax Determination under IGST Act
        let taxClassification = 'INTRASTATE_CORRECT';
        if (isSupplierLocal) {
            taxClassification = isIntrastateLevy ? 'INTRASTATE_CORRECT' : 'ERRONEOUS_INTERSTATE_LEVY';
        } else {
            taxClassification = isIntrastateLevy ? 'ERRONEOUS_INTRASTATE_LEVY' : 'INTERSTATE_CORRECT';
        }

        // Decoupled Decision 2: Recipient Jurisdiction
        let recipientJurisdiction = 'FILING_GSTIN_MATCHES_POS';
        if (recipientFilingState && posStateCode && recipientFilingState !== posStateCode) {
            if (recipientStateSet.has(posStateCode)) {
                recipientJurisdiction = 'REGISTERED_DISTINCT_PERSON_BRANCH';
            } else {
                recipientJurisdiction = 'UNREGISTERED_IN_POS_STATE';
            }
        }

        // Decoupled Decision 3 & 4: ITC Eligibility & Operational Routing
        let itcEligibility = 'ELIGIBLE_NORMAL';
        let operationalRouting = 'CLAIM_IN_CURRENT_GSTR3B_TABLE_4A5';

        if (record2b.itcAvailable === false) {
            itcEligibility = 'INELIGIBLE_PORTAL_FLAGGED';
            operationalRouting = 'REPORT_IN_GSTR3B_TABLE_4B1_PERMANENT_REVERSAL';
        } else if (bill.isBlocked17_5) {
            itcEligibility = 'INELIGIBLE_BLOCKED_SEC_17_5';
            operationalRouting = 'REPORT_IN_GSTR3B_TABLE_4B1_PERMANENT_REVERSAL';
        } else if (recipientJurisdiction === 'REGISTERED_DISTINCT_PERSON_BRANCH') {
            itcEligibility = 'ELIGIBLE_IN_BRANCH_RETURN';
            operationalRouting = 'ROUTE_TO_BRANCH_GSTIN';
        } else if (recipientJurisdiction === 'UNREGISTERED_IN_POS_STATE') {
            const isStatutoryImmovableStay = /hotel|lodge|lodging|room stay|guest house|accommodation|campsite|catering|restaurant|real estate|immovable/i.test(bill.category || '');
            const isB2bEventManagement = /event|conference|exhibition|seminar|summit|event management/i.test(bill.category || '');

            if (isStatutoryImmovableStay && isSupplierLocal) {
                // Section 12(3)(a): Immovable lodging POS is property location. Since recipient lacks registration in this state, local CGST/SGST is stranded.
                itcEligibility = 'INELIGIBLE_STRANDED_LOCAL_LEVY';
                operationalRouting = 'BOOK_AS_EXPENSE_NO_ITC';
            } else if (isB2bEventManagement) {
                // IGST Act Section 12(7)(a)(i): POS for organizing event/conference to a registered person is the location of the recipient!
                // If supplier charged local CGST/SGST, it is an ERRONEOUS_INTRASTATE_LEVY. Supplier MUST issue credit note and re-invoice with IGST.
                itcEligibility = 'INELIGIBLE_DEFECTIVE_INVOICE';
                operationalRouting = 'REQUEST_VENDOR_CREDIT_NOTE_AMENDMENT';
            } else {
                itcEligibility = 'INELIGIBLE_DEFECTIVE_INVOICE';
                operationalRouting = 'REQUEST_VENDOR_CREDIT_NOTE_AMENDMENT';
            }
        } else if (diffTaxablePaise > tolerancePaise || diffTaxPaise > tolerancePaise) {
            itcEligibility = 'ELIGIBLE_NORMAL';
            operationalRouting = 'REQUEST_VENDOR_CREDIT_NOTE_AMENDMENT';
        }

        const jurisdictionDecisions = {
            taxClassification,
            recipientJurisdiction,
            itcEligibility,
            operationalRouting
        };

        const matchType = exactComposite === `${gstinKey}|${record2b.exactKey}` ? 'EXACT' : 'ALPHANUMERIC';

        if (record2b.itcAvailable === false) {
            // Disposition: GSTR2B_INELIGIBLE_FLAGGED_BY_GSTN
            gstr2bPortalIneligibleCount++;
            gstr2bPortalIneligibleItcPaise += booksTaxPaise;

            items.push({
                disposition: 'GSTR2B_INELIGIBLE_FLAGGED_BY_GSTN',
                itcStatus: 'INELIGIBLE_PORTAL_FLAGGED',
                statutorySection: 'CGST Act Section 16(4) / 16(2) (GSTN Ineligibility Flag)',
                vendorName: bill.vendorName,
                vendorGstin: bill.vendorGstin,
                billNumber: bill.billNumber,
                billDate: bill.billDate,
                booksTaxableInr: bill.taxableAmountInr,
                booksTaxInr: bill.totalTaxInr,
                gstr2bTaxableInr: record2b.taxableAmountInr,
                gstr2bTaxInr: record2b.totalTaxInr,
                varianceTaxableInr: fromIntegerPaise(diffTaxablePaise),
                varianceTaxInr: fromIntegerPaise(diffTaxPaise),
                isRule37Overdue,
                daysElapsedSinceBill,
                rule37Status,
                rule37ReversalTaxInr,
                rule37InterestInr,
                rule37InterestExplanation,
                isReclaimableUponPayment,
                paymentAppropriationDetails,
                jurisdictionDecisions,
                statutoryAction: `Form GSTR-2B has flagged this credit as ineligible: ${record2b.itcRevReason || 'Section 16(4) time-barred or supplier/recipient restriction'}. Do not avail in GSTR-3B Table 4(A)(5).`,
                auditEvidence: {
                    inBooks: true,
                    inGstr2b: true,
                    itcRevReason: record2b.itcRevReason
                },
                evidenceProvenance: buildEvidenceProvenance({
                    bill,
                    record2b,
                    matchType,
                    disposition: 'GSTR2B_INELIGIBLE_FLAGGED_BY_GSTN',
                    statutorySection: 'CGST Act Section 16(4) / 16(2) (GSTN Ineligibility Flag)',
                    jurisdictionDecisions,
                    uncertaintyReason: null,
                    asOfDate
                })
            });
        } else if (bill.isBlocked17_5) {
            // Disposition: MATCHED_INELIGIBLE_STATUTORY_BLOCK_17_5
            blocked17_5Count++;
            blocked17_5ItcPaise += booksTaxPaise;

            items.push({
                disposition: 'MATCHED_INELIGIBLE_STATUTORY_BLOCK_17_5',
                itcStatus: 'INELIGIBLE_REVERSIBLE_TABLE_4B1',
                statutorySection: 'CGST Act Section 17(5) (Statutorily Blocked Input Tax Credit)',
                vendorName: bill.vendorName,
                vendorGstin: bill.vendorGstin,
                billNumber: bill.billNumber,
                billDate: bill.billDate,
                booksTaxableInr: bill.taxableAmountInr,
                booksTaxInr: bill.totalTaxInr,
                gstr2bTaxableInr: record2b.taxableAmountInr,
                gstr2bTaxInr: record2b.totalTaxInr,
                varianceTaxableInr: fromIntegerPaise(diffTaxablePaise),
                varianceTaxInr: fromIntegerPaise(diffTaxPaise),
                isRule37Overdue,
                daysElapsedSinceBill,
                rule37Status,
                rule37ReversalTaxInr,
                rule37InterestInr,
                rule37InterestExplanation,
                isReclaimableUponPayment,
                paymentAppropriationDetails,
                jurisdictionDecisions,
                statutoryAction: 'Report in GSTR-3B Table 4(B)(1) as Ineligible ITC. Do not credit to electronic ledger.',
                auditEvidence: {
                    inBooks: true,
                    inGstr2b: true,
                    matchType,
                    blockedCategory: bill.category || 'Section 17(5) Item'
                },
                evidenceProvenance: buildEvidenceProvenance({
                    bill,
                    record2b,
                    matchType,
                    disposition: 'MATCHED_INELIGIBLE_STATUTORY_BLOCK_17_5',
                    statutorySection: 'CGST Act Section 17(5) (Statutorily Blocked Input Tax Credit)',
                    jurisdictionDecisions,
                    uncertaintyReason: null,
                    asOfDate
                })
            });
        } else if (operationalRouting === 'ROUTE_TO_BRANCH_GSTIN') {
            // Disposition: MATCHED_ROUTABLE_TO_BRANCH_GSTIN
            routableToBranchCount++;
            routableToBranchItcPaise += booksTaxPaise;

            items.push({
                disposition: 'MATCHED_ROUTABLE_TO_BRANCH_GSTIN',
                itcStatus: 'ROUTABLE_TO_ANOTHER_BRANCH_GSTIN',
                statutorySection: 'CGST Act Section 25(4) read with IGST Act Section 12 (Distinct Persons)',
                vendorName: bill.vendorName,
                vendorGstin: bill.vendorGstin,
                billNumber: bill.billNumber,
                billDate: bill.billDate,
                booksTaxableInr: bill.taxableAmountInr,
                booksTaxInr: bill.totalTaxInr,
                gstr2bTaxableInr: record2b.taxableAmountInr,
                gstr2bTaxInr: record2b.totalTaxInr,
                varianceTaxableInr: fromIntegerPaise(diffTaxablePaise),
                varianceTaxInr: fromIntegerPaise(diffTaxPaise),
                isRule37Overdue,
                daysElapsedSinceBill,
                rule37Status,
                rule37ReversalTaxInr,
                rule37InterestInr,
                rule37InterestExplanation,
                isReclaimableUponPayment,
                paymentAppropriationDetails,
                jurisdictionDecisions,
                statutoryAction: `Intra-state supply in State ${posStateCode}. Taxpayer holds valid registration in State ${posStateCode}. Route this voucher to branch GSTIN for claim in that state's GSTR-3B.`,
                auditEvidence: {
                    inBooks: true,
                    inGstr2b: true,
                    posStateCode,
                    recipientFilingState,
                    recipientRegisteredStates: Array.from(recipientStateSet)
                },
                evidenceProvenance: buildEvidenceProvenance({
                    bill,
                    record2b,
                    matchType,
                    disposition: 'MATCHED_ROUTABLE_TO_BRANCH_GSTIN',
                    statutorySection: 'CGST Act Section 25(4) read with IGST Act Section 12 (Distinct Persons)',
                    jurisdictionDecisions,
                    uncertaintyReason: null,
                    asOfDate
                })
            });
        } else if (operationalRouting === 'BOOK_AS_EXPENSE_NO_ITC') {
            // Disposition: MATCHED_INELIGIBLE_STRANDED_LOCAL_CGST_SGST
            strandedLocalCount++;
            strandedLocalItcPaise += booksTaxPaise;

            items.push({
                disposition: 'MATCHED_INELIGIBLE_STRANDED_LOCAL_CGST_SGST',
                itcStatus: 'INELIGIBLE_STRANDED_LOCAL_LEVY',
                statutorySection: 'IGST Act Section 12(3)/12(4) & CGST Act Section 16(2)(c)',
                vendorName: bill.vendorName,
                vendorGstin: bill.vendorGstin,
                billNumber: bill.billNumber,
                billDate: bill.billDate,
                booksTaxableInr: bill.taxableAmountInr,
                booksTaxInr: bill.totalTaxInr,
                gstr2bTaxableInr: record2b.taxableAmountInr,
                gstr2bTaxInr: record2b.totalTaxInr,
                varianceTaxableInr: fromIntegerPaise(diffTaxablePaise),
                varianceTaxInr: fromIntegerPaise(diffTaxPaise),
                isRule37Overdue,
                daysElapsedSinceBill,
                rule37Status,
                rule37ReversalTaxInr,
                rule37InterestInr,
                rule37InterestExplanation,
                isReclaimableUponPayment,
                paymentAppropriationDetails,
                jurisdictionDecisions,
                statutoryAction: `Mandatory intra-state supply in supplier state under Section 12(3)/12(4) (e.g. hotel/catering). Recipient lacks registration in State ${posStateCode}. Credit is stranded; absorb as operating expense.`,
                auditEvidence: {
                    inBooks: true,
                    inGstr2b: true,
                    posStateCode,
                    recipientFilingState
                },
                evidenceProvenance: buildEvidenceProvenance({
                    bill,
                    record2b,
                    matchType,
                    disposition: 'MATCHED_INELIGIBLE_STRANDED_LOCAL_CGST_SGST',
                    statutorySection: 'IGST Act Section 12(3)/12(4) & CGST Act Section 16(2)(c)',
                    jurisdictionDecisions,
                    uncertaintyReason: null,
                    asOfDate
                })
            });
        } else if (taxClassification === 'ERRONEOUS_INTRASTATE_LEVY' || (recipientJurisdiction === 'UNREGISTERED_IN_POS_STATE' && operationalRouting === 'REQUEST_VENDOR_CREDIT_NOTE_AMENDMENT')) {
            // Disposition: MATCHED_INELIGIBLE_PLACE_OF_SUPPLY_MISMATCH
            posMismatchCount++;
            posMismatchItcPaise += booksTaxPaise;

            items.push({
                disposition: 'MATCHED_INELIGIBLE_PLACE_OF_SUPPLY_MISMATCH',
                itcStatus: 'INELIGIBLE_DEFECTIVE_INVOICE_POS_ERROR',
                statutorySection: 'CGST Act Section 16(2)(c) read with IGST Act Section 10(1)(a) & Section 12',
                vendorName: bill.vendorName,
                vendorGstin: bill.vendorGstin,
                billNumber: bill.billNumber,
                billDate: bill.billDate,
                booksTaxableInr: bill.taxableAmountInr,
                booksTaxInr: bill.totalTaxInr,
                gstr2bTaxableInr: record2b.taxableAmountInr,
                gstr2bTaxInr: record2b.totalTaxInr,
                varianceTaxableInr: fromIntegerPaise(diffTaxablePaise),
                varianceTaxInr: fromIntegerPaise(diffTaxPaise),
                isRule37Overdue,
                daysElapsedSinceBill,
                rule37Status,
                rule37ReversalTaxInr,
                rule37InterestInr,
                rule37InterestExplanation,
                isReclaimableUponPayment,
                paymentAppropriationDetails,
                jurisdictionDecisions,
                statutoryAction: `Supplier erroneously charged local CGST/SGST of State ${posStateCode} instead of IGST to State ${recipientFilingState}. Demand vendor credit note and corrected IGST invoice.`,
                auditEvidence: {
                    inBooks: true,
                    inGstr2b: true,
                    posStateCode,
                    recipientFilingState
                },
                evidenceProvenance: buildEvidenceProvenance({
                    bill,
                    record2b,
                    matchType,
                    disposition: 'MATCHED_INELIGIBLE_PLACE_OF_SUPPLY_MISMATCH',
                    statutorySection: 'CGST Act Section 16(2)(c) read with IGST Act Section 10(1)(a) & Section 12',
                    jurisdictionDecisions,
                    uncertaintyReason: null,
                    asOfDate
                })
            });
        } else if (diffTaxablePaise > tolerancePaise || diffTaxPaise > tolerancePaise) {
            // Disposition: MISMATCH_AMOUNT_VALUE
            amountMismatchCount++;
            mismatchedItcPaise += booksTaxPaise;

            items.push({
                disposition: 'MISMATCH_AMOUNT_VALUE',
                itcStatus: 'VALUE_DISCREPANCY_PENDING_RESOLUTION',
                statutorySection: 'CGST Act Section 16(2)(aa) & Rule 36(4)',
                vendorName: bill.vendorName,
                vendorGstin: bill.vendorGstin,
                billNumber: bill.billNumber,
                billDate: bill.billDate,
                booksTaxableInr: bill.taxableAmountInr,
                booksTaxInr: bill.totalTaxInr,
                gstr2bTaxableInr: record2b.taxableAmountInr,
                gstr2bTaxInr: record2b.totalTaxInr,
                varianceTaxableInr: fromIntegerPaise(booksTaxablePaise - gstr2bTaxablePaise),
                varianceTaxInr: fromIntegerPaise(booksTaxPaise - gstr2bTaxPaise),
                isRule37Overdue,
                daysElapsedSinceBill,
                rule37Status,
                rule37ReversalTaxInr,
                rule37InterestInr,
                rule37InterestExplanation,
                isReclaimableUponPayment,
                paymentAppropriationDetails,
                jurisdictionDecisions,
                statutoryAction: `Taxable or tax amount exceeds ₹${toleranceInr} tolerance. Restrict claim to lower GSTR-2B amount; seek vendor credit note or amendment.`,
                auditEvidence: {
                    inBooks: true,
                    inGstr2b: true,
                    matchType,
                    varianceExceeded: true
                },
                evidenceProvenance: buildEvidenceProvenance({
                    bill,
                    record2b,
                    matchType,
                    disposition: 'MISMATCH_AMOUNT_VALUE',
                    statutorySection: 'CGST Act Section 16(2)(aa) & Rule 36(4)',
                    jurisdictionDecisions,
                    uncertaintyReason: null,
                    asOfDate
                })
            });
        } else {
            // Disposition: MATCHED_ELIGIBLE
            matchedEligibleCount++;
            eligibleItcPaise += booksTaxPaise;

            items.push({
                disposition: 'MATCHED_ELIGIBLE',
                itcStatus: isRcm ? 'ELIGIBLE_RCM_TABLE_4A3' : 'ELIGIBLE_CREDIT_TABLE_4A5',
                statutorySection: 'CGST Act Section 16(2) read with Section 16(1)',
                vendorName: bill.vendorName,
                vendorGstin: bill.vendorGstin,
                billNumber: bill.billNumber,
                billDate: bill.billDate,
                booksTaxableInr: bill.taxableAmountInr,
                booksTaxInr: bill.totalTaxInr,
                gstr2bTaxableInr: record2b.taxableAmountInr,
                gstr2bTaxInr: record2b.totalTaxInr,
                varianceTaxableInr: 0,
                varianceTaxInr: 0,
                isRule37Overdue,
                daysElapsedSinceBill,
                rule37Status,
                rule37ReversalTaxInr,
                rule37InterestInr,
                rule37InterestExplanation,
                isReclaimableUponPayment,
                paymentAppropriationDetails,
                isRcm,
                jurisdictionDecisions,
                statutoryAction: isRule37Overdue
                    ? `Eligible in GSTR-2B but >180 days unpaid (Rule 37). Must reverse ₹${rule37ReversalTaxInr} in Table 4(B)(2). Re-avail upon subsequent payment.`
                    : (isRcm
                        ? '100% matched RCM supply. Pay liability in cash in Table 3.1(d); avail credit in GSTR-3B Table 4(A)(3).'
                        : '100% matched and compliant. Avail full credit in GSTR-3B Table 4(A)(5).'),
                auditEvidence: {
                    inBooks: true,
                    inGstr2b: true,
                    matchType,
                    varianceExceeded: false,
                    isRcm
                },
                evidenceProvenance: buildEvidenceProvenance({
                    bill,
                    record2b,
                    matchType,
                    disposition: 'MATCHED_ELIGIBLE',
                    statutorySection: 'CGST Act Section 16(2) read with Section 16(1)',
                    jurisdictionDecisions,
                    uncertaintyReason: null,
                    asOfDate
                })
            });
        }
    }

    // 3. Scan Unmatched GSTR-2B Invoices (Missing in Books)
    let missingInBooksCount = 0;
    let missingInBooksTaxPaise = 0;

    for (let i = 0; i < parsed2b.length; i++) {
        const record = parsed2b[i];
        total2bTaxablePaise += toIntegerPaise(record.taxableAmountInr);
        total2bTaxPaise += toIntegerPaise(record.totalTaxInr);

        if (!matched2bSet.has(i)) {
            missingInBooksCount++;
            const taxPaise = toIntegerPaise(record.totalTaxInr);
            missingInBooksTaxPaise += taxPaise;

            const recordDateObj = new Date(record.invoiceDate);
            const asOfDateObj = new Date(asOfDate);
            const daysSinceInvoice = isNaN(recordDateObj) ? 999 : Math.floor((asOfDateObj - recordDateObj) / (1000 * 60 * 60 * 24));
            const isGoodsInTransit = daysSinceInvoice <= goodsInTransitWindowDays;

            const disposition = isGoodsInTransit ? 'MISSING_IN_BOOKS_GOODS_IN_TRANSIT' : 'MISSING_IN_BOOKS';
            const itcStatus = isGoodsInTransit ? 'GOODS_IN_TRANSIT_PENDING_RECEIPT' : 'UNRECORDED_PURCHASE_IN_BOOKS';

            const jurisdictionDecisions = {
                taxClassification: (record.cgstInr > 0 || record.sgstInr > 0) ? 'INTRASTATE_CORRECT' : 'INTERSTATE_CORRECT',
                recipientJurisdiction: recipientStateSet.has(record.posStateCode) ? 'FILING_GSTIN_MATCHES_POS' : 'UNREGISTERED_IN_POS_STATE',
                itcEligibility: isGoodsInTransit ? 'PROVISIONAL_PENDING_FILING' : 'INDETERMINATE',
                operationalRouting: isGoodsInTransit ? 'PHYSICAL_GOODS_RECEIPT_VERIFICATION_PENDING' : 'MANUAL_HUMAN_INVESTIGATION_REQUIRED'
            };

            const statutorySection = isGoodsInTransit ? 'CGST Act Section 16(2)(b) (Receipt of Goods Condition)' : 'General Accounting Principles & GST Compliance';

            items.push({
                disposition,
                itcStatus,
                statutorySection,
                vendorName: record.supplierName,
                vendorGstin: record.supplierGstin,
                billNumber: record.invoiceNumber,
                billDate: record.invoiceDate,
                booksTaxableInr: 0,
                booksTaxInr: 0,
                gstr2bTaxableInr: record.taxableAmountInr,
                gstr2bTaxInr: record.totalTaxInr,
                varianceTaxableInr: -record.taxableAmountInr,
                varianceTaxInr: -record.totalTaxInr,
                isRule37Overdue: false,
                daysElapsedSinceBill: 0,
                rule37Status: 'NOT_IN_BOOKS',
                rule37ReversalTaxInr: 0,
                rule37InterestInr: 0,
                rule37InterestExplanation: '',
                isReclaimableUponPayment: false,
                jurisdictionDecisions,
                statutoryAction: isGoodsInTransit
                    ? `Invoice reported in GSTR-2B dated ${record.invoiceDate} (within ${goodsInTransitWindowDays} days). Verify physical receipt of goods per Section 16(2)(b) before recording bill.`
                    : 'Invoice reported in GSTR-2B by supplier but missing in Zoho Books. Review purchase orders or confirm if goods/services received.',
                auditEvidence: {
                    inBooks: false,
                    inGstr2b: true,
                    docType: record.docType,
                    posStateCode: record.posStateCode,
                    isGoodsInTransit
                },
                evidenceProvenance: buildEvidenceProvenance({
                    bill: null,
                    record2b: record,
                    matchType: 'UNMATCHED',
                    disposition,
                    statutorySection,
                    jurisdictionDecisions,
                    uncertaintyReason: null,
                    asOfDate
                })
            });
        }
    }

    // Cumulative Portfolio-Level Rule 88B(3) Audit across overlapping overdue bills
    let cumulativePortfolioEclAudit = null;
    if (Array.isArray(eclLedgerHistory) && eclLedgerHistory.length > 0) {
        const overdueBills = items.filter(i => i.isRule37Overdue);
        if (overdueBills.length > 0) {
            cumulativePortfolioEclAudit = calculatePortfolioEclUtilizationInterest({
                overdueBills,
                eclLedgerHistory,
                asOfDate
            });
        }
    }

    const summary = {
        totalBooksBillsCount: parsedBills.length,
        totalGstr2bRecordsCount: parsed2b.length,
        matchedEligibleCount,
        rcmUnregisteredEligibleCount,
        compositionExcludedCount,
        interveningRegularizedPaidCount,
        interveningRegularizedUnpaidCount,
        amountMismatchCount,
        blocked17_5Count,
        posMismatchCount,
        routableToBranchCount,
        strandedLocalCount,
        gstr2bPortalIneligibleCount,
        requiresHumanVerificationCount,
        missingIn2bCount,
        missingInBooksCount,
        rule37OverdueCount,

        totalBooksTaxableInr: fromIntegerPaise(totalBooksTaxablePaise),
        totalBooksTaxInr: fromIntegerPaise(totalBooksTaxPaise),
        totalGstr2bTaxableInr: fromIntegerPaise(total2bTaxablePaise),
        totalGstr2bTaxInr: fromIntegerPaise(total2bTaxPaise),

        eligibleItcInr: fromIntegerPaise(eligibleItcPaise),
        rcmUnregisteredEligibleItcInr: fromIntegerPaise(rcmUnregisteredEligibleItcPaise),
        compositionExcludedItcInr: fromIntegerPaise(compositionExcludedItcPaise),
        interveningRegularizedTaxInr: fromIntegerPaise(interveningRegularizedTaxPaise),
        atRiskUnfiledItcInr: fromIntegerPaise(atRiskUnfiledItcPaise),
        blocked17_5ItcInr: fromIntegerPaise(blocked17_5ItcPaise),
        posMismatchItcInr: fromIntegerPaise(posMismatchItcPaise),
        routableToBranchItcInr: fromIntegerPaise(routableToBranchItcPaise),
        strandedLocalItcInr: fromIntegerPaise(strandedLocalItcPaise),
        gstr2bPortalIneligibleItcInr: fromIntegerPaise(gstr2bPortalIneligibleItcPaise),
        requiresHumanVerificationItcInr: fromIntegerPaise(requiresHumanVerificationItcPaise),
        mismatchedItcInr: fromIntegerPaise(mismatchedItcPaise),
        missingInBooksTaxInr: fromIntegerPaise(missingInBooksTaxPaise),

        rule37ReversalAmountInr: fromIntegerPaise(rule37ReversalAmountPaise),
        rule37InterestExposureInr: fromIntegerPaise(rule37InterestExposurePaise),
        paymentAppropriationMethod,
        paymentAppropriationLegalStatus: paymentAppropriationMethod === 'PROPORTIONATE' ? 'STATUTORY_MANDATE' : 'ACCOUNTING_ALLOCATION_ASSUMPTION',
        recipientTaxScheme: normalizedRecipientScheme,
        minimumEclBalanceInr: minimumEclBalanceInr !== undefined ? cleanNumericAmount(minimumEclBalanceInr) : null,
        eclUtilizationStatus,
        eclLedgerHistoryAudit: (Array.isArray(eclLedgerHistory) && eclLedgerHistory.length > 0),
        cumulativePortfolioEclAudit,

        reconciliationStatus: (missingIn2bCount === 0 && amountMismatchCount === 0 && missingInBooksCount === 0 && posMismatchCount === 0 && blocked17_5Count === 0 && requiresHumanVerificationCount === 0) ? 'FULLY_RECONCILED' : 'EXCEPTIONS_IDENTIFIED',
        isAuthorizedToDisburse: false
    };

    return {
        status: 'SUCCESS',
        auditDate: asOfDate,
        summary,
        reconciliationItems: items
    };
}

/**
 * Generates an executive Markdown audit exception memorandum for the AP & Tax team.
 * Provides transparent, reproducible evidence for every transaction.
 *
 * @param {Object} reconResult - Output of reconcileZohoGstr2b
 * @returns {string} Markdown memorandum
 */
export function generateGstr2bAuditMarkdownReport(reconResult) {
    if (!reconResult || reconResult.status !== 'SUCCESS') {
        throw new Error('[@mudraforge/statutory] Invalid reconciliation result passed to generateGstr2bAuditMarkdownReport.');
    }

    const s = reconResult.summary;
    const fmt = n => 'INR ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let md = '# ZOHO BOOKS & GSTR-2B AP RECONCILIATION AUDIT MEMORANDUM\n\n';
    md += `**Execution Date**: \`${reconResult.auditDate}\`  \n`;
    md += `**Statutory Mandate**: CGST Act Section 16(2)(aa), Section 17(5), & Rule 37 read with Section 50 & Rule 88B(3)  \n`;
    md += `**Payment Appropriation Policy**: \`${s.paymentAppropriationMethod}\`  \n`;
    if (s.minimumEclBalanceInr !== null) {
        md += `**Rule 88B(3) Minimum ECL Balance**: \`${fmt(s.minimumEclBalanceInr)}\`  \n`;
    }
    md += `**Reconciliation Disposition**: **\`${s.reconciliationStatus}\`**  \n\n`;

    md += '## 1. Executive Summary & ITC Health Matrix\n\n';
    md += '| Metric | Books (Zoho) | GSTR-2B (GSTN) | Variance / Risk |\n';
    md += '| :--- | :--- | :--- | :--- |\n';
    md += `| **Total Vouchers Scanned** | \`${s.totalBooksBillsCount}\` bills | \`${s.totalGstr2bRecordsCount}\` records | \`${s.missingIn2bCount + s.missingInBooksCount}\` unmatched |\n`;
    md += `| **Taxable Goods & Services Base** | ${fmt(s.totalBooksTaxableInr)} | ${fmt(s.totalGstr2bTaxableInr)} | ${fmt(s.totalBooksTaxableInr - s.totalGstr2bTaxableInr)} |\n`;
    md += `| **Input Tax Credit (ITC) Total** | ${fmt(s.totalBooksTaxInr)} | ${fmt(s.totalGstr2bTaxInr)} | ${fmt(s.totalBooksTaxInr - s.totalGstr2bTaxInr)} |\n`;
    md += `| **100% Eligible ITC (Table 4(A)(5))** | — | — | **${fmt(s.eligibleItcInr)}** |\n`;
    if (s.rcmUnregisteredEligibleCount > 0) {
        md += `| **Eligible Inward RCM Supplies (Table 4(A)(3))** | — | — | **${fmt(s.rcmUnregisteredEligibleItcInr)}** (\`${s.rcmUnregisteredEligibleCount}\` vouchers) |\n`;
    }
    if (s.compositionExcludedCount > 0) {
        md += `| **Commercial Rent Excluded u/s 10 (Not RCM)** | — | — | **${fmt(s.compositionExcludedItcInr)}** (\`${s.compositionExcludedCount}\` vouchers expensed) |\n`;
    }
    if (s.interveningRegularizedPaidCount > 0 || s.interveningRegularizedUnpaidCount > 0) {
        md += `| **Intervening Rent Regularized (As-Is-Where-Is)** | — | — | **${fmt(s.interveningRegularizedTaxInr)}** (\`${s.interveningRegularizedPaidCount}\` paid / \`${s.interveningRegularizedUnpaidCount}\` unpaid regularized) |\n`;
    }
    md += `| **Requires Human Verification (Uncertainty)** | — | — | **${fmt(s.requiresHumanVerificationItcInr)}** (\`${s.requiresHumanVerificationCount}\` items) |\n`;
    md += `| **Provisional / At-Risk ITC (Missing in 2B)** | — | — | **${fmt(s.atRiskUnfiledItcInr)}** (Withhold) |\n`;
    md += `| **Blocked Ineligible ITC (Sec 17(5))** | — | — | **${fmt(s.blocked17_5ItcInr)}** (Table 4(B)(1)) |\n`;
    md += `| **Routable to Other Branch GSTINs** | — | — | **${fmt(s.routableToBranchItcInr)}** (Port to Branch) |\n`;
    md += `| **Stranded Local State Levies (Sec 12(3))** | — | — | **${fmt(s.strandedLocalItcInr)}** (Absorb as Expense) |\n`;
    md += `| **Place of Supply (POS) Defective Invoices** | — | — | **${fmt(s.posMismatchItcInr)}** (Vendor Credit Note Req) |\n`;
    md += `| **Rule 37 Overdue Reversal (>180 Days)** | — | — | **${fmt(s.rule37ReversalAmountInr)}** (Table 4(B)(2)) |\n`;
    md += `| **Rule 37 Sec 50(1) Delayed Interest Exposure** | — | — | **${fmt(s.rule37InterestExposureInr)}** |\n\n`;

    if (s.cumulativePortfolioEclAudit) {
        const port = s.cumulativePortfolioEclAudit;
        md += `### Cumulative Portfolio-Level Rule 88B(3) ECL Utilization\n\n`;
        md += `- **Active Overdue Bills Pooled**: \`${reconResult.reconciliationItems.filter(i => i.isRule37Overdue).length}\`\n`;
        md += `- **Total Rule 88B(3) Interest Liability**: **${fmt(port.totalInterestInr)}**\n`;
        md += `- **Utilized Shortfall Days**: \`${port.utilizedDaysCount}\` days (Zero Interest Days: \`${port.zeroUtilizationDaysCount}\`)\n`;
        md += `- **Peak Portfolio Shortfall**: ${fmt(port.maxPortfolioUtilizationInr)}\n`;
        md += `- **Audit Finding**: ${port.explanation}\n\n`;
    }

    const exceptions = reconResult.reconciliationItems.filter(i => (
        i.disposition !== 'MATCHED_ELIGIBLE' &&
        i.disposition !== 'RCM_UNREGISTERED_SUPPLIER_ELIGIBLE' &&
        i.disposition !== 'COMPOSITION_EXCLUDED_RCM_SUPPLY' &&
        i.disposition !== 'RCM_COMPOSITION_INTERVENING_REGULARIZED_PAID' &&
        i.disposition !== 'RCM_COMPOSITION_INTERVENING_REGULARIZED_UNPAID'
    ));

    if (exceptions.length === 0) {
        md += '## 2. Statutory Audit Verdict\n\n';
        md += '> **100% CLEAN AP AUDIT**: Every purchase bill recorded in Zoho Books is corroborated by an eligible GSTR-2B return filed by registered suppliers with zero variance, zero blocked credit exposure, zero Rule 37 180-day overdue liabilities, and zero data ambiguities.\n';
        return md;
    }

    md += `## 2. Actionable AP Exceptions Register (${exceptions.length} Items)\n\n`;
    md += '| Vendor GSTIN | Vendor Name | Bill No | Bill Date | Books ITC | GSTR-2B ITC | Disposition | Reason / Statutory Action Required |\n';
    md += '| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n';

    for (const ex of exceptions) {
        const reasonText = ex.uncertaintyReason ? `[${ex.uncertaintyReason}] ` : '';
        md += `| \`${ex.vendorGstin || 'N/A'}\` | ${ex.vendorName} | \`${ex.billNumber}\` | ${ex.billDate || 'N/A'} | ${fmt(ex.booksTaxInr)} | ${fmt(ex.gstr2bTaxInr)} | **\`${ex.disposition}\`** | ${reasonText}${ex.statutoryAction} |\n`;
    }

    md += '\n## 3. Statutory Assurance & Governance Invariants\n\n';
    md += '- **Zero Money Movement Authorization**: `isAuthorizedToDisburse: false`. Statutory reconciliation assesses compliance but never authorizes disbursement.\n';
    md += '- **Rule 37 Proportional Reversal Mandate**: Computed in accordance with CGST Act Section 16(2) second proviso read with Rule 37(1).\n';
    md += '- **Rule 88B(3) Electronic Credit Ledger Benchmark**: Interest attaches strictly to utilized credit; unutilized balances incur 0.00% penal interest.\n';
    md += '- **Epistemic Integrity Standard**: Incomplete records or unverified identifiers fail open to human inspection rather than manufactured certainty.\n\n';
    md += '---\n*Report generated deterministically by MudraForge Statutory Engine under OKF v0.2 substrate.*\n';
    return md;
}

// ── Internal Helpers ────────────────────────────────────────────────────────

function parseCsvRow(rowText, delimiter = ',') {
    const result = [];
    let insideQuotes = false;
    let current = '';

    for (let i = 0; i < rowText.length; i++) {
        const char = rowText[i];
        if (char === '"') {
            if (insideQuotes && rowText[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === delimiter && !insideQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

function findColIndex(headers, candidateNames) {
    for (const name of candidateNames) {
        const idx = headers.indexOf(name);
        if (idx !== -1) return idx;
    }
    for (const name of candidateNames) {
        if (name.length <= 3) continue;
        const idx = headers.findIndex(h => h.includes(name));
        if (idx !== -1) return idx;
    }
    return -1;
}

function normalizeIsoDate(raw) {
    if (!raw) return null;
    const str = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const parts = str.split(/[-/]/);
    if (parts.length === 3) {
        if (parts[0].length === 2 && parts[2].length === 4) {
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
    }
    return null;
}

function parseGstPortalDate(raw) {
    if (!raw) return null;
    const str = String(raw).trim();
    const parts = str.split(/[-/]/);
    if (parts.length === 3) {
        if (parts[0].length === 2 && parts[2].length === 4) {
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
        if (parts[0].length === 4 && parts[2].length === 2) {
            return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        }
    }
    return str;
}

function calculateDaysElapsed(fromDateStr, toDateStr) {
    if (!fromDateStr || !toDateStr) return 0;
    const fromMs = new Date(fromDateStr).getTime();
    const toMs = new Date(toDateStr).getTime();
    if (isNaN(fromMs) || isNaN(toMs)) return 0;
    return Math.max(0, Math.floor((toMs - fromMs) / (1000 * 60 * 60 * 24)));
}
