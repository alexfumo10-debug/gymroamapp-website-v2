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
