"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import SearchMap from "@/components/SearchMap";
import {
  SEARCH_GYMS,
  ACTIVITY_TYPES,
  MIAMI_CENTER,
  distanceMiles,
  SearchGym,
} from "@/lib/searchData";
import styles from "./page.module.css";

type MobileTab = "list" | "map";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedGym, setSelectedGym] = useState<SearchGym | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("list");
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Filter + sort gyms by query, type, and distance from center.
  const visibleGyms = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SEARCH_GYMS.filter((g) => {
      if (activeFilter && g.type !== activeFilter) return false;
      if (q) {
        const haystack = `${g.name} ${g.area} ${g.type}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
      .map((g) => ({
        ...g,
        distance: distanceMiles(MIAMI_CENTER, [g.lat, g.lng]),
      }))
      .sort((a, b) => a.distance - b.distance);
  }, [query, activeFilter]);

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
    SEARCH_GYMS.forEach((g) => {
      c[g.type] = (c[g.type] || 0) + 1;
    });
    return c;
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (selectedGym) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedGym]);

  return (
    <>
      <Nav />
      <main className={styles.page}>
        {/* Search header */}
        <div className={styles.searchHeader}>
          <div className={styles.searchBar}>
            <svg
              className={styles.searchIcon}
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, neighborhood, or activity"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                className={styles.clearBtn}
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <div className={styles.filterRow}>
            <button
              className={`${styles.chip} ${activeFilter === null ? styles.chipActive : ""}`}
              onClick={() => setActiveFilter(null)}
            >
              All
              <span className={styles.chipCount}>{SEARCH_GYMS.length}</span>
            </button>
            {ACTIVITY_TYPES.filter((t) => counts[t]).map((type) => {
              const isActive = activeFilter === type;
              return (
                <button
                  key={type}
                  className={`${styles.chip} ${isActive ? styles.chipActive : ""}`}
                  onClick={() => setActiveFilter(isActive ? null : type)}
                >
                  {type}
                  <span className={styles.chipCount}>{counts[type]}</span>
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
                {visibleGyms.length} {visibleGyms.length === 1 ? "result" : "results"}
              </span>
              <span className={styles.resultArea}>in Miami</span>
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
                        className={styles.cardImage}
                        style={{
                          background: `linear-gradient(135deg, ${gradientForType(gym.type)})`,
                        }}
                      >
                        <span className={styles.cardImageLabel}>{gym.type}</span>
                      </div>
                      <div className={styles.cardBody}>
                        <div className={styles.cardTopRow}>
                          <h3 className={styles.cardName}>{gym.name}</h3>
                          <div className={styles.cardRating}>
                            ★ {gym.rating.toFixed(1)}
                            <span className={styles.cardReviews}>({gym.reviewCount})</span>
                          </div>
                        </div>
                        <div className={styles.cardMeta}>
                          {gym.area} &middot; {gym.distance.toFixed(1)} mi
                        </div>
                        <div className={styles.cardDesc}>{gym.description}</div>
                        <div className={styles.cardFooter}>
                          <span className={styles.cardPrice}>
                            {gym.dropInPrice === 0
                              ? "Free"
                              : `$${gym.dropInPrice} drop-in`}
                          </span>
                          <span className={styles.cardCta}>View &rarr;</span>
                        </div>
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
            />
          </div>
        </div>
      </main>

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
              ×
            </button>
            <div
              className={styles.modalImage}
              style={{
                background: `linear-gradient(135deg, ${gradientForType(selectedGym.type)})`,
              }}
            >
              <span className={styles.cardImageLabel}>{selectedGym.type}</span>
            </div>
            <div className={styles.modalBody}>
              <h2 className={styles.modalName}>{selectedGym.name}</h2>
              <div className={styles.modalMeta}>
                <span>★ {selectedGym.rating.toFixed(1)}</span>
                <span>({selectedGym.reviewCount} reviews)</span>
                <span>·</span>
                <span>{selectedGym.area}</span>
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
                <a href="/" className={styles.modalCta}>
                  Get the app to book
                </a>
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

/**
 * Each activity gets its own gradient so cards have visual variety
 * without needing real photos.
 */
function gradientForType(type: string): string {
  const gradients: Record<string, string> = {
    Lifting: "#3a3a48, #1a1a22",
    Pilates: "#4a3a5c, #2a1d3a",
    Yoga: "#3a5c4a, #1d3a2a",
    CrossFit: "#5c3a3a, #3a1d1d",
    HIIT: "#5c4a3a, #3a2d1d",
    Cycling: "#3a4a5c, #1d2d3a",
    "Run Club": "#5c5c3a, #3a3a1d",
    Boxing: "#5c3a4a, #3a1d2d",
    Climbing: "#3a5c5c, #1d3a3a",
  };
  return gradients[type] || "#2a2a32, #18181d";
}
