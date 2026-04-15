/**
 * Trainer Pro subscription config.
 *
 * Billing is handled via Apple In-App Purchase (StoreKit 2), NOT a web
 * checkout. Rationale: trainers feel safer subscribing through Apple
 * (no credit card entry on a site they've never seen), Apple handles
 * refunds/failed payments, and Face ID is one tap.
 *
 * Flow:
 *   1. Trainer applies on the website → we verify Instagram
 *   2. Admin approves → passcode emailed to trainer
 *   3. Trainer downloads GymRoam, signs in with passcode
 *   4. Trainer profile unlocks AFTER they subscribe via Apple IAP
 *
 * iOS side (SwiftUI app) needs a StoreKit 2 product:
 *   - Product ID: `com.gymroam.trainerpro.monthly`
 *   - Type: Auto-renewable subscription
 *   - Price: $24.99/month
 *   - Set up in App Store Connect → In-App Purchases
 */

export const TRAINER_PRO_PRICE = "$24.99/month";

/** Gym partners billed via Stripe, not Apple IAP (B2B, avoids 15-30% cut) */
export const GYM_PARTNER_PRICE = "$99/month";

/**
 * Stripe Payment Link for the Gym Partner subscription.
 *
 * Setup:
 *   1. https://dashboard.stripe.com/payment-links → New link
 *   2. Create a recurring price: $99 USD / month (auto-renew)
 *   3. Enable "Collect customer email" (so we can match to gymPartnerApplications)
 *   4. Enable Webhook at /api/stripe/webhook for: checkout.session.completed,
 *      customer.subscription.deleted, customer.subscription.updated
 *   5. Paste the link URL into NEXT_PUBLIC_STRIPE_GYM_PARTNER_LINK in Vercel
 *
 * When a gym owner subscribes, the webhook flips their gymPartners doc
 * `subscriptionActive: true`. Their listing activates automatically.
 */
export const GYM_PARTNER_PAYMENT_LINK =
  process.env.NEXT_PUBLIC_STRIPE_GYM_PARTNER_LINK ||
  "https://buy.stripe.com/REPLACE_ME";

/** Minimum Instagram followers to qualify as a verified trainer */
export const MIN_INSTAGRAM_FOLLOWERS = 1000;
