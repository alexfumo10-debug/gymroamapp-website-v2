/**
 * Data-source registry.
 *
 * One entry per external data source the dashboard surfaces. Drives:
 *   - the "Not connected yet" empty states on connect-ready tabs
 *     (what credential is missing + the one-liner on how to get it)
 *   - a future Integrations status view
 *
 * `status: "live"` sources are already wired to real data. Everything
 * else is "connect-ready": the UI is fully built and flips to real
 * data the moment its `envVars` are populated and the matching
 * /api/admin/<key> route is implemented.
 *
 * The full step-by-step credential walkthroughs live in
 * docs/admin-integrations.md.
 */

export type SourceStatus = "live" | "connect-ready";

export interface DataSource {
  key: string;
  label: string;
  status: SourceStatus;
  /** One-line summary of what powers (or will power) this source. */
  summary: string;
  /** Which provider's credential is required (connect-ready only). */
  provider?: string;
  /** Env vars the integration route will read. */
  envVars?: string[];
  /** Short "how to get it" hint shown in the empty state. */
  setupHint?: string;
}

export const DATA_SOURCES: Record<string, DataSource> = {
  users: {
    key: "users",
    label: "App Users",
    status: "live",
    summary: "Firebase Auth + Firestore /users, cross-referenced for canonical email.",
  },
  traffic: {
    key: "traffic",
    label: "Website Traffic",
    status: "live",
    summary: "Firestore /pageViews written by the public site's tracker.",
  },
  feedback: {
    key: "feedback",
    label: "Feedback",
    status: "live",
    summary: "Firestore /feedback from the public feedback board.",
  },
  pipeline: {
    key: "pipeline",
    label: "Pipeline",
    status: "live",
    summary: "Gym, trainer & career applications from Firestore.",
  },
  affiliates: {
    key: "affiliates",
    label: "Affiliates",
    status: "live",
    summary:
      "Creator referral applications from /affiliates, with code issuance on approval.",
  },
  gymSubs: {
    key: "gymSubs",
    label: "Gym Partner Subscriptions",
    status: "live",
    summary: "Stripe subscriptions for B2B gym partners ($99/mo).",
    provider: "Stripe",
    envVars: ["STRIPE_SECRET_KEY"],
  },
  consumerSubs: {
    key: "consumerSubs",
    label: "Pro / Pro+ Subscriptions",
    status: "connect-ready",
    summary: "Consumer in-app subscriptions (Pro, Pro+) sold via Apple IAP.",
    provider: "App Store Connect",
    envVars: [
      "APP_STORE_CONNECT_ISSUER_ID",
      "APP_STORE_CONNECT_KEY_ID",
      "APP_STORE_CONNECT_PRIVATE_KEY",
      "APP_STORE_CONNECT_VENDOR_NUMBER",
    ],
    setupHint:
      "App Store Connect → Users and Access → Integrations → App Store Connect API. Generate a TEAM key with Admin (or Finance) access; download the .p8 once. Subscription reports also need your Vendor Number (Payments and Financial Reports).",
  },
  ads: {
    key: "ads",
    label: "Ad Stats",
    status: "connect-ready",
    summary: "Meta (Facebook/Instagram) ad & boosted-post performance.",
    provider: "Meta Marketing API",
    envVars: [
      "META_ACCESS_TOKEN",
      "META_AD_ACCOUNT_ID",
      "META_APP_SECRET",
      "META_GRAPH_VERSION",
    ],
    setupHint:
      "Meta Business Suite → Business Settings → System Users → generate a token with ads_read. Ad account ID is the act_XXXXXXXX in Ads Manager. META_GRAPH_VERSION pins the API version (e.g. v25.0).",
  },
  reviews: {
    key: "reviews",
    label: "Ratings & Reviews",
    status: "connect-ready",
    summary: "App Store customer ratings and written reviews.",
    provider: "App Store Connect",
    envVars: [
      "APP_STORE_CONNECT_ISSUER_ID",
      "APP_STORE_CONNECT_KEY_ID",
      "APP_STORE_CONNECT_PRIVATE_KEY",
    ],
    setupHint:
      "Same App Store Connect API key as Pro/Pro+ subscriptions — one key unlocks both reviews and subscription data.",
  },
  social: {
    key: "social",
    label: "Instagram",
    status: "connect-ready",
    summary: "Instagram follower & engagement analytics.",
    provider: "Instagram Graph API",
    envVars: ["INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_IG_USER_ID"],
    setupHint:
      "Instagram Graph API — a Business/Creator account linked to the GymRoam Facebook Page, a long-lived Page (or system-user) token, and the IG Business account id.",
  },
  crashes: {
    key: "crashes",
    label: "Crash Analytics",
    status: "connect-ready",
    summary: "Firebase Crashlytics crash-free rate, top issues, affected users.",
    provider: "Firebase Crashlytics (BigQuery export)",
    envVars: ["CRASHLYTICS_BQ_TABLE", "CRASHLYTICS_SESSIONS_TABLE"],
    setupHint:
      "Crashlytics has no direct REST API. Enable Firebase → Crashlytics → BigQuery export (wait ~24h for first data), grant the Firebase service account BigQuery Data Viewer + Job User in GCP IAM, then we query the dataset. The heaviest of the integrations.",
  },
};

/** Convenience: is a source live (wired to real data) right now? */
export function isLive(key: string): boolean {
  return DATA_SOURCES[key]?.status === "live";
}
