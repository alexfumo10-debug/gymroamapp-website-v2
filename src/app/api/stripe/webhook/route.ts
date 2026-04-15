/**
 * Stripe webhook for Gym Partner subscriptions.
 *
 * Handles:
 *   - checkout.session.completed        → mark subscriptionActive=true
 *   - customer.subscription.deleted     → mark subscriptionActive=false
 *   - customer.subscription.updated     → sync status (e.g. past_due)
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY                   (sk_live_... or sk_test_...)
 *   STRIPE_WEBHOOK_SECRET               (whsec_... from dashboard → webhook endpoint)
 *
 * To configure in Stripe Dashboard:
 *   1. Developers → Webhooks → Add endpoint
 *   2. URL: https://gymroamapp.com/api/stripe/webhook
 *   3. Select events: checkout.session.completed,
 *      customer.subscription.deleted, customer.subscription.updated
 *   4. Copy the signing secret → set STRIPE_WEBHOOK_SECRET
 *
 * We match the Stripe customer email to gymPartnerApplications.ownerEmail
 * to figure out which gym this subscription belongs to.
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/firebase-admin";

/* Disable body parsing — Stripe needs raw body for signature verification */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key);
}

async function findGymPartnerByEmail(email: string) {
  const db = adminDb();
  const snap = await db
    .collection("gymPartnerApplications")
    .where("ownerEmail", "==", email.toLowerCase())
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

async function setSubscriptionStatus(
  email: string,
  active: boolean,
  stripeData: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    status?: string;
  } = {}
) {
  const partner = await findGymPartnerByEmail(email.toLowerCase());
  if (!partner) {
    console.warn(`[stripe-webhook] No gym partner found for ${email}`);
    return;
  }

  const db = adminDb();
  const update: Record<string, unknown> = {
    subscriptionActive: active,
    subscriptionUpdatedAt: new Date(),
    ...stripeData,
  };

  /* Update the gymPartners doc (the active listing) */
  await db.collection("gymPartners").doc(partner.id).set(update, { merge: true });

  /* Also update the application doc for admin panel visibility */
  await db
    .collection("gymPartnerApplications")
    .doc(partner.id)
    .set(
      { subscriptionActive: active, subscriptionStatus: stripeData.status },
      { merge: true }
    );

  /* And flag the user doc if we have a partnerUserId */
  const appData = partner as unknown as { partnerUserId?: string };
  if (appData.partnerUserId) {
    await db
      .collection("users")
      .doc(appData.partnerUserId)
      .set({ subscriptionActive: active }, { merge: true });
  }

  console.log(
    `[stripe-webhook] ${email} → subscriptionActive=${active} (app ${partner.id})`
  );
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing signature or webhook secret" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("[stripe-webhook] Signature verification failed:", msg);
    return NextResponse.json(
      { error: `Webhook error: ${msg}` },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const email = session.customer_email || session.customer_details?.email;
        if (!email) {
          console.warn("[stripe-webhook] checkout.session.completed w/o email");
          break;
        }
        await setSubscriptionStatus(email, true, {
          stripeCustomerId: (session.customer as string) || undefined,
          stripeSubscriptionId: (session.subscription as string) || undefined,
          status: "active",
        });
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customer = await getStripe().customers.retrieve(
          sub.customer as string
        );
        if (customer.deleted) break;
        const email = (customer as Stripe.Customer).email;
        if (!email) break;

        /* Active if status is 'active' or 'trialing'; inactive otherwise */
        const active = sub.status === "active" || sub.status === "trialing";
        await setSubscriptionStatus(email, active, {
          stripeCustomerId: sub.customer as string,
          stripeSubscriptionId: sub.id,
          status: sub.status,
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customer = await getStripe().customers.retrieve(
          sub.customer as string
        );
        if (customer.deleted) break;
        const email = (customer as Stripe.Customer).email;
        if (!email) break;

        await setSubscriptionStatus(email, false, {
          stripeCustomerId: sub.customer as string,
          stripeSubscriptionId: sub.id,
          status: "canceled",
        });
        break;
      }

      default:
        /* Ignore other events */
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("[stripe-webhook] Handler error:", msg);
    return NextResponse.json(
      { error: `Handler error: ${msg}` },
      { status: 500 }
    );
  }
}
