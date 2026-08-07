/**
 * GET /r/{code} — an affiliate's tracking link.
 *
 * This is the URL that goes in a creator's bio. It exists so the click
 * is countable: a bare App Store link is unattributable the moment
 * Apple takes over, so we log first and redirect second.
 *
 * Every approved affiliate's welcome email carries this link, so it has
 * to resolve for any issued code. Unknown or retired codes fall back to
 * the homepage rather than erroring — a creator's audience should never
 * hit a 404 because we changed something on our side.
 *
 * SCOPE: this records the CLICK only. Tying a click through to an
 * install and then to a Pro conversion needs the iOS app to report the
 * code it collected at onboarding/upgrade — see the attribution notes
 * in src/lib/affiliate.ts. Click counts alone are a funnel top, not
 * attribution.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { normalizeCode, validateCodeFormat } from "@/lib/affiliate";
import { APP_STORE_URL } from "@/lib/app-store";
import { SITE_ORIGIN } from "@/lib/affiliate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Crude bot filter, mirroring the client tracker's intent in
 *  src/lib/analytics.ts. Link unfurlers (Slack, iMessage, Discord)
 *  fetch every link that gets pasted, and counting those as clicks
 *  would inflate an affiliate's funnel before a human ever taps it. */
const BOT_UA =
  /bot|crawl|spider|scrape|headless|preview|facebookexternalhit|slackbot|twitterbot|discordbot|telegrambot|whatsapp|linkedinbot|applebot|curl|wget|monitor|pingdom|uptimerobot/i;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> }
) {
  const { code: rawCode } = await ctx.params;
  const code = normalizeCode(rawCode);

  // Malformed code — don't even look it up.
  if (validateCodeFormat(code)) {
    return NextResponse.redirect(SITE_ORIGIN, { status: 302 });
  }

  const userAgent = req.headers.get("user-agent") || "";
  const isBot = BOT_UA.test(userAgent);

  const destination = APP_STORE_URL;

  try {
    const db = adminDb();
    const snap = await db.collection("affiliateCodes").doc(code).get();

    if (!snap.exists) {
      // Never issued. Send them to the site rather than the App Store,
      // so a typo'd or fabricated code doesn't look like a live offer.
      return NextResponse.redirect(SITE_ORIGIN, { status: 302 });
    }

    // A retired code (replaced after a rename) still routes to the App
    // Store — the audience shouldn't be punished for our rename — but
    // it stops accruing new clicks against the active code.
    const data = snap.data() as { active?: boolean };

    if (!isBot) {
      await db.collection("affiliateClicks").add({
        code,
        active: data?.active !== false,
        referrer: req.headers.get("referer") || "",
        userAgent: userAgent.slice(0, 300),
        // Country as reported by the edge, when available — useful for
        // sanity-checking "US audience" claims on an application.
        country: req.headers.get("x-vercel-ip-country") || "",
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  } catch (e) {
    // Fail OPEN, deliberately: if Firestore is unreachable we can
    // neither verify the code nor log the click, and the choice is
    // between dropping a real affiliate's traffic and letting an
    // unissued code through to the App Store for the duration of the
    // outage. The second is much cheaper — an unattributed install
    // beats a dead bio link. The click is lost either way.
    console.error("[/r/:code]", e);
  }

  return NextResponse.redirect(destination, { status: 302 });
}
