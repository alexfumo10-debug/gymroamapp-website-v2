/**
 * Open Graph preview image for the root route. Generated at build time
 * via Next's ImageResponse — Next automatically uses this when /og or
 * the home page is shared on social platforms, replacing the prior
 * static /og-image.png reference in layout.tsx.
 *
 * Visual goal: feel like the hero section without the waitlist UI.
 *   - Dark brand surface
 *   - "Coming Soon to iOS" badge
 *   - "Find Your Sweat. Anywhere." headline (with brand-yellow accent)
 *   - Tagline below
 *   - Phone screenshot (Discover screen) on the right
 *   - GYMROAM wordmark in the corner
 *
 * Uses the nodejs runtime so we can read the phone screenshot from
 * /public at build time and embed it as base64. Inter font binaries
 * are fetched once at build from Google Fonts.
 */

import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";
export const alt = "GymRoam — Find Your Sweat. Anywhere.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Read a local Inter OTF file from src/app/fonts/. We ship the binaries
 * with the repo because Satori (the engine behind next/og) needs
 * TTF/OTF — modern CDNs and Google Fonts default to woff2 ("Unsupported
 * OpenType signature wOF2"), and getting them to serve TTF is brittle.
 * Files are from the official rsms/inter repo, v3.19.
 */
async function loadInter(filename: string): Promise<ArrayBuffer> {
  const data = await readFile(join(process.cwd(), "src/app/fonts", filename));
  // Slice to a fresh ArrayBuffer view so Buffer's pooled allocator
  // doesn't accidentally hand Satori a longer buffer than the file.
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
}

export default async function Image() {
  // Load assets in parallel: Inter at 3 weights + the phone screenshot.
  const [interRegular, interBold, interBlack, phoneBuffer] = await Promise.all([
    loadInter("Inter-Regular.ttf"),
    loadInter("Inter-Bold.ttf"),
    loadInter("Inter-Black.ttf"),
    readFile(join(process.cwd(), "public/app-screens/discover.png")),
  ]);

  const phoneSrc = `data:image/png;base64,${phoneBuffer.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#0A0A0B",
          position: "relative",
          fontFamily: "Inter",
          color: "#E8E8EE",
          overflow: "hidden",
        }}
      >
        {/* Soft brand-yellow radial glow in the lower-left, echoes the
            hero's accent halo without trying to redraw the topo pattern. */}
        <div
          style={{
            position: "absolute",
            left: -200,
            bottom: -200,
            width: 800,
            height: 800,
            background:
              "radial-gradient(circle, rgba(232,255,60,0.18) 0%, rgba(232,255,60,0.06) 35%, rgba(232,255,60,0) 70%)",
            display: "flex",
          }}
        />

        {/* Left column — badge, headline, tagline, wordmark */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "72px 0 72px 80px",
            width: 720,
            height: "100%",
          }}
        >
          {/* Coming Soon badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              alignSelf: "flex-start",
              background: "#0A0A0B",
              border: "1px solid rgba(232, 255, 60, 0.55)",
              borderRadius: 100,
              padding: "10px 22px",
              color: "#E8FF3C",
              fontSize: 18,
              fontWeight: 700,
              boxShadow:
                "0 0 14px rgba(232, 255, 60, 0.38), 0 0 32px rgba(232, 255, 60, 0.18)",
            }}
          >
            <div
              style={{
                width: 9,
                height: 9,
                borderRadius: 5,
                background: "#E8FF3C",
                display: "flex",
              }}
            />
            Coming Soon to iOS
          </div>

          {/* Headline + tagline */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontSize: 96,
                fontWeight: 900,
                letterSpacing: -4,
                lineHeight: 1.04,
                color: "#FFFFFF",
              }}
            >
              <span style={{ display: "flex" }}>Find Your Sweat.</span>
              <span
                style={{
                  display: "flex",
                  color: "#E8FF3C",
                  textShadow:
                    "0 0 28px rgba(232, 255, 60, 0.45), 0 0 56px rgba(232, 255, 60, 0.20)",
                }}
              >
                Anywhere.
              </span>
            </div>
            <div
              style={{
                marginTop: 28,
                fontSize: 24,
                color: "#8A8A99",
                fontWeight: 500,
                display: "flex",
              }}
            >
              Search any city. Get directions. Never miss a workout.
            </div>
          </div>

          {/* Wordmark */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                background: "#E8FF3C",
                borderRadius: 9,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0A0A0B",
                fontWeight: 900,
                fontSize: 22,
                fontFamily: "Inter",
              }}
            >
              G
            </div>
            <span
              style={{
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: 4,
                color: "#E8E8EE",
              }}
            >
              GYMROAM
            </span>
          </div>
        </div>

        {/* Right column — phone screenshot, slightly tilted for depth.
            Sized so the top portion of the screen fills the right half
            of the OG image with a clean phone frame. */}
        <div
          style={{
            position: "relative",
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 280,
              height: 600,
              background: "#0A0A0B",
              border: "3px solid #1F1F26",
              borderRadius: 42,
              overflow: "hidden",
              boxShadow: "0 40px 80px rgba(0, 0, 0, 0.6)",
              transform: "rotate(-4deg)",
              display: "flex",
            }}
          >
            <img
              src={phoneSrc}
              alt="GymRoam app — Discover screen"
              width={280}
              height={600}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "top",
              }}
            />
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Inter", data: interRegular, weight: 400 },
        { name: "Inter", data: interBold, weight: 700 },
        { name: "Inter", data: interBlack, weight: 900 },
      ],
    }
  );
}
