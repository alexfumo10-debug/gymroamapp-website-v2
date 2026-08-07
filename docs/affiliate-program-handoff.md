# Affiliate / Creator Program — Everything Needed on the Firebase + iOS Side

**For: Alex** · **From: Kevin** · Website work is complete; this is the
remaining half.

Kevin has no Firebase access, so everything in this document needs to
come from you — including two blockers in Part 0 that are unrelated to
the affiliate feature itself but are currently breaking things in
production.

The website side is finished and merged: the application form, admin
approval, code issuance, tracking links, the creator dashboard, the
admin performance view, and the full commission engine. None of it can
be verified end-to-end until Part 0 is resolved.

---

# PART 0 — BLOCKERS (please do these first)

## 0.1 The Firebase Admin service-account key is dead

**This is the single biggest blocker and it is not specific to the
affiliate work.**

```
Project:         gymroam-ad7dc
Service account: firebase-adminsdk-fbsvc@gymroam-ad7dc.iam.gserviceaccount.com
```

Every server-side call using this credential fails with:

```
16 UNAUTHENTICATED: Request had invalid authentication credentials.
```

Verified by reading `pageViews` — a long-standing collection — directly
with the Admin SDK, outside any application code. The key is
structurally intact (correct PEM headers, correct project, correct
client email), so it's been **revoked, rotated, or the service account
was deleted**, rather than malformed.

### What this currently breaks

Every route that touches `adminDb()` or `adminAuth()`:

- `/api/admin/users-auth`, `/consumer-subs`, `/gym-subs`, `/reviews`,
  `/ads`, `/social`, `/app-store` — the whole admin dashboard's server data
- `/api/admin/app-store/ingest` — **the daily 09:00 Vercel cron**
  (`vercel.json`). If production shares this key, that job has been
  failing silently every morning.
- `/api/stripe/webhook` — gym partner subscription activation
- All the new affiliate routes

### What's needed

1. Firebase Console → Project Settings → Service Accounts → **Generate
   new private key**
2. Send Kevin the three values (or set them yourself if you have Vercel
   access):
   ```
   FIREBASE_ADMIN_PROJECT_ID
   FIREBASE_ADMIN_CLIENT_EMAIL
   FIREBASE_ADMIN_PRIVATE_KEY     # newlines as literal \n
   ```
3. They need to be updated in **both** places:
   - Vercel → Project → Settings → Environment Variables (production)
   - Kevin's local `.env.local`
4. Worth checking whether the old key was deliberately revoked — if it
   was rotated for a security reason, that's context we should know.

Until this is done, nothing below can be tested, and the admin dashboard
cannot show real data.

## 0.2 Firestore security rules — possible PII exposure

The public forms (`/affiliates`, `/trainer`, `/careers`, gym partner)
all submit with the **client SDK from unauthenticated visitors**. For
that to work, the rules must allow unauthenticated `create` on those
collections.

If the rules are broadly permissive — which is likely, given all four
forms work this way — then those collections are also **readable by
anyone with the project ID**. They contain names, email addresses,
phone numbers, and now payment preferences.

The rules aren't in the website repo, so this couldn't be verified from
our side. **Please check them before we drive traffic to the new form.**

To be clear about scope: if this exposure exists, it already applies to
`trainerApplications`, `careersApplications`, and
`gymPartnerApplications`. The affiliate work adds one more collection to
it rather than creating the problem.

### Rules needed

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Applications: anyone may submit, nobody may read from a client.
    // Admin + creator reads all go through server routes using the
    // Admin SDK, which bypasses rules entirely.
    match /affiliateApplications/{id} {
      allow create: if true;
      allow read, update, delete: if false;
    }

    // Everything else affiliate-related is server-only.
    match /affiliateCodes/{code}      { allow read, write: if false; }
    match /affiliateClicks/{id}       { allow read, write: if false; }
    match /affiliateReferrals/{id}    { allow read, write: if false; }
    match /affiliateTransactions/{id} { allow read, write: if false; }
    match /affiliatePayouts/{id}      { allow read, write: if false; }

    // Same treatment is worth applying to the existing application
    // collections if they're currently open.
  }
}
```

The creator dashboard never queries Firestore from the browser — it
calls `/api/affiliate/me`, which verifies the Firebase ID token
server-side and scopes every read to that one creator. So locking these
down completely does not break anything.

---

# PART 1 — Firebase setup

## 1.1 Trigger Email extension

The approval flow writes to the `mail` collection to send the welcome
email, same as `/trainer` already does. Please confirm the Trigger Email
extension is installed and healthy, and that
`sales@gymroamapp.com` is receiving notifications.

## 1.2 Firestore indexes

`/api/affiliate/me` queries `affiliateApplications` with two equality
filters (`email` + `status`). Firestore usually serves this without a
composite index, but if it complains the error includes a one-click
link to create it.

## 1.3 Affiliate Auth accounts

When an admin approves an application, the website creates a Firebase
Auth user for the creator and sets custom claims:

```json
{ "role": "affiliate", "affiliateCode": "TAYLOR" }
```

**Two things to know:**

1. These share the Auth pool with app users. Anything that reconciles
   Firebase Auth against the `/users` collection will see them as
   orphans — please skip accounts where `role === "affiliate"`.
2. Creators never sign into the iOS app with these credentials. This
   identity exists only for `/creator` on the web.

If you'd rather these lived in a separate Firebase project or used a
different mechanism, say so and we'll change it — it's a small edit on
our side.

---

# PART 2 — App Store Connect: the discount

**Decide this first; the iOS work depends on it.**

Referred users get **$4 off the annual Pro plan**, at onboarding *and*
at upgrade. Apple has no runtime "apply $4 off" API, so this has to
become a configured price. Three options:

| Option | How | Trade-off |
|---|---|---|
| **A second price point** *(recommended)* | New product e.g. `com.gymroam.pro.annual.referral` at the discounted price; app offers it once a code validates | Simplest to reason about and to reconcile. Discount fixed per storefront |
| **StoreKit 2 promotional offer** | Discount on the existing product; requires server-side signing of the offer | One product, more moving parts. Needed if you want to discount an *existing* subscriber mid-term |
| **Apple offer codes** | Redeemed through the App Store, not our UI | Doesn't fit — we lose control of the code namespace and the in-app entry point |

Recommendation: **the second price point**, unless mid-term upgrades for
existing subscribers matter to you.

**Contract note:** "$4 off" is hard to honor internationally, since
Apple prices are tier-based per storefront. The affiliate agreement
should probably say "a discount" and pin the exact figure to the US
price.

---

# PART 3 — iOS app changes

## 3.1 Code entry — both onboarding AND upgrade

This must work on both paths. Validate before showing any discount:

```
GET https://gymroamapp.com/api/affiliate/validate-code?code=TAYLOR
```

Responses:

```json
200 { "valid": true,  "code": "TAYLOR", "discountUsd": 4 }
200 { "valid": false, "code": "TAYLOR", "reason": "not_found" }
200 { "valid": false, "code": "TAYLOR", "reason": "retired" }
200 { "valid": false, "code": "T",      "reason": "invalid_format" }
503 { "valid": false, "reason": "unavailable" }
```

- Codes are **case-insensitive** — send exactly what the user typed
- Rate limited to 20/min per IP
- **Treat 503 as "try again", never as valid.** The endpoint fails
  closed on purpose: granting an unverifiable discount is a real loss,
  making someone retry is not
- `retired` means the creator renamed their code — old links still
  redirect, but the old code must not mint new attributions

This endpoint is **live and ready to call** (once Part 0.1 is fixed).

## 3.2 On successful validation

Create an `affiliateReferrals` document, and **persist the code on the
user record**. Someone may enter a code at onboarding and subscribe
weeks later — the upgrade path has to still know about it.

## 3.3 On Pro purchase

Set `proConvertedAt` on the referral and store the
`originalTransactionId` from the StoreKit 2 transaction.

**Without `originalTransactionId`, nothing downstream can match a refund
back to its purchase, and no commission can be computed.** It's the
single most important field in the whole pipeline.

Set `proConvertedAt` when the **paid** subscription starts — not when a
free trial starts. It drives tier calculation.

## 3.4 Sign in with Apple

Apple's Hide My Email gives us a relay address we can't match to
anything, so we can't find the account to switch on a creator's free
Pro. This already cost us a manual scramble with the first creator we
onboarded.

The form and both emails now tell creators to use a real email address.
That's a request, not a guarantee. **If the app can capture and store a
real email even under Sign in with Apple, that fixes the problem at the
root** and would be worth doing.

---

# PART 4 — Server notifications → transactions

This is what turns Apple events into commission.

Point an **App Store Server Notifications V2** endpoint at your backend
and map:

| Apple notification | Write as |
|---|---|
| `SUBSCRIBED` (initial buy) | `type: "purchase"` |
| `DID_RENEW` | `type: "renewal"` |
| `REFUND` | `type: "refund"` |
| chargeback / `CONSUMPTION_REQUEST` | `type: "chargeback"` |

Only write a transaction when the `originalTransactionId` matches an
existing referral. Everything else is an organic subscriber and owes no
commission.

## Net revenue — the important part

Commission is calculated on **net** — what actually lands in our account
after Apple's cut, refunds, and taxes — never on gross list price. At a
45% tier, paying on gross would pay out more than we keep.

Apple's notifications carry the customer price, not our proceeds. Real
net comes from the monthly financial reports. Two workable approaches:

- **Preferred:** write the transaction on notification with `netUsd`
  *absent*, then backfill from the financial report each month. The
  engine **skips any transaction without `netUsd`** rather than
  estimating, so nothing gets paid on a guess.
- **Acceptable:** compute `netUsd = gross × (1 − appleRate)` and correct
  later. The `APPLE_COMMISSION_RATE` env var exists for this and
  defaults to `0.15`.

**Please confirm: are we in the App Store Small Business Program (15%)
or standard (30% year one, 15% after)?** Every payout figure moves on
this answer.

---

# PART 5 — Fraud checks

Set `flagged: true` and a `flagReason` on the referral. Flagged
referrals are automatically excluded from the funnel, the tier count,
**and** commission — a flagged signup can't push someone into a higher
tier either.

What to check:

- **Self-referral** — referred user's email matches the affiliate's
- **Velocity** — unusual bursts against one code (e.g. 50 signups in an
  hour)
- **Refund after clearing** — handled automatically as a clawback; no
  action needed

**One correction to the original plan:** device and payment-method
matching aren't possible. Apple exposes neither to us. Realistically we
get email, IP, and velocity. Worth knowing before anything about device
matching goes into a signed agreement.

---

# PART 6 — Reference

## 6.1 Collections the WEBSITE writes (read-only for you)

**`affiliateCodes/{CODE}`** — doc id IS the uppercased code. This is the
uniqueness lock. Never write here from the app.

```
code            string    "TAYLOR"
applicationId   string
affiliateEmail  string
affiliateName   string
active          boolean   false once retired after a rename
issuedBy        string    admin email
issuedAt        timestamp
retiredAt       timestamp?
replacedBy      string?
```

**`affiliateApplications/{autoId}`** — application + decision. Fields
relevant to you: `email`, `issuedCode`, `status`.

**`affiliateClicks/{autoId}`** — one per tracking-link hit.
`code, referrer, userAgent, country, active, createdAt`

**`affiliatePayouts/{autoId}`** — written by hand when money is sent.
`code, amountUsd, method, reference, paidAt`

## 6.2 Collections YOU write

**`affiliateReferrals/{autoId}`** — one per referred person.

```
code                     string      REQUIRED, uppercase, matches affiliateCodes
userId                   string      GymRoam user id
originalTransactionId    string      REQUIRED for commission
installedAt              timestamp?
signedUpAt               timestamp?
proConvertedAt           timestamp?  paid conversion, NOT trial start
flagged                  boolean?
flagReason               string?
```

**`affiliateTransactions/{autoId}`** — one per Apple money event.

```
code                     string      REQUIRED
originalTransactionId    string      REQUIRED — joins refunds to purchases
type                     "purchase" | "renewal" | "refund" | "chargeback"
grossUsd                 number      informational
netUsd                   number      THE COMMISSION BASIS — omit until real
currency                 string
occurredAt               timestamp
```

## 6.3 Website endpoints

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /api/affiliate/validate-code` | none | **iOS calls this** to check a code |
| `GET /api/affiliate/check-code` | none | Application form availability (inverse of above) |
| `GET /api/affiliate/me` | Firebase ID token | Creator's own dashboard data |
| `GET /r/{CODE}` | none | Tracking link → logs click → App Store |
| `POST /api/admin/affiliates` | admin token | Approve / reject / reissue code |
| `GET /api/admin/affiliate-stats` | admin token | All creators + payout export |

`check-code` and `validate-code` are **inverses** — don't mix them up:

- `check-code` → `available: true` means **nobody** owns it
- `validate-code` → `valid: true` means **somebody** owns it and it's active

---

# PART 7 — Rules already implemented (don't rebuild these)

All of this lives in `src/lib/affiliate-stats.ts` on the website and is
unit-tested. Just feed it correct data.

- Tiers on a rolling 12-month window: 1–9 → 35%, 10–49 → 40%, 50+ → 45%
- Commission on **net**, never gross
- Recurring on renewals, not one-time
- Tier increases apply **forward only** — each transaction is rated at
  the tier in force when it happened, never retroactively re-rated
- 30 consecutive days active before commission clears
- Refund inside the clearing window → never accrues
- Refund after clearing → clawback
- $25 minimum payout, rolls forward
- Payouts monthly, within 30 days of month close

---

# PART 8 — Still manual (by design, for now)

- **Affiliate agreement for signature** — no DocuSign integration; the
  welcome email tells creators to expect it separately
- **Granting a creator's own free Pro** — can't be automated until they
  have an app account; the welcome email asks them to send us the email
  they signed up with
- **Payouts** — `affiliatePayouts` docs are created by hand after money
  is sent. The admin Performance tab exports a CSV of everyone over the
  $25 minimum

---

# PART 9 — Suggested order

1. **Rotate the Firebase service-account key** (0.1) — unblocks
   everything, including the currently-failing daily cron
2. **Lock down Firestore rules** (0.2) — quick, closes a possible hole
3. **Decide the discount mechanism** (Part 2) — gates all iOS work
4. Code entry + validation in-app, both paths (Part 3)
5. Server notifications → `affiliateTransactions` (Part 4)
6. Net revenue backfill + confirm the Apple rate (Part 4)
7. Fraud flags (Part 5)

Steps 1–4 make the program usable. Steps 5–6 make it payable.

---

# PART 10 — Questions we need answered

1. **Small Business Program — 15% or 30%?** Changes every payout figure.
2. **Real annual Pro list price?** Docs currently assume a placeholder.
3. **Can the app capture a real email under Sign in with Apple?**
4. **Was the old Firebase key revoked deliberately?**
5. **Any objection to affiliate accounts sharing the Firebase Auth pool?**
