/**
 * /join — preserved as a 308 permanent redirect to the App Store.
 *
 * History: this route was previously a standalone pre-launch waitlist
 * landing page with its own email-capture form. Once the iOS app went
 * live on the App Store, the waitlist became obsolete, but the URL
 * was kept alive (instead of 404'd) because it was referenced in
 * past marketing — Instagram bios, ads, share links, etc. — and we
 * didn't want to break those.
 *
 * Server component that calls `permanentRedirect()` from
 * `next/navigation`. The 308 status (vs. 307 from `redirect()`) tells
 * search engines and aggressive HTTP caches to update their indexes
 * to the new target permanently, which is what we want here since
 * the waitlist isn't coming back.
 *
 * The matching /join CSS module (page.module.css) is intentionally
 * left untouched so this file's git history shows a clean diff.
 * It's dead code but harmless — no rule selectors leak out of the
 * module since nothing imports the styles.
 */

import { permanentRedirect } from "next/navigation";
import { APP_STORE_URL } from "@/lib/app-store";

export default function JoinRedirect(): never {
  permanentRedirect(APP_STORE_URL);
}
