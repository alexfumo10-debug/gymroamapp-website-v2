/**
 * Website traffic tracking — writes each page view to the `pageViews`
 * Firestore collection. Deduped per session per path so refreshing or
 * bouncing between pages doesn't inflate numbers.
 *
 * Data model:
 *   pageViews/{autoId}: {
 *     path: string,         // e.g. "/grow", "/trainer", "/"
 *     sessionId: string,    // random ID from sessionStorage
 *     referrer: string,     // document.referrer (may be empty)
 *     createdAt: Timestamp
 *   }
 *
 * Cost: ~1 Firestore write per unique page visit per session. Well
 * within Firestore's 20k writes/day free tier for pre-launch traffic.
 */

import { db } from "./firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

const SESSION_KEY = "gr_session_id";
const TRACKED_KEY_PREFIX = "gr_tracked_";

// Patterns that identify non-human traffic. Covers the major search
// crawlers, headless browsers, link-preview unfurlers (Slack/FB/Twitter/
// Discord), uptime monitors, and generic scrapers.
const BOT_UA_REGEX = new RegExp(
  [
    "bot", "crawl", "spider", "scrape",
    "headless", "puppeteer", "playwright", "selenium", "phantom",
    "lighthouse", "pagespeed", "gtmetrix", "pingdom", "uptimerobot",
    "facebookexternalhit", "slackbot", "twitterbot", "discordbot",
    "telegrambot", "whatsapp", "linkedinbot",
    "google-inspection", "googleother", "adsbot", "mediapartners",
    "bingpreview", "yandex", "duckduckbot", "baiduspider",
    "archive\\.org_bot", "semrushbot", "ahrefsbot", "mj12bot", "dotbot",
    "applebot", "petalbot", "curl", "wget",
  ].join("|"),
  "i"
);

function isBot(): boolean {
  if (typeof navigator === "undefined") return true;
  // Browsers controlled by automation tools (Selenium, Puppeteer, etc.)
  // set navigator.webdriver = true.
  if ((navigator as Navigator & { webdriver?: boolean }).webdriver) return true;
  const ua = navigator.userAgent || "";
  if (!ua) return true;
  return BOT_UA_REGEX.test(ua);
}

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export async function trackPageView(path: string): Promise<void> {
  if (typeof window === "undefined") return;

  // Skip admin panel traffic so we don't pollute our own numbers
  if (path.startsWith("/gr-panel-")) return;

  // Skip bots, crawlers, and automated browsers
  if (isBot()) return;

  // Dedupe: one view per path per session
  const trackedKey = TRACKED_KEY_PREFIX + path;
  if (sessionStorage.getItem(trackedKey)) return;
  sessionStorage.setItem(trackedKey, "1");

  try {
    await addDoc(collection(db, "pageViews"), {
      path,
      sessionId: getSessionId(),
      referrer: document.referrer || "",
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    // Silent fail — analytics shouldn't break the site
    console.debug("pageView track error:", e);
  }
}
