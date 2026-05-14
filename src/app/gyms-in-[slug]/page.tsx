/**
 * City landing pages — programmatic SEO.
 *
 * One static page per CITY_PRESET at /gyms-in-{slug}. Each page is
 * SEO-optimized for "gyms in [city]" search queries with:
 *   - Unique title + meta description
 *   - Crawlable category + neighborhood content
 *   - JSON-LD schemas (WebPage, BreadcrumbList, FAQPage)
 *   - Deep link into the interactive /search?city= flow
 *
 * Server component — fully SSG. Build time discovers all routes via
 * generateStaticParams.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { CITY_PRESETS, type CityPreset } from "@/lib/cityPresets";
import { ACTIVITY_TYPES, CATEGORY_COLORS, CATEGORY_EMOJI } from "@/lib/searchData";
import styles from "./page.module.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return CITY_PRESETS.map((c) => ({ slug: c.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const city = CITY_PRESETS.find((c) => c.id === slug);
  if (!city) return {};

  const cats = "Lifting, Pilates, Yoga, Cycling, Run Clubs, Wellness, and Hyrox";
  const title = `Gyms in ${city.name} — Find ${cats} | GymRoam`;
  const description = `Discover gyms, fitness studios, and wellness centers in ${city.name}. Filter by activity, browse by neighborhood, and find your next session with GymRoam.`;

  return {
    title,
    description,
    alternates: {
      canonical: `https://gymroamapp.com/gyms-in-${city.id}`,
    },
    openGraph: {
      title,
      description,
      url: `https://gymroamapp.com/gyms-in-${city.id}`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  Lifting:
    "Strength gyms with racks, platforms, and free weights. From classic powerlifting setups to modern boutique strength studios.",
  Pilates:
    "Reformer-focused studios, mat classes, and tower work. Boutique pilates from beginner-friendly to advanced.",
  Yoga:
    "Vinyasa, hot yoga, yin, and breathwork. Studio practices and outdoor flows.",
  Cycling:
    "Indoor cycling boutiques with DJ-led rides, intervals, and rhythm classes.",
  "Run Club":
    "Social and competitive running groups. Group runs, track sessions, race prep.",
  Wellness:
    "Recovery and bodywork — cold plunges, infrared saunas, mobility, massage, and contrast therapy.",
  Hyrox:
    "Hyrox-format training gyms with sleds, ergs, sandbags, and race simulations.",
};

const FAQ = (cityName: string) => [
  {
    q: `Does GymRoam cover ${cityName}?`,
    a: `Yes — ${cityName} is covered. You can browse gyms, fitness studios, and wellness centers across the city's neighborhoods, filter by activity type, and find a place to train with one tap.`,
  },
  {
    q: `Is GymRoam free to use?`,
    a: `Yes. Discovering gyms, browsing categories, and saving favorites is free. Some gyms offer drop-in passes; pricing details show on each listing.`,
  },
  {
    q: `How do I find a gym for travelers in ${cityName}?`,
    a: `Open GymRoam, set your city to ${cityName}, and filter for gyms tagged as offering tourist day passes. You'll see drop-in friendly options across the city.`,
  },
  {
    q: `What types of gyms can I find in ${cityName}?`,
    a: `GymRoam indexes seven categories: Lifting, Pilates, Yoga, Cycling, Run Clubs, Wellness, and Hyrox. Use the filter chips to narrow your search by activity.`,
  },
];

function CityIntro({ city }: { city: CityPreset }) {
  const neighborhoods = city.neighborhoods?.slice(0, 4).join(", ") || city.name;
  return (
    <p>
      Whether you&apos;re traveling through {city.name} or training at home,
      GymRoam helps you find the right session. From {neighborhoods}, and
      everywhere in between &mdash; browse by activity, filter by neighborhood,
      and get directions in a tap.
    </p>
  );
}

export default async function CityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const city = CITY_PRESETS.find((c) => c.id === slug);
  if (!city) notFound();

  const faq = FAQ(city.name);

  /* JSON-LD: WebPage + BreadcrumbList + FAQPage */
  const webpageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `Gyms in ${city.name}`,
    description: `Find gyms, fitness studios, and wellness centers in ${city.name} across Lifting, Pilates, Yoga, Cycling, Run Clubs, Wellness, and Hyrox.`,
    url: `https://gymroamapp.com/gyms-in-${city.id}`,
    isPartOf: {
      "@type": "WebSite",
      name: "GymRoam",
      url: "https://gymroamapp.com",
    },
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://gymroamapp.com" },
      { "@type": "ListItem", position: 2, name: "Cities", item: "https://gymroamapp.com/cities" },
      {
        "@type": "ListItem",
        position: 3,
        name: `Gyms in ${city.name}`,
        item: `https://gymroamapp.com/gyms-in-${city.id}`,
      },
    ],
  };
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <Nav />
      <main className={styles.page}>
        {/* Breadcrumb */}
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span>/</span>
          <span>Cities</span>
          <span>/</span>
          <span aria-current="page">Gyms in {city.name}</span>
        </nav>

        {/* Hero */}
        <header className={styles.hero}>
          <div className={styles.eyebrow}>
            <span className={styles.eyebrowDot} />
            {city.region}
          </div>
          <h1>
            Gyms in <span className={styles.accent}>{city.name}</span>
          </h1>
          <CityIntro city={city} />
          <div className={styles.heroCta}>
            <Link href={`/search?city=${city.id}`} className={styles.btnPrimary}>
              Search gyms in {city.name} &rarr;
            </Link>
            <Link href="/search" className={styles.btnGhost}>
              Browse all cities
            </Link>
          </div>
        </header>

        {/* Categories */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>Categories in {city.name}</h2>
            <p>
              GymRoam indexes seven activity types across {city.name}. Tap
              any category to jump into the live search.
            </p>
          </div>
          <div className={styles.catGrid}>
            {ACTIVITY_TYPES.map((cat) => (
              <Link
                key={cat}
                href={`/search?city=${city.id}&category=${encodeURIComponent(cat)}`}
                className={styles.catCard}
              >
                <div
                  className={styles.catIcon}
                  style={{ color: CATEGORY_COLORS[cat] }}
                >
                  {CATEGORY_EMOJI[cat]}
                </div>
                <div className={styles.catName}>{cat}</div>
                <div className={styles.catDesc}>
                  {CATEGORY_DESCRIPTIONS[cat]}
                </div>
                <div className={styles.catCta}>
                  Browse {cat.toLowerCase()} in {city.name} &rarr;
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Neighborhoods (when we have them) */}
        {city.neighborhoods && city.neighborhoods.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2>Neighborhoods in {city.name}</h2>
              <p>
                Train in any pocket of {city.name}. Coverage spans these
                neighborhoods and the spots in between:
              </p>
            </div>
            <div className={styles.hoodGrid}>
              {city.neighborhoods.map((hood) => (
                <div key={hood} className={styles.hoodChip}>
                  {hood}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* How it works */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>How to find a gym in {city.name}</h2>
            <p>Three taps to a session.</p>
          </div>
          <div className={styles.steps}>
            <div className={styles.step}>
              <div className={styles.stepNum}>01</div>
              <h3>Open GymRoam</h3>
              <p>
                Set your city to {city.name}. The map and list populate
                instantly with gyms across every neighborhood.
              </p>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNum}>02</div>
              <h3>Filter by activity</h3>
              <p>
                Pick your modality &mdash; Lifting, Pilates, Yoga, Cycling,
                Run Club, Wellness, or Hyrox. The results narrow to gyms
                that match.
              </p>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNum}>03</div>
              <h3>Get directions</h3>
              <p>
                Tap a listing for hours, drop-in pricing, and one-tap
                directions in Apple Maps.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>FAQ &mdash; Gyms in {city.name}</h2>
          </div>
          <dl className={styles.faq}>
            {faq.map((f) => (
              <div key={f.q} className={styles.faqRow}>
                <dt>{f.q}</dt>
                <dd>{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Closer CTA */}
        <section className={styles.closer}>
          <h2>
            Ready to find your next session in{" "}
            <span className={styles.accent}>{city.name}</span>?
          </h2>
          <Link href={`/search?city=${city.id}`} className={styles.btnPrimary}>
            Search gyms in {city.name} &rarr;
          </Link>
        </section>

        {/* Other cities */}
        <section className={styles.otherCities}>
          <div className={styles.sectionHead}>
            <h3>Or explore another city</h3>
          </div>
          <div className={styles.cityLinks}>
            {CITY_PRESETS.filter((c) => c.id !== city.id).map((c) => (
              <Link key={c.id} href={`/gyms-in-${c.id}`} className={styles.cityLink}>
                Gyms in {c.name} &rarr;
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webpageJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </>
  );
}
