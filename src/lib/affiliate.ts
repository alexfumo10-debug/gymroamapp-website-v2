/**
 * Affiliate / creator program — shared config and referral-code rules.
 *
 * Single source of truth for anything a human might need to audit later:
 * the code grammar, the reserved list, the commission tiers, and the
 * clearing rules. The commission numbers here are what we're
 * contractually on the hook for, so they live in ONE place and are
 * imported everywhere rather than retyped.
 *
 * Program shape (application, not open signup):
 *   1. Creator applies at /affiliates and REQUESTS a code
 *   2. We review in the admin panel (Affiliates tab)
 *   3. On approval we ISSUE the code — atomically reserved in the
 *      `affiliateCodes` collection, doc id = normalized code
 *   4. Welcome email carries the code, tracking link, and dashboard login
 *
 * A requested code is never live until an admin approves it. Checking
 * availability at type-time is a courtesy, not a reservation.
 */

/* ────────────────────────────────────────────────────────────
   CODE GRAMMAR
   ──────────────────────────────────────────────────────────── */

export const CODE_MIN_LENGTH = 3;
export const CODE_MAX_LENGTH = 20;

/**
 * Codes are matched case-insensitively, so we store and compare an
 * uppercased form. `affiliateCodes/{NORMALIZED}` is the uniqueness
 * lock — Firestore doc-id creation is atomic, which is what stops two
 * simultaneous approvals from issuing the same code.
 */
export function normalizeCode(raw: string): string {
  return (raw || "").trim().toUpperCase();
}

/**
 * Doc id in `creatorCodes/` — the collection the iOS APP reads to unlock the
 * creator-discount SKU at the paywall. Deliberately the OPPOSITE case fold
 * from `normalizeCode`: the app lowercases whatever the user types
 * (AttributionFeature.normalizeCreatorCode: trim, strip "@", lowercase) and
 * does an exact-ID get, so the twin doc MUST be lowercase to be findable.
 * `affiliateCodes/{UPPER}` and `creatorCodes/{lower}` describe the same code
 * in two systems; nothing may mix the two conventions.
 */
export function creatorCodeDocId(code: string): string {
  return (code || "").trim().replace(/@/g, "").toLowerCase();
}

/**
 * What the app renders as "{displayName}'s code applied" on the onboarding
 * creator page. The applicant's first name beats a prettified code: a creator
 * named Ashley with code FITWITHASH should read "Ashley's", not
 * "Fitwithash's". Falls back to a capitalized code when the application has
 * no usable name (the app itself falls back to the raw code if this is ever
 * empty, which reads like a typo — so never store empty).
 */
export function creatorDisplayName(fullName: string, code: string): string {
  const first = (fullName || "").trim().split(/\s+/)[0] || "";
  if (first) return first.charAt(0).toUpperCase() + first.slice(1);
  const c = creatorCodeDocId(code);
  return c ? c.charAt(0).toUpperCase() + c.slice(1) : c;
}

/**
 * Reserved words. Two reasons a code lands here:
 *   - it would let an affiliate impersonate us (GYMROAM, SUPPORT, BILLING)
 *   - it reads like a system/marketing code a user might guess and try
 *     (FREE, PRO, TEST, PROMO)
 *
 * Extend freely — this is checked on both the availability endpoint and
 * the approval path, so adding a word here retroactively blocks it from
 * being issued even if someone already requested it.
 */
export const RESERVED_CODES: readonly string[] = [
  // Brand / impersonation
  "GYMROAM", "GYMROAMAPP", "GYM", "ROAM", "GR", "OFFICIAL", "TEAM",
  "SUPPORT", "HELP", "BILLING", "PAYMENTS", "SALES", "CONTACT",
  "SECURITY", "NOREPLY", "APPLE", "APPSTORE", "STRIPE",
  // System / administrative
  "ADMIN", "ADMINISTRATOR", "ROOT", "SYSTEM", "STAFF", "MOD", "OWNER",
  "API", "NULL", "UNDEFINED", "NONE", "DELETED", "ANONYMOUS",
  // Offer-sounding words users would guess
  "FREE", "PRO", "PROPLUS", "PLUS", "PREMIUM", "TRIAL", "TEST", "TESTING",
  "PROMO", "PROMOCODE", "COUPON", "DISCOUNT", "SALE", "OFFER", "DEAL",
  "REFER", "REFERRAL", "AFFILIATE", "PARTNER", "CREATOR", "INFLUENCER",
  "WELCOME", "LAUNCH", "BETA", "VIP", "GIFT", "BONUS", "REWARD",
];

/**
 * Profanity / slur stems, matched as substrings against the normalized
 * code. Deliberately a stem list rather than exact words so leetspeak
 * padding ("XXSHITXX") is still caught.
 *
 * Kept short and mild on purpose: this is a first-pass filter, and the
 * real gate is that a human approves every code before it goes live.
 * If this list ever needs to be exhaustive, swap it for a maintained
 * package rather than growing it by hand here.
 */
const PROFANITY_STEMS: readonly string[] = [
  "FUCK", "SHIT", "CUNT", "BITCH", "DICK", "COCK", "PUSSY", "TWAT",
  "WANK", "BASTARD", "ASSHOLE", "SLUT", "WHORE", "NIGG", "FAGG",
  "RAPE", "NAZI", "HITLER", "KKK", "PORN", "SEX", "XXX",
];

export type CodeRejection =
  | "empty"
  | "too_short"
  | "too_long"
  | "not_alphanumeric"
  | "must_start_with_letter"
  | "reserved"
  | "profanity";

export const CODE_REJECTION_MESSAGES: Record<CodeRejection, string> = {
  empty: "Enter a code",
  too_short: `Codes need at least ${CODE_MIN_LENGTH} characters`,
  too_long: `Codes can be at most ${CODE_MAX_LENGTH} characters`,
  not_alphanumeric: "Letters and numbers only — no spaces or symbols",
  must_start_with_letter: "Codes must start with a letter",
  reserved: "That code is reserved",
  profanity: "That code isn't available",
};

/**
 * Format + policy check. Does NOT touch the database — pure, so both
 * the client (instant feedback while typing) and the server (the real
 * gate) run the identical rules.
 *
 * Returns null when the code is acceptable.
 */
export function validateCodeFormat(raw: string): CodeRejection | null {
  const code = normalizeCode(raw);
  if (!code) return "empty";
  if (!/^[A-Z0-9]+$/.test(code)) return "not_alphanumeric";
  if (code.length < CODE_MIN_LENGTH) return "too_short";
  if (code.length > CODE_MAX_LENGTH) return "too_long";
  // All-numeric codes get confused with order/invoice numbers in support
  // threads, and read as a typo on a story slide.
  if (!/^[A-Z]/.test(code)) return "must_start_with_letter";
  if (RESERVED_CODES.includes(code)) return "reserved";
  if (PROFANITY_STEMS.some((stem) => code.includes(stem))) return "profanity";
  return null;
}

/**
 * Suggest alternatives for a taken (or rejected) code.
 *
 * Ordered cheapest-to-weirdest so the first suggestion is usually the
 * one they want: bare numeric suffixes, then the year, then short
 * fitness-flavored suffixes. `isTaken` is injected so this stays pure
 * and testable — the API route passes a set-membership check.
 */
export function suggestAlternatives(
  raw: string,
  isTaken: (normalized: string) => boolean,
  count = 3
): string[] {
  const base = normalizeCode(raw).replace(/[^A-Z0-9]/g, "");
  if (!base) return [];

  const year = new Date().getFullYear();
  const candidates: string[] = [];

  for (let i = 1; i <= 9; i++) candidates.push(`${base}${i}`);
  candidates.push(`${base}${year}`);
  candidates.push(`${base}X`, `${base}HQ`, `${base}FIT`, `${base}GR`);
  candidates.push(`GET${base}`, `TRY${base}`, `JOIN${base}`);

  const out: string[] = [];
  for (const c of candidates) {
    if (out.length >= count) break;
    if (c.length > CODE_MAX_LENGTH) continue;
    if (validateCodeFormat(c) !== null) continue;
    if (isTaken(c)) continue;
    if (out.includes(c)) continue;
    out.push(c);
  }
  return out;
}

/* ────────────────────────────────────────────────────────────
   TRACKING LINK
   ──────────────────────────────────────────────────────────── */

export const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://gymroamapp.com";

/**
 * The link an affiliate puts in their bio. Lands on the public site
 * (so we can count the click and set attribution) rather than sending
 * people straight to the App Store — a direct App Store link is
 * unattributable once Apple takes over.
 */
export function trackingLink(code: string): string {
  return `${SITE_ORIGIN}/r/${normalizeCode(code)}`;
}

/* ────────────────────────────────────────────────────────────
   OFFER
   ──────────────────────────────────────────────────────────── */

/**
 * What the end user gets for entering a code: $4 off the annual plan,
 * honored both at onboarding and at upgrade.
 *
 * NOTE FOR IMPLEMENTERS: Apple IAP cannot apply an arbitrary dollar
 * discount at runtime. Delivering this requires a discounted price
 * point (or a StoreKit 2 promotional offer) configured in App Store
 * Connect and unlocked by the iOS app once the code validates. This
 * constant is the source of truth for the *intended* delta so the
 * marketing copy and the configured price point can be checked against
 * each other — it is not itself the mechanism.
 */
export const AFFILIATE_DISCOUNT_USD = 4;

/* ────────────────────────────────────────────────────────────
   COMMISSION
   ──────────────────────────────────────────────────────────── */

export interface CommissionTier {
  /** Inclusive lower bound of Pro signups in the rolling window. */
  minSignups: number;
  /** Inclusive upper bound, or null for "and above". */
  maxSignups: number | null;
  /** Share of NET revenue, as a fraction. */
  rate: number;
  label: string;
}

/**
 * Tiers are evaluated on Pro signups in a ROLLING 12-MONTH window.
 *
 * Tier increases apply going forward only, from the moment the
 * threshold is crossed. Commission already accrued is never re-rated —
 * so a payout record must store the rate that was in force when it was
 * earned, not look the rate up again at payout time.
 */
export const COMMISSION_TIERS: readonly CommissionTier[] = [
  { minSignups: 1, maxSignups: 9, rate: 0.35, label: "35%" },
  { minSignups: 10, maxSignups: 49, rate: 0.4, label: "40%" },
  { minSignups: 50, maxSignups: null, rate: 0.45, label: "45%" },
];

export const ROLLING_WINDOW_DAYS = 365;

/** Which tier a given rolling-window signup count falls into. */
export function tierForSignups(signups: number): CommissionTier {
  for (let i = COMMISSION_TIERS.length - 1; i >= 0; i--) {
    if (signups >= COMMISSION_TIERS[i].minSignups) return COMMISSION_TIERS[i];
  }
  return COMMISSION_TIERS[0];
}

/** Signups still needed to reach the next tier, or null at the top. */
export function signupsToNextTier(signups: number): number | null {
  const current = tierForSignups(signups);
  const idx = COMMISSION_TIERS.indexOf(current);
  const next = COMMISSION_TIERS[idx + 1];
  if (!next) return null;
  return Math.max(0, next.minSignups - signups);
}

/**
 * Apple's cut of an IAP transaction.
 *
 * 0.15 under the App Store Small Business Program (<$1M/yr proceeds),
 * otherwise 0.30 for year one of a subscription and 0.15 from the
 * second year onward. VERIFY WHICH APPLIES BEFORE THE FIRST PAYOUT —
 * getting this wrong flows straight into every commission figure.
 *
 * This is only a fallback for projections. Actual payouts must use the
 * real proceeds from Apple's financial reports, not this estimate.
 */
export const APPLE_COMMISSION_RATE_FALLBACK = Number(
  process.env.APPLE_COMMISSION_RATE ?? 0.15
);

/**
 * Commission is calculated on NET revenue — what actually lands in our
 * account after Apple's cut, refunds, and taxes — never on the gross
 * list price. Calculating on gross at a 45% tier would pay out more
 * than we keep.
 *
 * `netRevenue` must come from Apple's financial reports where possible;
 * `estimateNetRevenue` is for projections only and is named to make
 * that obvious at the call site.
 */
export function estimateNetRevenue(
  grossUsd: number,
  appleRate = APPLE_COMMISSION_RATE_FALLBACK
): number {
  return grossUsd * (1 - appleRate);
}

export function commissionOnNet(netUsd: number, tierRate: number): number {
  return Math.max(0, netUsd) * tierRate;
}

/* ────────────────────────────────────────────────────────────
   CLEARING + PAYOUT RULES
   ──────────────────────────────────────────────────────────── */

/** A subscription must stay active this many consecutive days before
 *  its commission clears and becomes payable. Refunds, chargebacks, and
 *  cancellations inside the window never accrue. */
export const CLEARING_DAYS = 30;

/** Balances under this roll forward to the next month. */
export const MIN_PAYOUT_USD = 25;

/** Payouts run monthly, within this many days of month close. */
export const PAYOUT_WINDOW_DAYS = 30;

/* ────────────────────────────────────────────────────────────
   FORM VOCABULARY
   ──────────────────────────────────────────────────────────── */

export const CONTENT_NICHES = [
  "Fitness",
  "Travel",
  "Wellness",
  "Lifestyle",
  "Other",
] as const;

export const AUDIENCE_LOCATIONS = [
  "Mostly US",
  "Mostly international",
  "Mixed",
] as const;

export const PAYMENT_METHODS = [
  "Direct deposit (ACH)",
  "Zelle",
  "Venmo",
  "PayPal",
] as const;

export const REFERRAL_SOURCES = [
  "Instagram",
  "TikTok",
  "A friend / another creator",
  "GymRoam reached out to me",
  "Search",
  "Other",
] as const;

export type ContentNiche = (typeof CONTENT_NICHES)[number];
export type AudienceLocation = (typeof AUDIENCE_LOCATIONS)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * The Sign in with Apple problem, stated once and reused in the form,
 * the confirmation email, and the welcome email.
 *
 * Apple's Hide My Email gives us a private relay address that doesn't
 * match anything we can search, so we can't find the account to turn
 * Pro on. This cost us a manual scramble with the first creator we
 * onboarded.
 */
export const APPLE_SIGNIN_WARNING =
  "When you sign up in the GymRoam app, use an email address — not Sign in with Apple. Apple hides your real email behind a private relay, which means we can't find your account to switch on your free Pro.";
