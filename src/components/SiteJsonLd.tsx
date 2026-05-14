/**
 * Site-wide JSON-LD structured data. Renders into <head> via the
 * <script type="application/ld+json"> pattern Next.js supports in
 * the App Router.
 *
 * Two schemas, both eligible for rich results in Google search:
 *   - Organization: who we are
 *   - MobileApplication: lets Google show an "app card" with the
 *     icon, store badge, ratings (once available) for searches like
 *     "GymRoam app"
 */

const ORG = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "GymRoam",
  url: "https://gymroamapp.com",
  logo: "https://gymroamapp.com/gymroam-logo.png",
  sameAs: ["https://instagram.com/gymroamapp"],
};

const APP = {
  "@context": "https://schema.org",
  "@type": "MobileApplication",
  name: "GymRoam",
  operatingSystem: "iOS",
  applicationCategory: "HealthApplication",
  description:
    "GymRoam helps you find gyms, fitness studios, and wellness centers wherever you travel. Search any city, filter by activity, and get directions.",
  url: "https://gymroamapp.com",
  image: "https://gymroamapp.com/gymroam-logo.png",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function SiteJsonLd() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(APP) }}
      />
    </>
  );
}
