/**
 * Single source of truth for the GymRoam iOS App Store URL.
 *
 * Imported anywhere on the marketing site that needs a "Download on
 * the App Store" link (Nav CTA, hero badge, /join redirect, future
 * landing pages). Centralizing here means a future App Store ID
 * change is a one-line edit rather than a grep-and-replace across the
 * codebase.
 */

export const APP_STORE_URL =
  "https://apps.apple.com/us/app/gymroam/id6773157406";
