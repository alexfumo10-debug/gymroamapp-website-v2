/**
 * GET /api/admin/live — live activity for the dashboard's Live tab.
 *
 * Two independent halves, so one failing never blanks the other:
 *
 *  1. `authActivity` — always available. Derived from Firebase Auth token
 *     refreshes (an app session forces a refresh at least hourly), joined
 *     with /users docs for names/handles/home city. This is the "who was
 *     on recently" feed at ~1-hour resolution. NOT second-precise
 *     presence — labeled honestly in the UI.
 *
 *  2. `ga` — Google Analytics 4 realtime (the property behind Firebase
 *     Analytics, which the iOS app has logged to since 1.0.3): active
 *     users in the LAST 30 MINUTES, split by country/city and per-minute.
 *     Aggregate counts only (GA does not expose which user is where —
 *     that's by design, and keeps this privacy-clean: no per-user IP or
 *     location is collected anywhere).
 *
 *     Requires a one-time grant: the Firebase service account
 *     (FIREBASE_ADMIN_CLIENT_EMAIL) added as Viewer on the GA4 property
 *     (analytics.google.com → Admin → Property access management).
 *     Until granted, `ga.configured` is false and the tab shows the
 *     setup card. The token is minted here via a plain RS256 JWT
 *     exchange — no extra Google SDK dependency.
 *
 * Admin-only (Firebase ID token → ADMIN_EMAILS).
 */

import { NextRequest, NextResponse } from "next/server";
import { createSign } from "crypto";
import { requireAdmin } from "@/lib/admin-gate";
import { adminAuth, adminDb, adminCredentials } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The GA4 property behind Firebase project gymroam-ad7dc. Not a secret
// (it's a report address, useless without granted credentials); env
// override for the day it ever changes.
const GA_PROPERTY_ID = process.env.GA4_PROPERTY_ID || "530281774";
const GA_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

/* ────────────────────────────────────────────────────────────
   Google OAuth for the Analytics Data API (service-account JWT
   exchange, RS256 via node crypto — no SDK).
   ──────────────────────────────────────────────────────────── */

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function mintGaAccessToken(): Promise<string> {
  const creds = adminCredentials();
  if (!creds) throw new Error("Firebase admin credentials not configured");
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: creds.clientEmail,
      scope: GA_SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = b64url(signer.sign(creds.privateKey));
  const assertion = `${header}.${claims}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(`token exchange failed: ${JSON.stringify(json).slice(0, 200)}`);
  }
  return json.access_token as string;
}

interface GaRow {
  dimensionValues?: { value?: string }[];
  metricValues?: { value?: string }[];
}

async function gaRealtime(
  token: string,
  body: Record<string, unknown>
): Promise<GaRow[]> {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${GA_PROPERTY_ID}:runRealtimeReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  const json = await res.json();
  if (!res.ok) {
    // 403 = the service account hasn't been granted property access yet —
    // the single expected failure mode. Surface the message for the card.
    throw new Error(json?.error?.message || `GA ${res.status}`);
  }
  return (json.rows || []) as GaRow[];
}

/* ────────────────────────────────────────────────────────────
   Route
   ──────────────────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  // ── Half 1: Auth-refresh activity (always available) ──
  const [listResult, usersSnap] = await Promise.all([
    adminAuth().listUsers(1000),
    adminDb().collection("users").get(),
  ]);

  const docByUid: Record<
    string,
    { displayName?: string; username?: string; homeCity?: string }
  > = {};
  usersSnap.forEach((d) => {
    const data = d.data();
    docByUid[d.id] = {
      displayName: data.displayName,
      username: data.username,
      homeCity: data.homeCity,
    };
  });

  const now = Date.now();
  const HOUR = 3600_000;
  let active1h = 0,
    active24h = 0,
    active7d = 0;

  const feed = listResult.users
    .map((u) => {
      const lastMs = u.metadata.lastRefreshTime
        ? Date.parse(u.metadata.lastRefreshTime)
        : null;
      if (lastMs) {
        const age = now - lastMs;
        if (age < HOUR) active1h++;
        if (age < 24 * HOUR) active24h++;
        if (age < 7 * 24 * HOUR) active7d++;
      }
      const doc = docByUid[u.uid] || {};
      return {
        uid: u.uid,
        name: doc.displayName || u.displayName || u.email || u.uid,
        username: doc.username || null,
        homeCity: doc.homeCity || null,
        email: u.email || null,
        isRelay: (u.email || "").endsWith("@privaterelay.appleid.com"),
        providers: u.providerData.map((p) => p.providerId),
        lastActiveMs: lastMs,
      };
    })
    .filter((u) => u.lastActiveMs)
    .sort((a, b) => (b.lastActiveMs || 0) - (a.lastActiveMs || 0))
    .slice(0, 30);

  const authActivity = {
    totalAccounts: listResult.users.length,
    active1h,
    active24h,
    active7d,
    feed,
  };

  // ── Half 2: GA4 realtime (needs the one-time property grant) ──
  let ga:
    | {
        configured: true;
        activeNow: number;
        byLocation: { country: string; city: string; users: number }[];
        perMinute: { minutesAgo: number; users: number }[];
      }
    | { configured: false; hint: string };

  try {
    const token = await mintGaAccessToken();
    const [totalRows, geoRows, minuteRows] = await Promise.all([
      gaRealtime(token, { metrics: [{ name: "activeUsers" }] }),
      gaRealtime(token, {
        dimensions: [{ name: "country" }, { name: "city" }],
        metrics: [{ name: "activeUsers" }],
        limit: 50,
      }),
      gaRealtime(token, {
        dimensions: [{ name: "minutesAgo" }],
        metrics: [{ name: "activeUsers" }],
      }),
    ]);

    ga = {
      configured: true,
      activeNow: Number(totalRows[0]?.metricValues?.[0]?.value || 0),
      byLocation: geoRows
        .map((r) => ({
          country: r.dimensionValues?.[0]?.value || "Unknown",
          city: r.dimensionValues?.[1]?.value || "",
          users: Number(r.metricValues?.[0]?.value || 0),
        }))
        .sort((a, b) => b.users - a.users),
      perMinute: minuteRows
        .map((r) => ({
          minutesAgo: Number(r.dimensionValues?.[0]?.value || 0),
          users: Number(r.metricValues?.[0]?.value || 0),
        }))
        .sort((a, b) => b.minutesAgo - a.minutesAgo),
    };
  } catch (e) {
    ga = { configured: false, hint: (e as Error).message };
  }

  return NextResponse.json({ authActivity, ga, asOf: new Date().toISOString() });
}
