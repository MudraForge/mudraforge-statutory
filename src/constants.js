/**
 * @fileoverview Canonical Single-Source-of-Truth Constants for @mudraforge/statutory.
 * Pure ESM module with zero Node.js/browser-specific dependencies.
 * Safe to import across Node.js, Cloudflare Workers, browsers, and Edge runtimes.
 *
 * @license MIT
 */

export const STATUTORY_CLIENT_VERSION = '2.15.0';
export const DEFAULT_BASE_URL = 'https://api.mudraforge.in';

// Current RBI Bank Rate (H2 2024 - 2026 baseline): 6.75%
export const DEFAULT_RBI_BANK_RATE = 0.0675;

// Dated RBI Bank Rate Schedule notified under Section 49 of the RBI Act, 1934
export const RBI_BANK_RATE_SCHEDULE = [
    { effectiveFrom: '2023-02-08', effectiveTo: null, rate: 0.0675, notificationRef: 'RBI/2022-23/177' },
    { effectiveFrom: '2022-12-07', effectiveTo: '2023-02-07', rate: 0.0650, notificationRef: 'RBI/2022-23/150' },
    { effectiveFrom: '2022-09-30', effectiveTo: '2022-12-06', rate: 0.0615, notificationRef: 'RBI/2022-23/120' }
];

/**
 * Resolves the official RBI Bank Rate in effect on a specific transaction or due date.
 */
export function getRbiBankRateForDate(dateString) {
    const d = dateString ? new Date(dateString) : new Date();
    const dateIso = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const match = RBI_BANK_RATE_SCHEDULE.find(item => {
        if (item.effectiveFrom && dateIso < item.effectiveFrom) return false;
        if (item.effectiveTo && dateIso > item.effectiveTo) return false;
        return true;
    });
    return match ? match.rate : DEFAULT_RBI_BANK_RATE;
}

// Statutory Multiple per MSMED Act 2006 Section 16: 3x Bank Rate
export const MSMED_RATE_MULTIPLIER = 3;

export const VALID_194J_CATEGORIES = [
    'PROFESSIONAL_SERVICES',
    'TECHNICAL_SERVICES',
    'ROYALTY',
    'NON_COMPETE_FEES',
    'DIRECTOR_REMUNERATION'
];

export const AUTHORITATIVE_STATUTORY_RATES = {
    // 1. Finance Act Rates
    'FINANCE_ACT:2025:SCHEDULE_I_PART_II:ITEM_2_B': {
        ratePercent: 10.0,
        source: 'FINANCE_ACT',
        citation: 'Finance Act, 2025 Schedule I Part II Item 2(b)',
        effectiveFrom: '2025-04-01',
        effectiveTo: '2026-03-31',
        applicableCategories: ['TECHNICAL_SERVICES', 'ROYALTY', 'SPECIFIED_FEES']
    },
    'FINANCE_ACT:2026:SCHEDULE_I_PART_II:ITEM_2_B': {
        ratePercent: 10.0,
        source: 'FINANCE_ACT',
        citation: 'Finance Act, 2026 Schedule I Part II Item 2(b)',
        effectiveFrom: '2026-04-01',
        effectiveTo: '2027-03-31',
        applicableCategories: ['TECHNICAL_SERVICES', 'ROYALTY', 'SPECIFIED_FEES']
    },
    // 2. DTAA Double Taxation Avoidance Treaty Rates
    'DTAA_TREATY:INDIA_US:ARTICLE_12_2': {
        ratePercent: 15.0,
        source: 'DTAA_TREATY',
        citation: 'India-US Double Taxation Avoidance Agreement Article 12(2)',
        effectiveFrom: '1991-01-01',
        effectiveTo: '2099-12-31',
        applicableCategories: ['FTS', 'ROYALTY', 'TECHNICAL_SERVICES']
    },
    'DTAA_TREATY:INDIA_SINGAPORE:ARTICLE_12_2': {
        ratePercent: 10.0,
        source: 'DTAA_TREATY',
        citation: 'India-Singapore Double Taxation Avoidance Agreement Article 12(2)',
        effectiveFrom: '1994-08-08',
        effectiveTo: '2099-12-31',
        applicableCategories: ['FTS', 'ROYALTY', 'TECHNICAL_SERVICES']
    },
    'DTAA_TREATY:INDIA_GERMANY:ARTICLE_12_2': {
        ratePercent: 10.0,
        source: 'DTAA_TREATY',
        citation: 'India-Germany Double Taxation Avoidance Agreement Article 12(2)',
        effectiveFrom: '1996-10-26',
        effectiveTo: '2099-12-31',
        applicableCategories: ['FTS', 'ROYALTY', 'TECHNICAL_SERVICES']
    }
};

/**
 * Resolves the statutory missing-PAN penalty floor:
 * - Income-tax Act, 1961 Section 206AA(1) First Proviso
 * - Income-tax Act, 2025 Section 397(2)
 */
export function resolveMissingPanPenaltyFloor({
    sectionCode = '194Q',
    tableItem = null,
    isAct2025 = false
} = {}) {
    const sec = String(sectionCode || '').toUpperCase().trim();
    const item = String(tableItem || '').toLowerCase().trim();

    const isGoodsPurchase = sec === '194Q' || item === '393_8_ii' || item === '393_1_8_ii' || item === 'sl 8(ii)' || item === 'sl. no. 8(ii)' || item === 'item 8(ii)' || item === '8(ii)';
    const isEcommerce = sec === '194O' || sec === '194-O' || item === '393_8_v' || item === '393_1_8_i' || item === 'sl 8(i)' || item === 'sl. no. 8(i)' || item === 'item 8(v)' || item === '8(v)' || item === '8(i)';

    if (isGoodsPurchase || isEcommerce) {
        return {
            penaltyFloorPercent: 5.0,
            isConcessional5PercentApplicable: true,
            categoryScope: isGoodsPurchase ? 'SPECIFIED_GOODS_PURCHASE_5_PERCENT' : 'SPECIFIED_ECOMMERCE_PARTICIPANT_5_PERCENT',
            governingProviso: isAct2025
                ? `Income-tax Act, 2025 Section 397(2)(b)(i)(${isGoodsPurchase ? 'C' : 'D'}) read with Section 393(1), Table 1, Sl. No. ${isGoodsPurchase ? '8(ii)' : '8(i)'}`
                : `Income-tax Act, 1961 Section 206AA(1) First Proviso read with Section ${sec}`
        };
    }

    return {
        penaltyFloorPercent: 20.0,
        isConcessional5PercentApplicable: false,
        categoryScope: 'GENERAL_SERVICES_AND_FEES_20_PERCENT',
        governingProviso: isAct2025
            ? 'Income-tax Act, 2025 Section 397(2)(a)'
            : 'Income-tax Act, 1961 Section 206AA(1)(iii)'
    };
}
