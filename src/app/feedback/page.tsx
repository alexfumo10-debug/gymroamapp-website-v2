"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Toast from "@/components/Toast";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  increment,
  serverTimestamp,
  query,
  orderBy,
  doc,
} from "firebase/firestore";
import styles from "./page.module.css";

interface Feature {
  id: string;
  title: string;
  description?: string;
  category?: string;
  submittedBy?: string;
  votes: number;
  status: string;
  createdAt?: { seconds: number };
}

type FilterValue = "all" | "under review" | "planned" | "in progress" | "shipped";
type SortValue = "votes" | "newest";

const STATUS_MAP: Record<string, { className: string; label: string }> = {
  "under review": { className: "statusReview", label: "Under Review" },
  planned: { className: "statusPlanned", label: "Planned" },
  "in progress": { className: "statusProgress", label: "In Progress" },
  shipped: { className: "statusShipped", label: "Shipped" },
};

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "under review", label: "Under Review" },
  { value: "planned", label: "Planned" },
  { value: "in progress", label: "In Progress" },
  { value: "shipped", label: "Shipped" },
];

export default function FeedbackPage() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [currentFilter, setCurrentFilter] = useState<FilterValue>("all");
  const [currentSort, setCurrentSort] = useState<SortValue>("votes");
  const [votedIds, setVotedIds] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Feature");
  const [name, setName] = useState("");

  // Toast
  const [toastMsg, setToastMsg] = useState("");
  const [toastShow, setToastShow] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastShow(true);
  }, []);

  const hideToast = useCallback(() => {
    setToastShow(false);
  }, []);

  // Load voted IDs from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("gymroam_votes");
      if (stored) setVotedIds(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, []);

  // Load features from Firestore
  const loadFeatures = useCallback(async () => {
    try {
      setLoadError(false);
      const feedbackRef = collection(db, "feedback");
      const snap = await getDocs(query(feedbackRef, orderBy("createdAt", "desc")));
      const loaded: Feature[] = [];
      snap.forEach((d) => {
        loaded.push({ id: d.id, ...(d.data() as Omit<Feature, "id">) });
      });
      setFeatures(loaded);
    } catch (e) {
      console.error("Load error:", e);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    loadFeatures();
  }, [loadFeatures]);

  // Filter and sort
  const getFiltered = () => {
    let filtered =
      currentFilter === "all"
        ? [...features]
        : features.filter((f) => f.status === currentFilter);

    if (currentSort === "votes") {
      filtered.sort((a, b) => (b.votes || 0) - (a.votes || 0));
    } else {
      filtered.sort((a, b) => {
        const da = a.createdAt?.seconds || 0;
        const db2 = b.createdAt?.seconds || 0;
        return db2 - da;
      });
    }

    return filtered;
  };

  const filtered = getFiltered();

  // Vote handler
  const handleVote = async (id: string, alreadyVoted: boolean) => {
    if (alreadyVoted) return;
    try {
      await updateDoc(doc(db, "feedback", id), { votes: increment(1) });
      const newVotedIds = [...votedIds, id];
      setVotedIds(newVotedIds);
      localStorage.setItem("gymroam_votes", JSON.stringify(newVotedIds));
      setFeatures((prev) =>
        prev.map((f) => (f.id === id ? { ...f, votes: (f.votes || 0) + 1 } : f))
      );
      showToast("Vote counted");
    } catch (e) {
      console.error("Vote error:", e);
      showToast("Could not vote. Try again.");
    }
  };

  // Submit handler
  const handleSubmit = async () => {
    if (!title.trim()) {
      showToast("Add a title");
      return;
    }

    setSubmitting(true);

    try {
      const feedbackRef = collection(db, "feedback");
      await addDoc(feedbackRef, {
        title: title.trim(),
        description: description.trim(),
        category,
        submittedBy: name.trim() || "Anonymous",
        votes: 1,
        status: "under review",
        createdAt: serverTimestamp(),
      });

      setTitle("");
      setDescription("");
      setCategory("Feature");
      setName("");
      setFormOpen(false);
      showToast("Feature submitted");
      await loadFeatures();
    } catch (e) {
      console.error("Submit error:", e);
      showToast("Could not submit. Try again.");
    }

    setSubmitting(false);
  };

  const formatDate = (createdAt?: { seconds: number }) => {
    if (!createdAt) return "";
    return new Date(createdAt.seconds * 1000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <>
      <Nav />

      <div className={styles.header}>
        <h1>Feedback Board</h1>
        <p>
          Vote on features you want, or suggest something new. We build what matters
          to you.
        </p>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            className={`${styles.filterBtn} ${
              currentFilter === f.value ? styles.filterBtnActive : ""
            }`}
            onClick={() => setCurrentFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Submit Area */}
      <div className={styles.submitArea}>
        {!formOpen && (
          <button className={styles.submitToggle} onClick={() => setFormOpen(true)}>
            + Suggest a feature...
          </button>
        )}
        {formOpen && (
          <div className={styles.submitForm}>
            <label className={styles.label}>Feature Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Add gym check-ins"
              maxLength={100}
            />

            <label className={styles.label}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the feature and why it would be useful..."
              maxLength={500}
            />

            <div className={styles.formRow}>
              <div>
                <label className={styles.label}>Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="Feature">Feature</option>
                  <option value="Improvement">Improvement</option>
                  <option value="Bug Fix">Bug Fix</option>
                  <option value="Design">Design</option>
                </select>
              </div>
              <div>
                <label className={styles.label}>Your Name (optional)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Anonymous"
                  maxLength={50}
                  className={styles.noMarginBottom}
                />
              </div>
            </div>

            <div className={styles.formActions}>
              <button
                className={styles.submitBtn}
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Submit"}
              </button>
              <button
                className={styles.cancelBtn}
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sort Bar */}
      <div className={styles.sortBar}>
        <span className={styles.count}>
          {filtered.length} feature{filtered.length !== 1 ? "s" : ""}
        </span>
        <div className={styles.sortBtns}>
          <button
            className={`${styles.sortBtn} ${
              currentSort === "votes" ? styles.sortBtnActive : ""
            }`}
            onClick={() => setCurrentSort("votes")}
          >
            Top
          </button>
          <button
            className={`${styles.sortBtn} ${
              currentSort === "newest" ? styles.sortBtnActive : ""
            }`}
            onClick={() => setCurrentSort("newest")}
          >
            New
          </button>
        </div>
      </div>

      {/* Features List */}
      <div className={styles.featuresList}>
        {loadError ? (
          <div className={styles.emptyState}>
            Unable to load feedback. Please try again later.
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.emptyState}>
            No features here yet. Be the first to suggest one.
          </div>
        ) : (
          filtered.map((f) => {
            const voted = votedIds.includes(f.id);
            const statusInfo = STATUS_MAP[f.status] || STATUS_MAP["under review"];
            const date = formatDate(f.createdAt);

            return (
              <div key={f.id} className={styles.featureCard}>
                <button
                  className={`${styles.voteBtn} ${voted ? styles.voted : ""}`}
                  onClick={() => handleVote(f.id, voted)}
                  title={voted ? "You voted" : "Upvote"}
                >
                  <span className={styles.voteArrow}>&#9650;</span>
                  <span className={styles.voteCount}>{f.votes || 0}</span>
                </button>
                <div className={styles.featureContent}>
                  <div className={styles.featureTitle}>{f.title}</div>
                  {f.description && (
                    <div className={styles.featureDesc}>{f.description}</div>
                  )}
                  <div className={styles.featureMeta}>
                    <span
                      className={`${styles.status} ${
                        styles[statusInfo.className as keyof typeof styles] || ""
                      }`}
                    >
                      <span className={styles.statusDot} />
                      {statusInfo.label}
                    </span>
                    <span className={styles.categoryTag}>
                      {f.category || "Feature"}
                    </span>
                    {date && <span className={styles.categoryTag}>{date}</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Footer />

      <Toast message={toastMsg} show={toastShow} onHide={hideToast} />
    </>
  );
}
