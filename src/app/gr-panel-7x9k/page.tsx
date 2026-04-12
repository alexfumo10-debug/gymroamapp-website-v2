"use client";

import { useState, useEffect, useCallback } from "react";
import { db, auth } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  setDoc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import Toast from "@/components/Toast";
import styles from "./page.module.css";

const ADMIN_EMAIL = "gymroamapp@gmail.com";

interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
}

interface Application {
  id: string;
  status: "pending" | "approved" | "rejected";
  gymName: string;
  ownerName: string;
  ownerRole: string;
  ownerEmail: string;
  ownerPhone: string;
  gymType: string;
  gymAddress: string;
  gymCity: string;
  gymState: string;
  gymWebsite?: string;
  gymInstagram?: string;
  gymPhone?: string;
  dayPass?: string;
  verifyMethod?: string;
  notes?: string;
  createdAt?: FirestoreTimestamp;
}

interface WaitlistEntry {
  id: string;
  email: string;
  source?: string;
  type?: string;
  createdAt?: FirestoreTimestamp;
}

function generatePasscode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function formatDate(
  ts: FirestoreTimestamp | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!ts) return "";
  return new Date(ts.seconds * 1000).toLocaleDateString("en-US", options);
}

export default function AdminPanel() {
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Data state
  const [applications, setApplications] = useState<Application[]>([]);
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  const [feedbackCount, setFeedbackCount] = useState<number | null>(null);
  const [currentTab, setCurrentTab] = useState<
    "pending" | "approved" | "rejected"
  >("pending");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalApp, setModalApp] = useState<Application | null>(null);
  const [generatedPasscode, setGeneratedPasscode] = useState("");
  const [approving, setApproving] = useState(false);

  // Toast state
  const [toastMsg, setToastMsg] = useState("");
  const [toastShow, setToastShow] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastShow(true);
  }, []);

  // --- Data loading ---

  const loadApplications = useCallback(async () => {
    try {
      const snap = await getDocs(
        query(collection(db, "gymPartnerApplications"), orderBy("createdAt", "desc"))
      );
      const apps: Application[] = [];
      snap.forEach((d) => apps.push({ id: d.id, ...d.data() } as Application));
      setApplications(apps);
    } catch (e) {
      console.error("Load error:", e);
    }
  }, []);

  const loadWaitlist = useCallback(async () => {
    try {
      const snap = await getDocs(
        query(collection(db, "waitlist"), orderBy("createdAt", "desc"))
      );
      const entries: WaitlistEntry[] = [];
      snap.forEach((d) =>
        entries.push({ id: d.id, ...d.data() } as WaitlistEntry)
      );
      setWaitlistEntries(entries);
    } catch (e) {
      console.error("Waitlist load error:", e);
    }
  }, []);

  const loadFeedbackCount = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, "feedback"));
      setFeedbackCount(snap.size);
    } catch (e) {
      console.error("Feedback load error:", e);
      setFeedbackCount(0);
    }
  }, []);

  // --- Auth actions ---

  const doLogin = async () => {
    setLoginError("");

    if (loginEmail.trim() !== ADMIN_EMAIL) {
      setLoginError("Access denied. Admin only.");
      return;
    }

    setLoginLoading(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
      setIsLoggedIn(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setLoginError(msg.includes("invalid") ? "Wrong email or password" : msg);
    }
    setLoginLoading(false);
  };

  const doSignOut = async () => {
    await signOut(auth);
    setIsLoggedIn(false);
    setApplications([]);
    setWaitlistEntries([]);
    setFeedbackCount(null);
  };

  // Load data after login
  useEffect(() => {
    if (isLoggedIn) {
      loadApplications();
      loadWaitlist();
      loadFeedbackCount();
    }
  }, [isLoggedIn, loadApplications, loadWaitlist, loadFeedbackCount]);

  // --- Derived stats ---

  const pendingCount = applications.filter((a) => a.status === "pending").length;
  const approvedCount = applications.filter(
    (a) => a.status === "approved"
  ).length;

  const weekAgo = Date.now() / 1000 - 7 * 24 * 60 * 60;
  const recentSignups = waitlistEntries.filter(
    (e) => (e.createdAt?.seconds || 0) > weekAgo
  ).length;

  const filteredApps = applications.filter((a) => a.status === currentTab);

  // Type breakdown for waitlist
  const typeBreakdown: Record<string, number> = {};
  waitlistEntries.forEach((e) => {
    const t = e.type || "Gym Goer";
    typeBreakdown[t] = (typeBreakdown[t] || 0) + 1;
  });

  // --- CSV export ---

  const exportWaitlist = () => {
    if (waitlistEntries.length === 0) {
      showToast("No signups to export");
      return;
    }
    const header = "Email,Source,Date\n";
    const rows = waitlistEntries
      .map((e) => {
        const date = e.createdAt
          ? new Date(e.createdAt.seconds * 1000).toISOString()
          : "";
        return `${e.email || ""},${e.source || "website"},${date}`;
      })
      .join("\n");
    const csv = header + rows;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gymroam-waitlist-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${waitlistEntries.length} signups`);
  };

  // --- Approve flow ---

  const openApproveModal = (appId: string) => {
    const app = applications.find((a) => a.id === appId);
    if (!app) return;
    setModalApp(app);
    setGeneratedPasscode(generatePasscode());
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalApp(null);
  };

  const copyPasscode = () => {
    navigator.clipboard.writeText(generatedPasscode);
    showToast("Passcode copied");
  };

  const confirmApprove = async () => {
    if (!modalApp) return;
    setApproving(true);

    try {
      // 1. Create Firebase Auth account (this will sign out admin)
      const result = await createUserWithEmailAndPassword(
        auth,
        modalApp.ownerEmail,
        generatedPasscode
      );
      const partnerId = result.user.uid;

      // 2. Create Firestore user profile
      await setDoc(doc(db, "users", partnerId), {
        displayName: modalApp.ownerName,
        username: "",
        role: "gymPartner",
        mustChangePassword: true,
        partnerGymName: modalApp.gymName,
        partnerGymId: modalApp.id,
        hasCompletedOnboarding: true,
        gymsVisited: 0,
        citiesVisited: 0,
        reviewCount: 0,
        friendCount: 0,
        selectedActivities: [],
        travelerType: "",
        goal: "",
        phoneNumber: modalApp.ownerPhone || "",
        subscriptionActive: false,
        createdAt: serverTimestamp(),
      });

      // 3. Create gym partner document
      await setDoc(doc(db, "gymPartners", modalApp.id), {
        partnerId,
        gymName: modalApp.gymName,
        gymAddress: modalApp.gymAddress || "",
        gymCity: modalApp.gymCity || "",
        gymState: modalApp.gymState || "",
        gymType: modalApp.gymType || "",
        gymWebsite: modalApp.gymWebsite || "",
        gymInstagram: modalApp.gymInstagram || "",
        gymPhone: modalApp.gymPhone || "",
        dayPass: modalApp.dayPass || "",
        views: 0,
        saves: 0,
        directions: 0,
        checkIns: 0,
        isVerified: true,
        approvedAt: serverTimestamp(),
      });

      // 4. Update application status
      await updateDoc(doc(db, "gymPartnerApplications", modalApp.id), {
        status: "approved",
        approvedAt: serverTimestamp(),
        partnerUserId: partnerId,
      });

      // Update local state
      setApplications((prev) =>
        prev.map((a) =>
          a.id === modalApp.id ? { ...a, status: "approved" as const } : a
        )
      );
      closeModal();

      // createUserWithEmailAndPassword signs out admin, so redirect to login
      setIsLoggedIn(false);
      showToast(
        "Partner created! Sign back in to continue. Send them this passcode: " +
          generatedPasscode
      );
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code === "auth/email-already-in-use") {
        showToast("This email already has an account");
      } else {
        showToast("Error: " + (err.message || "Unknown error"));
      }
    }

    setApproving(false);
  };

  // --- Reject flow ---

  const rejectApp = async (appId: string) => {
    if (!window.confirm("Reject this application?")) return;
    try {
      await updateDoc(doc(db, "gymPartnerApplications", appId), {
        status: "rejected",
        rejectedAt: serverTimestamp(),
      });
      setApplications((prev) =>
        prev.map((a) =>
          a.id === appId ? { ...a, status: "rejected" as const } : a
        )
      );
      showToast("Application rejected");
    } catch (e: unknown) {
      const err = e as { message?: string };
      showToast("Error: " + (err.message || "Unknown error"));
    }
  };

  // --- Render ---

  if (!isLoggedIn) {
    return (
      <>
        <div className={styles.loginWrap}>
          <div className={styles.loginCard}>
            <div className={styles.loginLogo}>
              <span>GYMROAM ADMIN</span>
            </div>
            <h2>Sign in</h2>
            <p>Admin access only.</p>
            {loginError && (
              <div className={styles.loginError}>{loginError}</div>
            )}
            <input
              type="email"
              placeholder="Email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") doLogin();
              }}
            />
            <button
              className={styles.loginBtn}
              onClick={doLogin}
              disabled={loginLoading}
            >
              {loginLoading ? "Signing in..." : "Sign In"}
            </button>
          </div>
        </div>
        <Toast
          message={toastMsg}
          show={toastShow}
          onHide={() => setToastShow(false)}
          duration={4000}
        />
      </>
    );
  }

  return (
    <>
      <div className={styles.admin}>
        <div className={styles.adminHeader}>
          <h1>Admin Dashboard</h1>
          <button className={styles.signOutBtn} onClick={doSignOut}>
            Sign Out
          </button>
        </div>

        {/* Stats Grid */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Waitlist</div>
            <div className={styles.statValue}>
              {waitlistEntries.length || "\u2014"}
            </div>
            <div className={styles.statSub}>
              {recentSignups > 0
                ? `+${recentSignups} this week`
                : "Total signups"}
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Pending Applications</div>
            <div className={styles.statValue}>{pendingCount || "\u2014"}</div>
            <div className={styles.statSub}>Gym partners awaiting review</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Approved Partners</div>
            <div className={styles.statValue}>{approvedCount || "\u2014"}</div>
            <div className={styles.statSub}>Active gym partners</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Feedback</div>
            <div className={styles.statValue}>
              {feedbackCount ?? "\u2014"}
            </div>
            <div className={styles.statSub}>Feature requests</div>
          </div>
        </div>

        {/* Waitlist Section */}
        <div className={styles.sectionHeader}>
          <h2>Waitlist Signups</h2>
          <button className={styles.exportBtn} onClick={exportWaitlist}>
            Export CSV
          </button>
        </div>
        <div className={styles.waitlistList}>
          {waitlistEntries.length === 0 ? (
            <div className={styles.waitlistEmpty}>No signups yet.</div>
          ) : (
            <>
              <div className={styles.waitlistBreakdown}>
                {Object.entries(typeBreakdown).map(([type, count]) => (
                  <span className={styles.typeStat} key={type}>
                    <span className={styles.typeStatCount}>{count}</span>{" "}
                    {type}
                    {count !== 1 ? "s" : ""}
                  </span>
                ))}
              </div>
              {waitlistEntries.slice(0, 50).map((entry) => (
                <div className={styles.waitlistRow} key={entry.id}>
                  <span className={styles.waitlistEmail}>
                    {entry.email || ""}
                  </span>
                  <div className={styles.waitlistMeta}>
                    <span className={styles.waitlistTypeTag}>
                      {entry.type || "Gym Goer"}
                    </span>
                    <span
                      className={`${styles.waitlistSource} ${
                        entry.source === "instagram"
                          ? styles.waitlistSourceInstagram
                          : ""
                      }`}
                    >
                      {entry.source || "website"}
                    </span>
                    <span>
                      {formatDate(entry.createdAt, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Partner Applications */}
        <div className={styles.sectionHeader}>
          <h2>Partner Applications</h2>
        </div>

        <div className={styles.tabs}>
          {(["pending", "approved", "rejected"] as const).map((tab) => {
            const isActive = currentTab === tab;
            return (
              <button
                key={tab}
                className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
                onClick={() => setCurrentTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === "pending" && pendingCount > 0 && (
                  <span
                    className={`${styles.badge} ${
                      isActive ? styles.badgeActive : ""
                    }`}
                  >
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className={styles.appList}>
          {filteredApps.length === 0 ? (
            <div className={styles.empty}>No {currentTab} applications.</div>
          ) : (
            filteredApps.map((a) => {
              const statusClass = {
                pending: styles.statusPending,
                approved: styles.statusApproved,
                rejected: styles.statusRejected,
              }[a.status];

              return (
                <div className={styles.appCard} key={a.id}>
                  <div className={styles.appTop}>
                    <div>
                      <div className={styles.appGym}>{a.gymName || ""}</div>
                      <div className={styles.appDate}>
                        {formatDate(a.createdAt, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <span className={`${styles.appStatus} ${statusClass}`}>
                      {a.status}
                    </span>
                  </div>

                  <div className={styles.appDetails}>
                    <div className={styles.appField}>
                      <div className={styles.appFieldLabel}>Owner</div>
                      {a.ownerName || ""} &mdash; {a.ownerRole || ""}
                    </div>
                    <div className={styles.appField}>
                      <div className={styles.appFieldLabel}>Email</div>
                      {a.ownerEmail || ""}
                    </div>
                    <div className={styles.appField}>
                      <div className={styles.appFieldLabel}>Phone</div>
                      {a.ownerPhone || ""}
                    </div>
                    <div className={styles.appField}>
                      <div className={styles.appFieldLabel}>Type</div>
                      {a.gymType || ""}
                    </div>
                    <div className={styles.appField}>
                      <div className={styles.appFieldLabel}>Address</div>
                      {a.gymAddress || ""}, {a.gymCity || ""},{" "}
                      {a.gymState || ""}
                    </div>
                    <div className={styles.appField}>
                      <div className={styles.appFieldLabel}>Day Passes</div>
                      {a.dayPass || "Not specified"}
                    </div>
                    {a.gymWebsite && (
                      <div className={styles.appField}>
                        <div className={styles.appFieldLabel}>Website</div>
                        <a
                          href={a.gymWebsite}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.websiteLink}
                        >
                          {a.gymWebsite}
                        </a>
                      </div>
                    )}
                    {a.gymInstagram && (
                      <div className={styles.appField}>
                        <div className={styles.appFieldLabel}>Instagram</div>
                        {a.gymInstagram}
                      </div>
                    )}
                  </div>

                  <div className={styles.appVerify}>
                    <div className={styles.appFieldLabel}>How to verify</div>
                    <p>{a.verifyMethod || "Not provided"}</p>
                  </div>

                  {a.notes && (
                    <div className={styles.appVerify}>
                      <div className={styles.appFieldLabel}>Notes</div>
                      <p>{a.notes}</p>
                    </div>
                  )}

                  {a.status === "pending" && (
                    <div className={styles.appActions}>
                      <button
                        className={`${styles.actionBtn} ${styles.btnApprove}`}
                        onClick={() => openApproveModal(a.id)}
                      >
                        Approve
                      </button>
                      <button
                        className={`${styles.actionBtn} ${styles.btnReject}`}
                        onClick={() => rejectApp(a.id)}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Approve Modal */}
      {modalOpen && modalApp && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Approve Partner</h3>
            <p className={styles.modalSubtitle}>{modalApp.gymName}</p>

            <label className={styles.modalLabel}>Partner&apos;s Email</label>
            <input
              className={styles.modalInput}
              type="email"
              value={modalApp.ownerEmail}
              readOnly
            />

            <label className={styles.modalLabel}>Temporary Passcode</label>
            <div className={styles.passcodeRow}>
              <div className={styles.passcodeDisplay}>
                {generatedPasscode}
              </div>
              <button className={styles.copyBtn} onClick={copyPasscode}>
                Copy
              </button>
            </div>
            <p className={styles.passcodeHint}>
              This passcode will be sent to the partner. They&apos;ll change it
              on first login.
            </p>

            <div className={styles.modalActions}>
              <button className={styles.btnCancel} onClick={closeModal}>
                Cancel
              </button>
              <button
                className={styles.btnConfirm}
                onClick={confirmApprove}
                disabled={approving}
              >
                {approving ? "Creating account..." : "Create Account & Approve"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast
        message={toastMsg}
        show={toastShow}
        onHide={() => setToastShow(false)}
        duration={4000}
      />
    </>
  );
}
