"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  CaretDown,
  MagnifyingGlass,
  MapPin,
  NavigationArrow,
  Star,
  X,
} from "@phosphor-icons/react/dist/ssr";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import SearchMap from "@/components/SearchMap";
import {
  SEARCH_GYMS,
  ACTIVITY_TYPES,
  CATEGORY_COLORS,
  distanceMiles,
  SearchGym,
} from "@/lib/searchData";
import { CITY_PRESETS, CityPreset, findPreset } from "@/lib/cityPresets";
import { geocodeCity } from "@/lib/geocode";
import { generateGymsForCity } from "@/lib/cityGenerator";
import CategoryIcon from "@/components/CategoryIcon";
import styles from "./page.module.css";

type MobileTab = "list" | "map";

interface ActiveCity {
  name: string;
  region: string;
  lat: number;
  lng: number;
  /** Curated Miami uses the full SEARCH_GYMS dataset; others are generated */
  gyms: SearchGym[];
}

const MIAMI_PRESET = CITY_PRESETS[0];

const DEFAULT_CITY: ActiveCity = {
  name: MIAMI_PRESET.name,
  region: MIAMI_PRESET.region,
  lat: MIAMI_PRESET.lat,
  lng: MIAMI_PRESET.lng,
  gyms: SEARCH_GYMS,
};

export default function SearchPage() {
  const [city, setCity] = useState<ActiveCity>(DEFAULT_CITY);
  const [cityModalOpen, setCityModalOpen] = useState(false);
  const [cityInput, setCityInput] = useState("");
  const [cityLoading, setCityLoading] = useState(false);
  const [cityError, setCityError] = useState("");

  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedGym, setSelectedGym] = useState<SearchGym | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("list");
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  /** Switch the active city — re-generate gyms (or use Miami's curated set). */
  const setActiveCity = (
    name: string,
    region: string,
    lat: number,
    lng: number
  ) => {
    const preset = findPreset(name);
    let gyms: SearchGym[];
    if (preset?.id === "miami") {
      gyms = SEARCH_GYMS;
    } else {
      gyms = generateGymsForCity(name, lat, lng, preset?.neighborhoods);
    }
    setCity({ name, region, lat, lng, gyms });
    setQuery("");
    setActiveFilter(null);
    setCityModalOpen(false);
    setCityInput("");
    setCityError("");
  };

  const pickPreset = (preset: CityPreset) => {
    setActiveCity(preset.name, preset.region, preset.lat, preset.lng);
  };

  /**
   * Deep-link support: read ?city=&category= from the URL on mount.
   * Lets the /gyms-near-me/{slug} landing pages send users straight into
   * the live search with their city and (optionally) category
   * pre-selected.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const cityParam = params.get("city");
    const categoryParam = params.get("category");

    if (cityParam) {
      const preset = findPreset(cityParam);
      if (preset) {
        const gyms =
          preset.id === "miami"
            ? SEARCH_GYMS
            : generateGymsForCity(
                preset.name,
                preset.lat,
                preset.lng,
                preset.neighborhoods
              );
        setCity({
          name: preset.name,
          region: preset.region,
          lat: preset.lat,
          lng: preset.lng,
          gyms,
        });
      }
    }
    if (categoryParam && ACTIVITY_TYPES.includes(categoryParam)) {
      setActiveFilter(categoryParam);
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitCustomCity = async () => {
    const q = cityInput.trim();
    if (!q) return;
    // Check presets first
    const preset = CITY_PRESETS.find(
      (c) => c.name.toLowerCase() === q.toLowerCase()
    );
    if (preset) {
      pickPreset(preset);
      return;
    }
    setCityLoading(true);
    setCityError("");
    try {
      const res = await geocodeCity(q);
      if (!res) {
        setCityError("Couldn't find that city. Try a more specific name.");
        return;
      }
      setActiveCity(res.shortName, res.fullName.split(",").slice(0, 3).join(","), res.lat, res.lng);
    } catch {
      setCityError("Lookup failed. Try again in a moment.");
    } finally {
      setCityLoading(false);
    }
  };

  // Filter + sort gyms by query, type, and distance from city center.
  const visibleGyms = useMemo(() => {
    const q = query.trim().toLowerCase();
    const center: [number, number] = [city.lat, city.lng];
    return city.gyms
      .filter((g) => {
        if (activeFilter && g.type !== activeFilter) return false;
        if (q) {
          const haystack = `${g.name} ${g.area} ${g.type}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .map((g) => ({
        ...g,
        distance: distanceMiles(center, [g.lat, g.lng]),
      }))
      .sort((a, b) => a.distance - b.distance);
  }, [query, activeFilter, city]);

  // Scroll to and briefly highlight a card when its pin is clicked.
  const handlePinClick = (id: string) => {
    const card = cardRefs.current.get(id);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      setHoveredId(id);
      setTimeout(() => setHoveredId((h) => (h === id ? null : h)), 1800);
    }
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    city.gyms.forEach((g) => {
      c[g.type] = (c[g.type] || 0) + 1;
    });
    return c;
  }, [city]);

  // Lock body scroll when modal is open
  useEffect(() => {
    const open = !!selectedGym || cityModalOpen;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedGym, cityModalOpen]);

  return (
    <>
      <Nav />
      <main className={styles.page}>
        <h1 className="sr-only">
          Search gyms, studios, and wellness centers in {city.name}
        </h1>
        {/* Sticky search header */}
        <div className={styles.searchHeader}>
          {/* City selector + search bar row */}
          <div className={styles.locationRow}>
            <button
              className={styles.cityButton}
              onClick={() => setCityModalOpen(true)}
            >
              <MapPin size={14} weight="fill" />
              <span className={styles.cityName}>{city.name}</span>
              <CaretDown size={10} weight="bold" />
            </button>

            <div className={styles.searchBar}>
              <MagnifyingGlass className={styles.searchIcon} size={18} weight="regular" />
              <input
                type="text"
                placeholder={`Search gyms in ${city.name}`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  className={styles.clearBtn}
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                >
                  <X size={14} weight="bold" />
                </button>
              )}
            </div>
          </div>

          <div className={styles.filterRow}>
            <button
              className={`${styles.chip} ${activeFilter === null ? styles.chipActive : ""}`}
              onClick={() => setActiveFilter(null)}
            >
              <CategoryIcon category="All" size={14} />
              All
            </button>
            {ACTIVITY_TYPES.filter((t) => counts[t]).map((type) => {
              const isActive = activeFilter === type;
              const color = CATEGORY_COLORS[type];
              return (
                <button
                  key={type}
                  className={`${styles.chip} ${isActive ? styles.chipActive : ""}`}
                  onClick={() => setActiveFilter(isActive ? null : type)}
                  style={isActive ? { background: color, borderColor: color, color: "#0a0a0b" } : undefined}
                >
                  <span
                    className={styles.chipIcon}
                    style={!isActive ? { color } : undefined}
                  >
                    <CategoryIcon category={type} size={14} />
                  </span>
                  {type}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mobile list/map tabs */}
        <div className={styles.mobileTabs}>
          <button
            className={`${styles.mobileTab} ${mobileTab === "list" ? styles.mobileTabActive : ""}`}
            onClick={() => setMobileTab("list")}
          >
            List
          </button>
          <button
            className={`${styles.mobileTab} ${mobileTab === "map" ? styles.mobileTabActive : ""}`}
            onClick={() => setMobileTab("map")}
          >
            Map
          </button>
        </div>

        {/* Split layout */}
        <div className={styles.split}>
          <aside
            className={`${styles.list} ${mobileTab === "list" ? styles.mobileVisible : styles.mobileHidden}`}
          >
            <div className={styles.listHeader}>
              <span className={styles.resultCount}>
                Trending Near You
              </span>
              <span className={styles.resultArea}>
                {visibleGyms.length} {visibleGyms.length === 1 ? "gym" : "gyms"} in {city.name}
              </span>
            </div>

            {visibleGyms.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>—</div>
                <div>No gyms match your search.</div>
                <button
                  className={styles.emptyReset}
                  onClick={() => {
                    setQuery("");
                    setActiveFilter(null);
                  }}
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <div className={styles.cards}>
                {visibleGyms.map((gym) => {
                  const isHover = gym.id === hoveredId;
                  return (
                    <div
                      key={gym.id}
                      ref={(el) => {
                        if (el) cardRefs.current.set(gym.id, el);
                        else cardRefs.current.delete(gym.id);
                      }}
                      className={`${styles.card} ${isHover ? styles.cardHover : ""}`}
                      onMouseEnter={() => setHoveredId(gym.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={() => setSelectedGym(gym)}
                    >
                      <div
                        className={styles.cardThumb}
                        style={{
                          background: `linear-gradient(135deg, ${gradientForType(gym.type)})`,
                        }}
                      >
                        <span
                          className={styles.cardThumbIcon}
                          style={{ color: CATEGORY_COLORS[gym.type] }}
                        >
                          <CategoryIcon category={gym.type} size={26} />
                        </span>
                        {gym.promo && (
                          <span className={styles.promoBadge}>{gym.promo}</span>
                        )}
                      </div>
                      <div className={styles.cardBody}>
                        <div className={styles.cardName}>{gym.name}</div>
                        <div className={styles.cardMetaRow}>
                          <span
                            className={styles.activityPill}
                            style={{
                              color: CATEGORY_COLORS[gym.type],
                              background: `${CATEGORY_COLORS[gym.type]}22`,
                            }}
                          >
                            <CategoryIcon category={gym.type} size={11} />
                            {gym.type}
                          </span>
                          {gym.touristPass && (
                            <span className={styles.touristPill}>
                              Tourist day pass
                            </span>
                          )}
                        </div>
                        <div className={styles.cardSubMeta}>
                          {gym.area} &middot; {gym.distance.toFixed(1)} mi
                        </div>
                      </div>
                      <div className={styles.cardRight}>
                        <div className={styles.cardRating}>
                          <Star className={styles.starIcon} size={12} weight="fill" />
                          {gym.rating.toFixed(1)}
                        </div>
                        <button
                          className={styles.directionsBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(
                              `https://maps.apple.com/?ll=${gym.lat},${gym.lng}&q=${encodeURIComponent(gym.name)}`,
                              "_blank"
                            );
                          }}
                        >
                          <NavigationArrow size={11} weight="fill" />
                          Directions
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>

          <div
            className={`${styles.mapPane} ${mobileTab === "map" ? styles.mobileVisible : styles.mobileHidden}`}
          >
            <SearchMap
              gyms={visibleGyms}
              hoveredId={hoveredId}
              selectedId={selectedGym?.id || null}
              onPinClick={handlePinClick}
              center={[city.lat, city.lng]}
            />
          </div>
        </div>
      </main>

      {/* City picker modal */}
      {cityModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setCityModalOpen(false)}
        >
          <div
            className={styles.cityModal}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={styles.modalClose}
              onClick={() => setCityModalOpen(false)}
              aria-label="Close"
            >
              <X size={18} weight="bold" />
            </button>
            <h3 className={styles.cityModalTitle}>Pick a city</h3>
            <p className={styles.cityModalSub}>
              Type any city or pick one of the popular ones below.
            </p>

            <div className={styles.cityInputRow}>
              <MagnifyingGlass className={styles.searchIcon} size={18} weight="regular" />
              <input
                autoFocus
                type="text"
                placeholder="e.g. Bali, Berlin, Austin"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitCustomCity();
                }}
              />
              <button
                className={styles.cityGoBtn}
                onClick={submitCustomCity}
                disabled={cityLoading || !cityInput.trim()}
              >
                {cityLoading ? "…" : "Go"}
              </button>
            </div>
            {cityError && (
              <div className={styles.cityError}>{cityError}</div>
            )}

            <div className={styles.cityPresetLabel}>Popular</div>
            <div className={styles.cityPresets}>
              {CITY_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className={`${styles.cityPreset} ${city.name === preset.name ? styles.cityPresetActive : ""}`}
                  onClick={() => pickPreset(preset)}
                >
                  <div className={styles.cityPresetName}>{preset.name}</div>
                  <div className={styles.cityPresetRegion}>
                    {preset.region}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selectedGym && (
        <div
          className={styles.modalOverlay}
          onClick={() => setSelectedGym(null)}
        >
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={styles.modalClose}
              onClick={() => setSelectedGym(null)}
              aria-label="Close"
            >
              <X size={18} weight="bold" />
            </button>
            <div
              className={styles.modalImage}
              style={{
                background: `linear-gradient(135deg, ${gradientForType(selectedGym.type)})`,
              }}
            >
              <span
                className={styles.modalImageIcon}
                style={{ color: CATEGORY_COLORS[selectedGym.type] }}
              >
                <CategoryIcon category={selectedGym.type} size={64} />
              </span>
              {selectedGym.promo && (
                <span className={styles.modalPromo}>{selectedGym.promo}</span>
              )}
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalTopRow}>
                <h2 className={styles.modalName}>{selectedGym.name}</h2>
                <div className={styles.modalRating}>
                  <Star className={styles.starIcon} size={14} weight="fill" />
                  {selectedGym.rating.toFixed(1)}
                </div>
              </div>
              <div className={styles.modalPills}>
                <span
                  className={styles.activityPill}
                  style={{
                    color: CATEGORY_COLORS[selectedGym.type],
                    background: `${CATEGORY_COLORS[selectedGym.type]}22`,
                  }}
                >
                  <CategoryIcon category={selectedGym.type} size={11} />
                  {selectedGym.type}
                </span>
                {selectedGym.touristPass && (
                  <span className={styles.touristPill}>Tourist day pass</span>
                )}
                <span className={styles.modalArea}>{selectedGym.area}</span>
              </div>

              <p className={styles.modalDesc}>{selectedGym.description}</p>

              <div className={styles.modalSection}>
                <h4>Amenities</h4>
                <div className={styles.amenityRow}>
                  {selectedGym.amenities.map((a) => (
                    <span key={a} className={styles.amenity}>
                      {a}
                    </span>
                  ))}
                </div>
              </div>

              <div className={styles.modalSection}>
                <h4>Hours</h4>
                <p className={styles.modalHours}>{selectedGym.hours}</p>
              </div>

              <div className={styles.modalFooter}>
                <div>
                  <div className={styles.modalPriceLabel}>Drop-in</div>
                  <div className={styles.modalPrice}>
                    {selectedGym.dropInPrice === 0
                      ? "Free"
                      : `$${selectedGym.dropInPrice}`}
                  </div>
                </div>
                <button
                  className={styles.modalCta}
                  onClick={() =>
                    window.open(
                      `https://maps.apple.com/?ll=${selectedGym.lat},${selectedGym.lng}&q=${encodeURIComponent(selectedGym.name)}`,
                      "_blank"
                    )
                  }
                >
                  <NavigationArrow size={13} weight="fill" />
                  Directions
                </button>
              </div>

              <p className={styles.modalNote}>
                Sample listing for preview. Actual gyms and pricing populate at launch.
              </p>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}

function gradientForType(type: string): string {
  const gradients: Record<string, string> = {
    Lifting: "#3a3a48, #1a1a22",
    Pilates: "#4a3a5c, #2a1d3a",
    Yoga: "#3a5c4a, #1d3a2a",
    Cycling: "#5c4a3a, #3a2d1d",
    "Run Club": "#5c3a3a, #3a1d1d",
    Wellness: "#3a4a5c, #1d2d3a",
    Hyrox: "#5c3a4a, #3a1d2d",
  };
  return gradients[type] || "#2a2a32, #18181d";
}
