# Admin Dashboard — Data Source Integrations

This is the setup guide for wiring the **connect-ready** tabs in the v2
admin dashboard (`/gr-panel-7x9k/v2`) to real data. Each section tells you
exactly where to get the credential, which env vars to set, and what it
unlocks.

The dashboard UI for every source is already built. A source flips from
"not connected yet" to live data once (a) its env vars are populated and
(b) its `/api/admin/<source>` route is implemented. The route work is on
us; the credential work below is on you (Kevin/Alex), since these all
require account access we don't have.

---

## How env vars get set

- **Local dev:** add them to `.env.local` in the project root (gitignored).
- **Production:** Vercel → Project → Settings → Environment Variables.
- After adding in Vercel, **redeploy** for them to take effect.
- Never commit secrets. `.p8` files and tokens stay out of git.

---

## 1. Stripe — Gym Partner subscriptions ✅ already configured

**Status:** the key already exists (`STRIPE_SECRET_KEY`), and the webhook
at `/api/stripe/webhook` already flips `subscriptionActive` on gym partner
docs. The Subscriptions tab's gym-partner numbers can read from Firestore
today; pulling full MRR / churn history just needs a small read route
against the Stripe API (no new credential).

**Nothing for you to do here** unless you rotate the key.

---

## 2. App Store Connect API — Reviews + Pro/Pro+ subscriptions

**One key unlocks two tabs:** Ratings & Reviews *and* consumer Pro/Pro+
subscription data.

**Where to get it:**
1. [App Store Connect](https://appstoreconnect.apple.com) → **Users and Access**
2. Open the **Integrations** tab → **App Store Connect API**
3. Click **+** to generate a key. Give it **Admin** or **Finance + Sales**
   access (Finance is required for subscription/sales reports; Sales for
   reviews).
4. Note the **Issuer ID** (shown above the keys table) and the **Key ID**.
5. **Download the `.p8` private key** — you can only download it ONCE. Store
   it safely.

**Env vars to set:**
```
APP_STORE_CONNECT_ISSUER_ID   = <the issuer UUID>
APP_STORE_CONNECT_KEY_ID      = <the key ID>
APP_STORE_CONNECT_PRIVATE_KEY = <contents of the .p8 file>
```
> For the private key in Vercel, paste the full `.p8` contents including the
> `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----` lines. Newlines
> can be kept literal or escaped as `\n` — the route will normalize.

**Gotchas:**
- Reviews come from the **App Store Connect API** (`customerReviews`).
- Subscription/sales data comes from **Sales and Trends reports** (a
  separate endpoint, returns gzipped TSV) or the newer **App Store Server
  API** for live subscription status. We'll wire the reporting endpoint
  for the dashboard's purchase/cancellation counts.
- Apple's review API only returns reviews that have written text, per
  territory. Star-only ratings come via the sales reports.

---

## 3. Meta Marketing API — Ad statistics

Pulls performance for ads and boosted posts on Facebook/Instagram.

**Where to get it:**
1. [Meta Business Suite](https://business.facebook.com) → **Business Settings**
2. **Users → System Users** → add a system user (or use an existing one)
3. Assign it to your **ad account** with at least `ads_read` permission
4. **Generate New Token** for that system user; select the `ads_read` scope.
   Choose a long-lived/never-expiring system-user token.
5. Find your **Ad Account ID** in [Ads Manager](https://adsmanager.facebook.com)
   — it's the `act_XXXXXXXXXX` number in the account dropdown.

**Env vars to set:**
```
META_ACCESS_TOKEN   = <system user token>
META_AD_ACCOUNT_ID  = act_XXXXXXXXXX
```

**Gotchas:**
- The app querying the token must have the Marketing API product enabled.
- System-user tokens don't expire (unlike user tokens) — that's why we use
  one instead of a personal token.
- Per-post insights need the `read_insights` permission if you want organic
  post stats in addition to paid ads.

---

## 4. Social Following — Instagram, TikTok, X

Follower counts + engagement. Each platform is its own integration; you can
wire them one at a time (the Social tab shows whichever are connected).

### Instagram (Graph API)
- Requires an Instagram **Business or Creator** account linked to a
  **Facebook Page**.
- Same Meta app as the ads integration. Add the **Instagram Graph API**
  product; grant `instagram_basic` + `instagram_manage_insights`.
- Env: `INSTAGRAM_ACCESS_TOKEN` (can reuse the system-user token if scoped).

### TikTok
- [TikTok for Developers](https://developers.tiktok.com) → create an app →
  apply for the **Display API** / **Research API** (follower + video stats).
- Env: `TIKTOK_ACCESS_TOKEN`.
- Note: TikTok's API approval can take time and the analytics endpoints are
  gated — this is the least reliable of the three.

### X (Twitter)
- [X Developer Portal](https://developer.x.com) → create a project/app.
- The follower/metrics endpoints require at least the **Basic** paid tier.
- Env: `X_BEARER_TOKEN`.

**Env vars (set whichever you have):**
```
INSTAGRAM_ACCESS_TOKEN = <token>
TIKTOK_ACCESS_TOKEN    = <token>
X_BEARER_TOKEN         = <bearer token>
```

---

## 5. Firebase Crashlytics — Crash analytics (hardest)

Crashlytics has **no public REST API**. The supported path is the BigQuery
export.

**Where to set it up:**
1. [Firebase Console](https://console.firebase.google.com) → your project →
   **Crashlytics**
2. There should be a **BigQuery** integration / link option (also under
   **Project Settings → Integrations → BigQuery**). Enable the export.
3. Once enabled, Crashlytics writes a daily table into a BigQuery dataset
   (typically `firebase_crashlytics`).
4. We query that dataset server-side using the existing Firebase Admin
   service account (it already has project access via `FIREBASE_ADMIN_*`).

**Env var:**
```
BIGQUERY_CRASHLYTICS_DATASET = firebase_crashlytics
```

**Gotchas:**
- Export is **not retroactive** — data starts accumulating only after you
  enable it.
- BigQuery has its own (small at this scale) query costs.
- The Admin service account may need the **BigQuery Data Viewer** +
  **BigQuery Job User** roles added in Google Cloud IAM.

---

## Priority order (recommendation)

1. **App Store Connect** — one key, two tabs (reviews + Pro/Pro+). Highest ROI.
2. **Stripe history route** — no new credential, just our route work.
3. **Meta Marketing** — one token + account ID, unlocks ads (and helps IG).
4. **Instagram** — piggybacks on the Meta app.
5. **TikTok / X** — more setup, lower urgency.
6. **Crashlytics** — most involved; do last.

When you have a credential ready, hand it over (or set it in Vercel) and
tell me which one — I'll implement that source's `/api/admin/<source>`
route and flip its tab from connect-ready to live.
