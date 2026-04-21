"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackPageView } from "@/lib/analytics";

/**
 * Mounted once in the root layout. Fires trackPageView whenever the
 * Next.js route changes. Tracks initial load and client-side navigations.
 */
export default function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) {
      trackPageView(pathname);
    }
  }, [pathname]);

  return null;
}
