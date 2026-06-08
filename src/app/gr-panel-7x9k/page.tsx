"use client";

import { useState, useEffect, useCallback } from "react";
import { db, auth } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  orderBy,
  where,
  limit,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import Toast from "@/components/Toast";
import {
  TRAINER_PRO_PRICE,
  MIN_INSTAGRAM_FOLLOWERS,
  GYM_PARTNER_PRICE,
  GYM_PARTNER_PAYMENT_LINK,
} from "@/lib/subscription";
import styles from "./page.module.css";

const ADMIN_EMAILS = ["gymroamapp@gmail.com", "kevin@aigrowthhouse.com"];
const ADMIN_NAMES: Record<string, string> = {
  "gymroamapp@gmail.com": "Alessandro",
  "kevin@aigrowthhouse.com": "Kevin",
};

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
  subscriptionActive?: boolean;
  subscriptionStatus?: string;
  verifyMethod?: string;
  notes?: string;
  createdAt?: FirestoreTimestamp;
}

interface TrainerApplication {
  id: string;
  status: "pending" | "approved" | "rejected";
  fullName: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  instagramHandle: string;
  followerCount: number;
  specialty: string;
  certifications?: string;
  yearsExperience?: string;
  bio: string;
  offersDropIns?: string;
  rate?: string;
  websiteOrLink?: string;
  notes?: string;
  instagramVerified?: boolean;
  paymentStatus?: "unpaid" | "paid";
  createdAt?: FirestoreTimestamp;
}

interface CareerApplication {
  id: string;
  status: "pending" | "reviewed";
  roleId: string;
  roleTitle: string;
  fullName: string;
  email: string;
  city?: string;
  why: string;
  instagramHandle?: string;
  portfolioLink?: string;
  aiTools?: string;
  /** Replaced startDate in the FLSA-compliant version */
  semester?: string;
  schoolName?: string;
  coordinatorName?: string;
  creditEligible?: boolean;
  /** Legacy field — kept for backwards compat with old applications */
  startDate?: string;
  createdAt?: FirestoreTimestamp;
}

interface WaitlistEntry {
  id: string;
  email: string;
  source?: string;
  type?: string;
  createdAt?: FirestoreTimestamp;
}

interface UpdatePost {
  id: string;
  author: string;
  authorEmail: string;
  text: string;
  createdAt?: FirestoreTimestamp;
}

interface PageView {
  id: string;
  path: string;
  sessionId: string;
  referrer?: string;
  createdAt?: FirestoreTimestamp;
}

interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  assignedToEmail: string;
  status: "todo" | "in_progress" | "completed";
  priority: "low" | "medium" | "high";
  createdBy: string;
  createdByEmail: string;
  createdAt?: FirestoreTimestamp;
  completedAt?: FirestoreTimestamp;
}

// Public-facing feedback submissions from /feedback. Mirrors the shape
// written by feedback/page.tsx's handleSubmit. `status` follows the same
// four-stage lifecycle as the public board so admin status changes are
// reflected back to users immediately.
// App users — the people who signed up inside the iOS app (Firebase Auth
// account creators). Only a few fields are surfaced in the admin list;
// the rest of the user doc (fitness prefs, traveler type, creator bio,
// etc.) is left for future detail views.
interface AppUser {
  uid: string;
  email?: string;
  displayName?: string;
  username?: string;
  photoURL?: string;
  homeCity?: string;
  isVerifiedCreator?: boolean;
  verifiedCreatorTier?: string | null;
  createdAt?: FirestoreTimestamp;
  updatedAt?: number; // iOS writes this (epoch seconds) on every save
}

// Canonical Auth identity for a UID. Fetched from /api/admin/users-auth
// (server-side, Firebase Admin SDK). Firebase Auth is the source of
// truth for email — the Firestore /users doc may not mirror it.
// A UID present in /users but ABSENT from this map is an orphan: no
// matching Auth account (deleted user, leftover test data, etc.).
interface AuthUserInfo {
  email: string | null;
  emailVerified: boolean;
  providers: string[]; // e.g. ["apple.com"] / ["password"] / ["google.com"]
  lastSignIn: string | null;
  createdAt: string | null;
  disabled: boolean;
}

type FeedbackStatus = "under review" | "planned" | "in progress" | "shipped";

interface FeedbackItem {
  id: string;
  title: string;
  description?: string;
  category?: string;       // "Feature" | "Improvement" | "Bug Fix" | "Design"
  submittedBy?: string;    // "Anonymous" if no name was given
  votes?: number;
  status: FeedbackStatus;
  createdAt?: FirestoreTimestamp;
  reviewedAt?: FirestoreTimestamp;
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

// Label/value row used inside the App User detail modal. Keeps the
// modal markup readable.
function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "140px 1fr",
        gap: 12,
        fontSize: 13,
        padding: "5px 0",
        borderBottom: "1px solid var(--surface2)",
      }}
    >
      <span style={{ color: "var(--dim)", fontWeight: 600 }}>{label}</span>
      <span style={{ color: "var(--text)" }}>{children}</span>
    </div>
  );
}

export default function AdminPanel() {
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");

  // ── Section navigation ──
  // Six top-level tabs, each owning a focused slice of admin work:
  //   overview — at-a-glance dashboard + "Needs Your Attention" queue
  //   users    — App Users + Waitlist
  //   pipeline — Gym / Trainer / Career applications
  //   feedback — public Feedback Board
  //   traffic  — Website Traffic
  //   team     — Updates + Tasks
  // Sub-tab state for the multi-section tabs lives below.
  type AdminSection =
    | "overview"
    | "users"
    | "pipeline"
    | "feedback"
    | "traffic"
    | "team";
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");

  // Sub-tab state per section that has internal sub-sections.
  // "app-users" is the most common landing tab for Users; gym is the
  // most common for Pipeline (highest volume); tasks for Team (more
  // actionable than the broadcast Updates feed).
  const [usersTab, setUsersTab] = useState<"app-users" | "waitlist">("app-users");
  const [pipelineTab, setPipelineTab] = useState<"gym" | "trainer" | "career">("gym");
  const [teamTab, setTeamTab] = useState<"tasks" | "updates">("tasks");

  // Type aliases for sub-tabs we'll target from the action queue.
  // String-literal types (rather than typeof state) so this helper can
  // sit before the corresponding useState calls without TDZ errors.
  type CareerTab = "pending" | "reviewed";
  type FeedbackTab = "all" | FeedbackStatus;
  type AppPoolTab = "pending" | "approved" | "rejected";

  // Data state
  const [applications, setApplications] = useState<Application[]>([]);
  const [trainerApps, setTrainerApps] = useState<TrainerApplication[]>([]);
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  // Feedback board submissions — full list (admin view), not just a count.
  // The stat card derives its number from feedbackItems.length so we stay
  // single-source-of-truth.
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [feedbackTab, setFeedbackTab] = useState<
    "all" | FeedbackStatus
  >("all");

  // Page views / traffic state
  const [pageViews, setPageViews] = useState<PageView[]>([]);

  // Career applications
  const [careerApps, setCareerApps] = useState<CareerApplication[]>([]);
  const [careerTab, setCareerTab] = useState<"pending" | "reviewed">("pending");

  // App users — most-recent 100, ordered by createdAt desc.
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  // Cross-reference: uid → canonical Auth identity. Populated by
  // /api/admin/users-auth after login. Used silently to surface
  // canonical email + the Auth detail in the per-user modal.
  const [authInfo, setAuthInfo] = useState<Record<string, AuthUserInfo>>({});
  const [authInfoLoaded, setAuthInfoLoaded] = useState(false);
  // Surface fetch errors directly in the modal (we don't want to make
  // the user open DevTools to diagnose). Cleared on successful fetch.
  const [authInfoError, setAuthInfoError] = useState<{
    status: number;
    body: string;
  } | null>(null);
  const [authInfoCount, setAuthInfoCount] = useState<number>(0);

  // Per-user detail modal — opens when an admin clicks a row.
  // Fetches the user's workouts (passport stamps) and friends from the
  // /users/{uid}/workouts and /users/{uid}/friends subcollections on
  // open. Cleared (null) when closed.
  const [userDetailUid, setUserDetailUid] = useState<string | null>(null);
  const [userWorkouts, setUserWorkouts] = useState<
    Array<{ id: string } & Record<string, unknown>>
  >([]);
  const [userFriends, setUserFriends] = useState<
    Array<{ id: string } & Record<string, unknown>>
  >([]);
  const [userDetailLoading, setUserDetailLoading] = useState(false);

  // Updates state
  const [updates, setUpdates] = useState<UpdatePost[]>([]);
  const [newUpdateText, setNewUpdateText] = useState("");
  const [postingUpdate, setPostingUpdate] = useState(false);

  // Tasks state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskTab, setTaskTab] = useState<"todo" | "in_progress" | "completed">("todo");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    assignedTo: "Alessandro",
    assignedToEmail: "gymroamapp@gmail.com",
    priority: "medium" as "low" | "medium" | "high",
  });
  const [creatingTask, setCreatingTask] = useState(false);

  // Top-level pool switcher
  const [appPool, setAppPool] = useState<"gym" | "trainer">("gym");
  const [currentTab, setCurrentTab] = useState<
    "pending" | "approved" | "rejected"
  >("pending");

  // Gym modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalApp, setModalApp] = useState<Application | null>(null);
  const [generatedPasscode, setGeneratedPasscode] = useState("");
  const [approving, setApproving] = useState(false);

  // Trainer modal state
  const [trainerModalOpen, setTrainerModalOpen] = useState(false);
  const [trainerModalApp, setTrainerModalApp] =
    useState<TrainerApplication | null>(null);
  const [trainerPasscode, setTrainerPasscode] = useState("");
  const [trainerApproving, setTrainerApproving] = useState(false);
  const [instagramConfirmed, setInstagramConfirmed] = useState(false);

  // Toast state
  const [toastMsg, setToastMsg] = useState("");
  const [toastShow, setToastShow] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastShow(true);
  }, []);

  // Navigate to a top-level section, optionally pre-selecting a sub-tab.
  // Used by the "Needs Your Attention" queue on the Overview tab so a
  // single click jumps to the right section AND pre-selects the right
  // sub-tab (and inner status filter) in one motion.
  const goToSection = useCallback(
    (
      section: AdminSection,
      options?: {
        users?: "app-users" | "waitlist";
        pipeline?: "gym" | "trainer" | "career";
        team?: "tasks" | "updates";
        careerTab?: CareerTab;
        feedbackTab?: FeedbackTab;
        currentTab?: AppPoolTab;
      }
    ) => {
      setActiveSection(section);
      if (options?.users) setUsersTab(options.users);
      if (options?.pipeline) setPipelineTab(options.pipeline);
      if (options?.team) setTeamTab(options.team);
      if (options?.careerTab) setCareerTab(options.careerTab);
      if (options?.feedbackTab) setFeedbackTab(options.feedbackTab);
      if (options?.currentTab) setCurrentTab(options.currentTab);
      // Scroll back to top so the user lands at the section header,
      // not wherever the previous section left the viewport.
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    []
  );

  // Auto sign-in from persisted Firebase session
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user && user.email) {
        const email = user.email.toLowerCase();
        if (ADMIN_EMAILS.includes(email)) {
          setAdminEmail(email);
          setAdminName(ADMIN_NAMES[email] || "Admin");
          setIsLoggedIn(true);
        }
      }
    });
    return () => unsub();
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

  const loadTrainerApplications = useCallback(async () => {
    try {
      const snap = await getDocs(
        query(collection(db, "trainerApplications"), orderBy("createdAt", "desc"))
      );
      const apps: TrainerApplication[] = [];
      snap.forEach((d) =>
        apps.push({ id: d.id, ...d.data() } as TrainerApplication)
      );
      setTrainerApps(apps);
    } catch (e) {
      console.error("Trainer load error:", e);
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

  const loadCareerApplications = useCallback(async () => {
    try {
      const snap = await getDocs(
        query(collection(db, "careersApplications"), orderBy("createdAt", "desc"))
      );
      const apps: CareerApplication[] = [];
      snap.forEach((d) => apps.push({ id: d.id, ...d.data() } as CareerApplication));
      setCareerApps(apps);
    } catch (e) {
      console.error("Career apps load error:", e);
    }
  }, []);

  // Load up to 100 users. NO server-side `orderBy` — Firestore silently
  // EXCLUDES docs that lack the ordering field, which is how users kept
  // disappearing:
  //   • PR #12 used orderBy(createdAt)  → hid every user (iOS didn't write it)
  //   • PR #14 used orderBy(updatedAt)  → still hid users with no updatedAt
  //     (signed up but never saved profile, pre-1.0.3 builds without the
  //      photo-sync flow that stamps updatedAt)
  // Fetching without orderBy returns docs in document-ID order (every doc
  // has an ID, so none get filtered out). We sort client-side with a
  // fallback chain so the most-recent appear at the top and date-less
  // users sink to the bottom — but every user appears.
  //
  // Trade-off: this returns the 100 lowest-by-uid docs, not the 100
  // newest. Fine at pre-launch scale (<<100 users). Revisit with proper
  // server-side pagination once the user base outgrows the limit.
  const loadAppUsers = useCallback(async () => {
    try {
      const snap = await getDocs(
        query(collection(db, "users"), limit(100))
      );
      const items: AppUser[] = [];
      snap.forEach((d) => {
        const data = d.data();
        let createdAt = data.createdAt as FirestoreTimestamp | undefined;
        if (!createdAt && typeof data.updatedAt === "number") {
          createdAt = { seconds: Math.floor(data.updatedAt), nanoseconds: 0 };
        }
        items.push({ uid: d.id, ...data, createdAt } as AppUser);
      });
      // Client-side newest-first sort. Users with no date field at all
      // get seconds=0 and sink to the bottom (still visible, just last).
      items.sort(
        (a, b) =>
          (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
      );
      setAppUsers(items);
    } catch (e) {
      console.error("App users load error:", e);
    }
  }, []);

  // Cross-reference Firestore /users with Firebase Auth. Server-side
  // (Admin SDK) — the API route gates on a Firebase ID token + admin
  // email allowlist. Result: { [uid]: AuthUserInfo } for every Auth
  // user. A /users doc whose UID isn't in this map is an ORPHAN
  // (no Auth account) — we flag those in the UI.
  const loadAuthInfo = useCallback(async () => {
    setAuthInfoError(null);
    try {
      const u = auth.currentUser;
      if (!u) {
        // Login race or signed-out — just clear and bail.
        setAuthInfo({});
        setAuthInfoLoaded(false);
        return;
      }
      const idToken = await u.getIdToken();
      const res = await fetch("/api/admin/users-auth", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error("authInfo fetch failed:", res.status, body);
        setAuthInfo({});
        setAuthInfoCount(0);
        setAuthInfoError({ status: res.status, body });
        setAuthInfoLoaded(true);
        return;
      }
      const data = (await res.json()) as {
        users: Record<string, AuthUserInfo>;
        totalScanned?: number;
      };
      const map = data.users || {};
      setAuthInfo(map);
      setAuthInfoCount(data.totalScanned ?? Object.keys(map).length);
      setAuthInfoLoaded(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("authInfo load error:", e);
      setAuthInfo({});
      setAuthInfoCount(0);
      setAuthInfoError({ status: 0, body: msg });
      setAuthInfoLoaded(true);
    }
  }, []);

  const loadPageViews = useCallback(async () => {
    try {
      // Last 7 days only — keeps reads cheap
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const snap = await getDocs(
        query(
          collection(db, "pageViews"),
          where("createdAt", ">=", Timestamp.fromDate(sevenDaysAgo)),
          orderBy("createdAt", "desc")
        )
      );
      const views: PageView[] = [];
      snap.forEach((d) => views.push({ id: d.id, ...d.data() } as PageView));
      setPageViews(views);
    } catch (e) {
      console.error("PageViews load error:", e);
    }
  }, []);

  // Pull every feedback submission. Ordered newest-first so the admin
  // immediately sees what just came in; per-tab filtering (and the
  // optional vote-priority sort inside that) happens client-side below.
  const loadFeedback = useCallback(async () => {
    try {
      const snap = await getDocs(
        query(collection(db, "feedback"), orderBy("createdAt", "desc"))
      );
      const items: FeedbackItem[] = [];
      snap.forEach((d) =>
        items.push({ id: d.id, ...d.data() } as FeedbackItem)
      );
      setFeedbackItems(items);
    } catch (e) {
      console.error("Feedback load error:", e);
      setFeedbackItems([]);
    }
  }, []);

  const loadUpdates = useCallback(async () => {
    try {
      const snap = await getDocs(
        query(collection(db, "updates"), orderBy("createdAt", "desc"))
      );
      const posts: UpdatePost[] = [];
      snap.forEach((d) => posts.push({ id: d.id, ...d.data() } as UpdatePost));
      setUpdates(posts);
    } catch (e) {
      console.error("Updates load error:", e);
    }
  }, []);

  const loadTasks = useCallback(async () => {
    try {
      const snap = await getDocs(
        query(collection(db, "tasks"), orderBy("createdAt", "desc"))
      );
      const items: Task[] = [];
      snap.forEach((d) => items.push({ id: d.id, ...d.data() } as Task));
      setTasks(items);
    } catch (e) {
      console.error("Tasks load error:", e);
    }
  }, []);

  // --- Auth actions ---

  const doLogin = async () => {
    setLoginError("");

    if (!ADMIN_EMAILS.includes(loginEmail.trim().toLowerCase())) {
      setLoginError("Access denied. Admin only.");
      return;
    }

    setLoginLoading(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
      const email = loginEmail.trim().toLowerCase();
      setAdminEmail(email);
      setAdminName(ADMIN_NAMES[email] || "Admin");
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
    setAdminEmail("");
    setAdminName("");
    setApplications([]);
    setTrainerApps([]);
    setWaitlistEntries([]);
    setFeedbackItems([]);
    setFeedbackTab("all");
    setUpdates([]);
    setTasks([]);
    setPageViews([]);
    setCareerApps([]);
    setAppUsers([]);
    setAuthInfo({});
    setAuthInfoLoaded(false);
    setAuthInfoError(null);
    setAuthInfoCount(0);
  };

  // Load data after login
  useEffect(() => {
    if (isLoggedIn) {
      loadApplications();
      loadTrainerApplications();
      loadWaitlist();
      loadFeedback();
      loadPageViews();
      loadUpdates();
      loadTasks();
      loadCareerApplications();
      loadAppUsers();
      loadAuthInfo();
    }
  }, [
    isLoggedIn,
    loadApplications,
    loadTrainerApplications,
    loadWaitlist,
    loadFeedback,
    loadPageViews,
    loadUpdates,
    loadTasks,
    loadCareerApplications,
    loadAppUsers,
    loadAuthInfo,
  ]);

  // Fetch the per-user subcollections when the detail modal opens.
  // Two reads in parallel: workouts (passport stamps) + friends. Both
  // are tolerant of missing/empty subcollections (returns []).
  useEffect(() => {
    if (!userDetailUid) {
      setUserWorkouts([]);
      setUserFriends([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setUserDetailLoading(true);
      try {
        const [wSnap, fSnap] = await Promise.all([
          getDocs(collection(db, `users/${userDetailUid}/workouts`)),
          getDocs(collection(db, `users/${userDetailUid}/friends`)),
        ]);
        if (cancelled) return;
        const ws: Array<{ id: string } & Record<string, unknown>> = [];
        wSnap.forEach((d) => ws.push({ id: d.id, ...d.data() }));
        const fs: Array<{ id: string } & Record<string, unknown>> = [];
        fSnap.forEach((d) => fs.push({ id: d.id, ...d.data() }));
        // Workouts newest-first when they carry a date field.
        ws.sort((a, b) => {
          const av =
            (a.createdAt as FirestoreTimestamp | undefined)?.seconds ??
            (typeof a.timestamp === "number" ? a.timestamp : 0);
          const bv =
            (b.createdAt as FirestoreTimestamp | undefined)?.seconds ??
            (typeof b.timestamp === "number" ? b.timestamp : 0);
          return bv - av;
        });
        setUserWorkouts(ws);
        setUserFriends(fs);
      } catch (e) {
        console.error("user detail fetch failed:", e);
        setUserWorkouts([]);
        setUserFriends([]);
      } finally {
        if (!cancelled) setUserDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userDetailUid]);

  // --- Derived stats ---

  const pendingCount = applications.filter((a) => a.status === "pending").length;
  const approvedCount = applications.filter(
    (a) => a.status === "approved"
  ).length;
  const trainerPendingCount = trainerApps.filter(
    (a) => a.status === "pending"
  ).length;
  const trainerApprovedCount = trainerApps.filter(
    (a) => a.status === "approved"
  ).length;
  const careerPendingCount = careerApps.filter(
    (a) => a.status === "pending" || !a.status
  ).length;
  const filteredCareers = careerApps.filter(
    (a) => (careerTab === "pending" ? !a.status || a.status === "pending" : a.status === careerTab)
  );

  const weekAgo = Date.now() / 1000 - 7 * 24 * 60 * 60;
  const recentSignups = waitlistEntries.filter(
    (e) => (e.createdAt?.seconds || 0) > weekAgo
  ).length;

  // App-signup activity windows. Used for both the stat-tile subtitle
  // and the in-section velocity readout.
  const thirtyDaysAgo = Date.now() / 1000 - 30 * 24 * 60 * 60;
  const appUsersThisWeek = appUsers.filter(
    (u) => (u.createdAt?.seconds || 0) > weekAgo
  ).length;
  const appUsersThisMonth = appUsers.filter(
    (u) => (u.createdAt?.seconds || 0) > thirtyDaysAgo
  ).length;

  const filteredApps = applications.filter((a) => a.status === currentTab);
  const filteredTrainers = trainerApps.filter((a) => a.status === currentTab);

  // Type breakdown for waitlist
  const typeBreakdown: Record<string, number> = {};
  waitlistEntries.forEach((e) => {
    const t = e.type || "Gym Goer";
    typeBreakdown[t] = (typeBreakdown[t] || 0) + 1;
  });

  // Traffic stats (last 7 days in pageViews)
  const nowSec = Date.now() / 1000;
  const startOfTodaySec = new Date().setHours(0, 0, 0, 0) / 1000;
  const sevenDaysAgoSec = nowSec - 7 * 24 * 60 * 60;

  const viewsToday = pageViews.filter(
    (v) => (v.createdAt?.seconds || 0) >= startOfTodaySec
  ).length;
  const viewsWeek = pageViews.filter(
    (v) => (v.createdAt?.seconds || 0) >= sevenDaysAgoSec
  ).length;
  const uniqueTodaySet = new Set(
    pageViews
      .filter((v) => (v.createdAt?.seconds || 0) >= startOfTodaySec)
      .map((v) => v.sessionId)
  );
  const uniqueVisitorsToday = uniqueTodaySet.size;

  // Top page today
  const pathCountsToday: Record<string, number> = {};
  pageViews
    .filter((v) => (v.createdAt?.seconds || 0) >= startOfTodaySec)
    .forEach((v) => {
      pathCountsToday[v.path] = (pathCountsToday[v.path] || 0) + 1;
    });
  const topPageEntry = Object.entries(pathCountsToday).sort(
    (a, b) => b[1] - a[1]
  )[0];
  const topPagePath = topPageEntry ? topPageEntry[0] : "—";
  const topPageCount = topPageEntry ? topPageEntry[1] : 0;

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

  // --- Gym Approve flow ---

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
      const result = await createUserWithEmailAndPassword(
        auth,
        modalApp.ownerEmail,
        generatedPasscode
      );
      const partnerId = result.user.uid;

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

      await updateDoc(doc(db, "gymPartnerApplications", modalApp.id), {
        status: "approved",
        approvedAt: serverTimestamp(),
        partnerUserId: partnerId,
      });

      /* send gym partner their approval email with passcode + Stripe billing link */
      await addDoc(collection(db, "mail"), {
        to: [modalApp.ownerEmail],
        message: {
          subject: "GymRoam — You're approved! Activate your Gym Partner listing",
          html: `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;background:#111114;color:#E8E8EE;padding:32px;border-radius:16px;border:1px solid #E8FF3C;">
              <div style="text-align:center;margin-bottom:24px;">
                <div style="display:inline-block;width:40px;height:40px;background:#E8FF3C;border-radius:10px;line-height:40px;font-weight:900;font-size:20px;color:#0A0A0B;">G</div>
              </div>
              <h2 style="text-align:center;margin:0 0 8px;font-size:22px;color:#E8FF3C;">You're approved!</h2>
              <p style="text-align:center;color:#8A8A99;margin:0 0 24px;font-size:14px;"><strong style="color:#E8E8EE;">${modalApp.gymName}</strong> is ready to go live, ${modalApp.ownerName}.</p>

              <div style="background:#18181D;border-radius:12px;padding:20px;margin-bottom:16px;">
                <h3 style="color:#E8FF3C;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Step 1 · Activate your listing</h3>
                <p style="margin:0 0 16px;font-size:14px;color:#8A8A99;line-height:1.6;">Subscribe to Gym Partner (${GYM_PARTNER_PRICE}, cancel anytime). Your listing goes live the moment payment clears:</p>
                <a href="${GYM_PARTNER_PAYMENT_LINK}?prefilled_email=${encodeURIComponent(modalApp.ownerEmail)}" style="display:block;background:#E8FF3C;color:#0A0A0B;text-decoration:none;padding:14px;border-radius:10px;text-align:center;font-weight:800;font-size:15px;">Activate Gym Partner →</a>
                <p style="margin:12px 0 0;font-size:11px;color:#55555F;text-align:center;">Use <strong style="color:#8A8A99;">${modalApp.ownerEmail}</strong> at checkout so we can match the subscription to your listing.</p>
              </div>

              <div style="background:#18181D;border-radius:12px;padding:20px;margin-bottom:24px;">
                <h3 style="color:#E8FF3C;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Step 2 · Sign in</h3>
                <p style="margin:0 0 12px;font-size:14px;color:#8A8A99;line-height:1.6;">Download GymRoam and sign in with:</p>
                <p style="margin:0 0 4px;font-size:13px;color:#8A8A99;">Email: <strong style="color:#E8E8EE;">${modalApp.ownerEmail}</strong></p>
                <p style="margin:0 0 12px;font-size:13px;color:#8A8A99;">Passcode:</p>
                <div style="background:#0A0A0B;border:1px solid #1F1F26;border-radius:8px;padding:14px;text-align:center;font-size:22px;font-weight:900;letter-spacing:3px;color:#E8FF3C;">${generatedPasscode}</div>
                <p style="margin:12px 0 0;font-size:11px;color:#55555F;text-align:center;">You'll set your own password on first login.</p>
              </div>

              <p style="color:#55555F;font-size:12px;text-align:center;margin:0;">Questions? Reply to this email.</p>
            </div>
          `,
        },
      });

      setApplications((prev) =>
        prev.map((a) =>
          a.id === modalApp.id ? { ...a, status: "approved" as const } : a
        )
      );
      closeModal();

      setIsLoggedIn(false);
      showToast(
        "Partner approved! Email sent with passcode + Stripe link. Passcode: " +
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

  // --- Trainer Approve flow ---

  const openTrainerModal = (appId: string) => {
    const app = trainerApps.find((a) => a.id === appId);
    if (!app) return;
    setTrainerModalApp(app);
    setTrainerPasscode(generatePasscode());
    setInstagramConfirmed(false);
    setTrainerModalOpen(true);
  };

  const closeTrainerModal = () => {
    setTrainerModalOpen(false);
    setTrainerModalApp(null);
  };

  const copyTrainerPasscode = () => {
    navigator.clipboard.writeText(trainerPasscode);
    showToast("Passcode copied");
  };

  const confirmTrainerApprove = async () => {
    if (!trainerModalApp) return;
    if (!instagramConfirmed) {
      showToast("Confirm Instagram is verified first");
      return;
    }
    setTrainerApproving(true);

    try {
      const result = await createUserWithEmailAndPassword(
        auth,
        trainerModalApp.email,
        trainerPasscode
      );
      const trainerId = result.user.uid;

      await setDoc(doc(db, "users", trainerId), {
        displayName: trainerModalApp.fullName,
        username: "",
        role: "trainer",
        mustChangePassword: true,
        hasCompletedOnboarding: true,
        trainerAppId: trainerModalApp.id,
        specialty: trainerModalApp.specialty,
        city: trainerModalApp.city,
        country: trainerModalApp.country,
        gymsVisited: 0,
        citiesVisited: 0,
        reviewCount: 0,
        friendCount: 0,
        selectedActivities: [],
        travelerType: "",
        goal: "",
        phoneNumber: trainerModalApp.phone || "",
        subscriptionActive: false,
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, "trainers", trainerModalApp.id), {
        trainerId,
        fullName: trainerModalApp.fullName,
        specialty: trainerModalApp.specialty,
        city: trainerModalApp.city,
        country: trainerModalApp.country,
        instagramHandle: trainerModalApp.instagramHandle,
        followerCount: trainerModalApp.followerCount,
        certifications: trainerModalApp.certifications || "",
        yearsExperience: trainerModalApp.yearsExperience || "",
        bio: trainerModalApp.bio,
        offersDropIns: trainerModalApp.offersDropIns || "",
        rate: trainerModalApp.rate || "",
        websiteOrLink: trainerModalApp.websiteOrLink || "",
        views: 0,
        saves: 0,
        messages: 0,
        isVerified: true,
        instagramVerified: true,
        subscriptionActive: false,
        approvedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "trainerApplications", trainerModalApp.id), {
        status: "approved",
        instagramVerified: true,
        approvedAt: serverTimestamp(),
        trainerUserId: trainerId,
      });

      /* send trainer their approval email with passcode + in-app subscribe instructions */
      await addDoc(collection(db, "mail"), {
        to: [trainerModalApp.email],
        message: {
          subject: "GymRoam — You're approved! Here's your passcode",
          html: `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;background:#111114;color:#E8E8EE;padding:32px;border-radius:16px;border:1px solid #E8FF3C;">
              <div style="text-align:center;margin-bottom:24px;">
                <div style="display:inline-block;width:40px;height:40px;background:#E8FF3C;border-radius:10px;line-height:40px;font-weight:900;font-size:20px;color:#0A0A0B;">G</div>
              </div>
              <h2 style="text-align:center;margin:0 0 8px;font-size:22px;color:#E8FF3C;">You're approved!</h2>
              <p style="text-align:center;color:#8A8A99;margin:0 0 24px;font-size:14px;">Welcome to GymRoam, ${trainerModalApp.fullName}.</p>

              <div style="background:#18181D;border-radius:12px;padding:20px;margin-bottom:16px;">
                <h3 style="color:#E8FF3C;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Step 1 · Sign in</h3>
                <p style="margin:0 0 12px;font-size:14px;color:#8A8A99;line-height:1.6;">Download GymRoam on the App Store, then sign in with:</p>
                <p style="margin:0 0 4px;font-size:13px;color:#8A8A99;">Email: <strong style="color:#E8E8EE;">${trainerModalApp.email}</strong></p>
                <p style="margin:0 0 12px;font-size:13px;color:#8A8A99;">Passcode:</p>
                <div style="background:#0A0A0B;border:1px solid #1F1F26;border-radius:8px;padding:14px;text-align:center;font-size:22px;font-weight:900;letter-spacing:3px;color:#E8FF3C;">${trainerPasscode}</div>
                <p style="margin:12px 0 0;font-size:11px;color:#55555F;text-align:center;">You'll set your own password on first login.</p>
              </div>

              <div style="background:#18181D;border-radius:12px;padding:20px;margin-bottom:24px;">
                <h3 style="color:#E8FF3C;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Step 2 · Subscribe to Trainer Pro</h3>
                <p style="margin:0 0 8px;font-size:14px;color:#8A8A99;line-height:1.6;">Inside the app, tap <strong style="color:#E8E8EE;">Activate Trainer Pro</strong>. Confirm with Face ID.</p>
                <p style="margin:0 0 8px;font-size:14px;color:#8A8A99;line-height:1.6;"><strong style="color:#E8E8EE;">${TRAINER_PRO_PRICE}</strong>, billed through Apple. Cancel anytime from iPhone Settings → Subscriptions.</p>
                <p style="margin:0;font-size:14px;color:#8A8A99;line-height:1.6;">Your profile goes live the moment the subscription activates.</p>
              </div>

              <p style="color:#55555F;font-size:12px;text-align:center;margin:0;">Questions? Reply to this email.</p>
            </div>
          `,
        },
      });

      setTrainerApps((prev) =>
        prev.map((a) =>
          a.id === trainerModalApp.id ? { ...a, status: "approved" as const } : a
        )
      );
      closeTrainerModal();

      setIsLoggedIn(false);
      showToast(
        "Trainer approved! Email sent with passcode + Apple IAP instructions. Passcode: " +
          trainerPasscode
      );
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code === "auth/email-already-in-use") {
        showToast("This email already has an account");
      } else {
        showToast("Error: " + (err.message || "Unknown error"));
      }
    }

    setTrainerApproving(false);
  };

  const rejectTrainer = async (appId: string) => {
    if (!window.confirm("Reject this trainer application?")) return;
    try {
      await updateDoc(doc(db, "trainerApplications", appId), {
        status: "rejected",
        rejectedAt: serverTimestamp(),
      });
      setTrainerApps((prev) =>
        prev.map((a) =>
          a.id === appId ? { ...a, status: "rejected" as const } : a
        )
      );
      showToast("Trainer application rejected");
    } catch (e: unknown) {
      const err = e as { message?: string };
      showToast("Error: " + (err.message || "Unknown error"));
    }
  };

  // --- Career applications actions ---

  const markCareerReviewed = async (
    appId: string,
    next: "pending" | "reviewed"
  ) => {
    try {
      await updateDoc(doc(db, "careersApplications", appId), {
        status: next,
        reviewedAt: next === "reviewed" ? serverTimestamp() : null,
      });
      setCareerApps((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status: next } : a))
      );
      showToast(
        next === "reviewed" ? "Marked reviewed" : "Moved back to pending"
      );
    } catch (e: unknown) {
      const err = e as { message?: string };
      showToast("Error: " + (err.message || "Unknown error"));
    }
  };

  // --- Feedback actions ---

  // Change a feedback item's status. Writes to Firestore and optimistically
  // updates local state so the admin doesn't see a flicker waiting for the
  // round-trip. Stamps `reviewedAt` on every change so we have an audit
  // trail of when status moved (mirrors `markCareerReviewed`).
  const updateFeedbackStatus = async (
    feedbackId: string,
    next: FeedbackStatus
  ) => {
    try {
      await updateDoc(doc(db, "feedback", feedbackId), {
        status: next,
        reviewedAt: serverTimestamp(),
      });
      setFeedbackItems((prev) =>
        prev.map((f) => (f.id === feedbackId ? { ...f, status: next } : f))
      );
      showToast(`Marked as ${next}`);
    } catch (e: unknown) {
      const err = e as { message?: string };
      showToast("Error: " + (err.message || "Unknown error"));
    }
  };

  // Hard-delete a feedback item. Used for spam / off-topic submissions.
  // window.confirm because there's no undo — the public board shows
  // whatever is in Firestore, so a fat-finger here is visible to users.
  const deleteFeedbackItem = async (feedbackId: string) => {
    if (
      !window.confirm(
        "Delete this feedback submission? This cannot be undone."
      )
    )
      return;
    try {
      await deleteDoc(doc(db, "feedback", feedbackId));
      setFeedbackItems((prev) => prev.filter((f) => f.id !== feedbackId));
      showToast("Feedback deleted");
    } catch (e: unknown) {
      const err = e as { message?: string };
      showToast("Error: " + (err.message || "Unknown error"));
    }
  };

  // --- Updates actions ---

  const postUpdate = async () => {
    const text = newUpdateText.trim();
    if (!text) return;
    setPostingUpdate(true);
    try {
      await addDoc(collection(db, "updates"), {
        author: adminName,
        authorEmail: adminEmail,
        text,
        createdAt: serverTimestamp(),
      });
      /* notify the other admin */
      const otherEmail = ADMIN_EMAILS.find((e) => e !== adminEmail);
      if (otherEmail) {
        await addDoc(collection(db, "mail"), {
          to: [otherEmail],
          message: {
            subject: `GymRoam — ${adminName} posted an update`,
            html: `
              <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;background:#111114;color:#E8E8EE;padding:32px;border-radius:16px;border:1px solid #E8FF3C;">
                <div style="text-align:center;margin-bottom:24px;">
                  <div style="display:inline-block;width:40px;height:40px;background:#E8FF3C;border-radius:10px;line-height:40px;font-weight:900;font-size:20px;color:#0A0A0B;">G</div>
                </div>
                <h2 style="text-align:center;margin:0 0 8px;font-size:22px;color:#E8FF3C;">New Update</h2>
                <p style="text-align:center;color:#8A8A99;margin:0 0 24px;font-size:14px;">From ${adminName}</p>
                <div style="background:#18181D;border-radius:12px;padding:20px;margin-bottom:16px;">
                  <p style="color:#E8E8EE;font-size:14px;margin:0;line-height:1.6;white-space:pre-wrap;">${text}</p>
                </div>
                <p style="color:#55555F;font-size:12px;text-align:center;margin:0;">View in the <a href="https://www.gymroamapp.com/gr-panel-7x9k" style="color:#E8FF3C;text-decoration:none;">Admin Dashboard</a></p>
              </div>
            `,
          },
        });
      }

      setNewUpdateText("");
      await loadUpdates();
      showToast("Update posted");
    } catch (e: unknown) {
      const err = e as { message?: string };
      showToast("Error: " + (err.message || "Unknown error"));
    }
    setPostingUpdate(false);
  };

  // --- Tasks actions ---

  const createTask = async () => {
    if (!newTask.title.trim()) return;
    setCreatingTask(true);
    try {
      await addDoc(collection(db, "tasks"), {
        title: newTask.title.trim(),
        description: newTask.description.trim(),
        assignedTo: newTask.assignedTo,
        assignedToEmail: newTask.assignedToEmail,
        status: "todo",
        priority: newTask.priority,
        createdBy: adminName,
        createdByEmail: adminEmail,
        createdAt: serverTimestamp(),
        completedAt: null,
      });
      setNewTask({
        title: "",
        description: "",
        assignedTo: "Alessandro",
        assignedToEmail: "gymroamapp@gmail.com",
        priority: "medium",
      });
      /* notify assignee via email */
      await addDoc(collection(db, "mail"), {
        to: [newTask.assignedToEmail],
        message: {
          subject: `GymRoam — New task assigned: ${newTask.title.trim()}`,
          html: `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;background:#111114;color:#E8E8EE;padding:32px;border-radius:16px;border:1px solid #E8FF3C;">
              <div style="text-align:center;margin-bottom:24px;">
                <div style="display:inline-block;width:40px;height:40px;background:#E8FF3C;border-radius:10px;line-height:40px;font-weight:900;font-size:20px;color:#0A0A0B;">G</div>
              </div>
              <h2 style="text-align:center;margin:0 0 8px;font-size:22px;color:#E8FF3C;">New Task Assigned</h2>
              <p style="text-align:center;color:#8A8A99;margin:0 0 24px;font-size:14px;">From ${adminName}</p>
              <div style="background:#18181D;border-radius:12px;padding:20px;margin-bottom:16px;">
                <h3 style="color:#E8E8EE;font-size:16px;margin:0 0 8px;">${newTask.title.trim()}</h3>
                ${newTask.description.trim() ? `<p style="color:#8A8A99;font-size:14px;margin:0 0 12px;line-height:1.6;">${newTask.description.trim()}</p>` : ""}
                <p style="margin:0;font-size:13px;color:#8A8A99;">
                  Priority: <strong style="color:#E8E8EE;">${newTask.priority.charAt(0).toUpperCase() + newTask.priority.slice(1)}</strong>
                  &nbsp;&middot;&nbsp; Assigned to: <strong style="color:#E8E8EE;">${newTask.assignedTo}</strong>
                </p>
              </div>
              <p style="color:#55555F;font-size:12px;text-align:center;margin:0;">View in the <a href="https://www.gymroamapp.com/gr-panel-7x9k" style="color:#E8FF3C;text-decoration:none;">Admin Dashboard</a></p>
            </div>
          `,
        },
      });

      setTaskModalOpen(false);
      await loadTasks();
      showToast("Task created — email sent to " + newTask.assignedTo);
    } catch (e: unknown) {
      const err = e as { message?: string };
      showToast("Error: " + (err.message || "Unknown error"));
    }
    setCreatingTask(false);
  };

  const updateTaskStatus = async (
    taskId: string,
    newStatus: "todo" | "in_progress" | "completed"
  ) => {
    try {
      const updateData: Record<string, unknown> = { status: newStatus };
      if (newStatus === "completed") {
        updateData.completedAt = serverTimestamp();
      } else {
        updateData.completedAt = null;
      }
      await updateDoc(doc(db, "tasks", taskId), updateData);
      await loadTasks();
      showToast(
        newStatus === "completed" ? "Task completed!" : "Status updated"
      );
    } catch (e: unknown) {
      const err = e as { message?: string };
      showToast("Error: " + (err.message || "Unknown error"));
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!window.confirm("Delete this task?")) return;
    try {
      await deleteDoc(doc(db, "tasks", taskId));
      await loadTasks();
      showToast("Task deleted");
    } catch (e: unknown) {
      const err = e as { message?: string };
      showToast("Error: " + (err.message || "Unknown error"));
    }
  };

  const priorityClass: Record<string, string> = {
    high: styles.priorityHigh,
    medium: styles.priorityMedium,
    low: styles.priorityLow,
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

  const activePendingCount =
    appPool === "gym" ? pendingCount : trainerPendingCount;

  return (
    <>
      <div className={styles.admin}>
        <div className={styles.adminHeader}>
          <h1>Admin Dashboard</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, color: "var(--dim)", fontWeight: 600 }}>
              {adminName}
            </span>
            <button className={styles.signOutBtn} onClick={doSignOut}>
              Sign Out
            </button>
          </div>
        </div>

        {/* ── Primary section navigation (6 tabs) ──
            Each tab owns a focused slice of admin work. The badge on
            the right of each label is a live count of items that
            currently need attention (pending pipeline apps, feedback
            under review, etc.) so the most actionable tabs surface
            their urgency at the nav level. */}
        <div className={styles.sectionNav}>
          {(
            [
              { key: "overview", label: "Overview", badge: 0 },
              {
                key: "users",
                label: "Users",
                badge: appUsersThisWeek + recentSignups,
              },
              {
                key: "pipeline",
                label: "Pipeline",
                badge:
                  pendingCount + trainerPendingCount + careerPendingCount,
              },
              {
                key: "feedback",
                label: "Feedback",
                badge: feedbackItems.filter(
                  (f) => f.status === "under review"
                ).length,
              },
              { key: "traffic", label: "Traffic", badge: 0 },
              {
                key: "team",
                label: "Team",
                badge: tasks.filter((t) => t.status === "todo").length,
              },
            ] as const
          ).map(({ key, label, badge }) => (
            <button
              key={key}
              className={`${styles.sectionTab} ${activeSection === key ? styles.sectionTabActive : ""}`}
              onClick={() => setActiveSection(key)}
            >
              {label}
              {badge > 0 && (
                <span
                  className={`${styles.badge} ${activeSection === key ? styles.badgeActive : ""}`}
                  style={{ marginLeft: 6 }}
                >
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ========== OVERVIEW SECTION ========== */}
        {activeSection === "overview" && (
        <>

        {/* Stats Grid */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>App Users</div>
            <div className={styles.statValue}>
              {appUsers.length || "\u2014"}
            </div>
            <div className={styles.statSub}>
              {appUsersThisWeek > 0
                ? `+${appUsersThisWeek} this week`
                : appUsers.length > 0
                  ? "Total signups"
                  : "No signups yet"}
            </div>
          </div>
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
            <div className={styles.statLabel}>Pending Gyms</div>
            <div className={styles.statValue}>{pendingCount || "\u2014"}</div>
            <div className={styles.statSub}>
              {approvedCount} approved
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Pending Trainers</div>
            <div className={styles.statValue}>
              {trainerPendingCount || "\u2014"}
            </div>
            <div className={styles.statSub}>
              {trainerApprovedCount} approved
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Feedback</div>
            <div className={styles.statValue}>
              {feedbackItems.length || "\u2014"}
            </div>
            <div className={styles.statSub}>
              {(() => {
                const review = feedbackItems.filter(
                  (f) => f.status === "under review"
                ).length;
                return review > 0
                  ? `${review} under review`
                  : "Feature requests";
              })()}
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Career Apps</div>
            <div className={styles.statValue}>
              {careerPendingCount || "\u2014"}
            </div>
            <div className={styles.statSub}>
              {careerApps.length} total
            </div>
          </div>
        </div>

        {/* \u2500\u2500 Needs Your Attention \u2500\u2500
            Quick-action queue pinned at the top of the Overview tab.
            Each row counts items that currently need triage; clicking
            it jumps to the exact section + sub-tab + status filter so
            you can act in one motion. Rows that have zero items are
            hidden so the queue doesn't read as a wall of zeros. */}
        {(() => {
          const reviewFeedback = feedbackItems.filter(
            (f) => f.status === "under review"
          ).length;
          const todoTasks = tasks.filter((t) => t.status === "todo").length;
          const items = [
            {
              show: pendingCount > 0,
              count: pendingCount,
              label: "pending gym partner application",
              go: () =>
                goToSection("pipeline", {
                  pipeline: "gym",
                  currentTab: "pending",
                }),
            },
            {
              show: trainerPendingCount > 0,
              count: trainerPendingCount,
              label: "pending trainer application",
              go: () =>
                goToSection("pipeline", {
                  pipeline: "trainer",
                  currentTab: "pending",
                }),
            },
            {
              show: careerPendingCount > 0,
              count: careerPendingCount,
              label: "pending career application",
              go: () =>
                goToSection("pipeline", {
                  pipeline: "career",
                  careerTab: "pending",
                }),
            },
            {
              show: reviewFeedback > 0,
              count: reviewFeedback,
              label: "feedback item under review",
              go: () =>
                goToSection("feedback", { feedbackTab: "under review" }),
            },
            {
              show: todoTasks > 0,
              count: todoTasks,
              label: "task to do",
              go: () => goToSection("team", { team: "tasks" }),
            },
          ].filter((x) => x.show);

          return (
            <>
              <div className={styles.sectionHeader}>
                <h2>Needs Your Attention</h2>
                {items.length === 0 && (
                  <span style={{ fontSize: 11, color: "var(--dim)" }}>
                    All clear \u2713
                  </span>
                )}
              </div>
              {items.length === 0 ? (
                <div className={styles.attentionAllClear}>
                  Nothing pending right now. Stats above show overall
                  health; check back when new submissions roll in.
                </div>
              ) : (
                <div className={styles.attentionList}>
                  {items.map((item, i) => (
                    <button
                      key={i}
                      className={styles.attentionItem}
                      onClick={item.go}
                    >
                      <span className={styles.attentionCount}>
                        {item.count}
                      </span>
                      <span className={styles.attentionLabel}>
                        {item.label}
                        {item.count !== 1 ? "s" : ""}
                      </span>
                      <span className={styles.attentionArrow}>\u2192</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          );
        })()}

        </>
        )}

        {/* ========== TRAFFIC SECTION ========== */}
        {activeSection === "traffic" && (
        <>

        {/* Website Traffic */}
        <div className={styles.sectionHeader}>
          <h2>Website Traffic</h2>
          <span style={{ fontSize: 11, color: "var(--dim)" }}>
            Last 7 days
          </span>
        </div>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Views Today</div>
            <div className={styles.statValue}>{viewsToday || "\u2014"}</div>
            <div className={styles.statSub}>Page views</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Unique Visitors</div>
            <div className={styles.statValue}>
              {uniqueVisitorsToday || "\u2014"}
            </div>
            <div className={styles.statSub}>Today</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Views This Week</div>
            <div className={styles.statValue}>{viewsWeek || "\u2014"}</div>
            <div className={styles.statSub}>Rolling 7 days</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Top Page Today</div>
            <div
              className={styles.statValue}
              style={{ fontSize: 18, wordBreak: "break-all" }}
            >
              {topPagePath}
            </div>
            <div className={styles.statSub}>
              {topPageCount > 0 ? `${topPageCount} views` : "No views yet"}
            </div>
          </div>
        </div>

        </>
        )}

        {/* ========== USERS SECTION ========== */}
        {activeSection === "users" && (
        <>

        {/* Users sub-tab navigation */}
        <div className={styles.subNav}>
          {(
            [
              {
                key: "app-users",
                label: "App Users",
                count: appUsers.length,
              },
              {
                key: "waitlist",
                label: "Waitlist",
                count: waitlistEntries.length,
              },
            ] as const
          ).map(({ key, label, count }) => (
            <button
              key={key}
              className={`${styles.subTab} ${usersTab === key ? styles.subTabActive : ""}`}
              onClick={() => setUsersTab(key)}
            >
              {label}
              {count > 0 && (
                <span
                  className={`${styles.badge} ${usersTab === key ? styles.badgeActive : ""}`}
                  style={{ marginLeft: 6 }}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Waitlist sub-tab content */}
        {usersTab === "waitlist" && (
        <>
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
        </>
        )}

        {/* App Users sub-tab content — placed AFTER the JSX sourced from
            the old Operations block flows naturally; the actual content
            lives further down (search for `<h2>App Users</h2>`). */}

        </>
        )}

        {/* ========== PIPELINE SECTION ========== */}
        {activeSection === "pipeline" && (
        <>

        {/* Pipeline sub-tab navigation */}
        <div className={styles.subNav}>
          {(
            [
              {
                key: "gym",
                label: "Gym Applications",
                count: pendingCount,
              },
              {
                key: "trainer",
                label: "Trainer Applications",
                count: trainerPendingCount,
              },
              {
                key: "career",
                label: "Career Applications",
                count: careerPendingCount,
              },
            ] as const
          ).map(({ key, label, count }) => (
            <button
              key={key}
              className={`${styles.subTab} ${pipelineTab === key ? styles.subTabActive : ""}`}
              onClick={() => setPipelineTab(key)}
            >
              {label}
              {count > 0 && (
                <span
                  className={`${styles.badge} ${pipelineTab === key ? styles.badgeActive : ""}`}
                  style={{ marginLeft: 6 }}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Gym + Trainer applications sub-tabs — share the existing
            appPool switcher logic. Setting pipelineTab to "gym" or
            "trainer" syncs appPool so the existing per-pool list +
            modal logic Just Works without rewiring. */}
        {(pipelineTab === "gym" || pipelineTab === "trainer") && (
        <>

        {/* Applications Section */}
        <div className={styles.sectionHeader}>
          <h2>Applications</h2>
        </div>

        {/* Pool switcher (Gym vs Trainer) */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${appPool === "gym" ? styles.tabActive : ""}`}
            onClick={() => setAppPool("gym")}
          >
            Gym Partners
            {pendingCount > 0 && (
              <span
                className={`${styles.badge} ${
                  appPool === "gym" ? styles.badgeActive : ""
                }`}
              >
                {pendingCount}
              </span>
            )}
          </button>
          <button
            className={`${styles.tab} ${appPool === "trainer" ? styles.tabActive : ""}`}
            onClick={() => setAppPool("trainer")}
          >
            Trainers
            {trainerPendingCount > 0 && (
              <span
                className={`${styles.badge} ${
                  appPool === "trainer" ? styles.badgeActive : ""
                }`}
              >
                {trainerPendingCount}
              </span>
            )}
          </button>
        </div>

        {/* Status tabs */}
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
                {tab === "pending" && activePendingCount > 0 && (
                  <span
                    className={`${styles.badge} ${
                      isActive ? styles.badgeActive : ""
                    }`}
                  >
                    {activePendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* GYM APPLICATIONS */}
        {appPool === "gym" && (
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
                      <div className={styles.appStatusStack}>
                        <span className={`${styles.appStatus} ${statusClass}`}>
                          {a.status}
                        </span>
                        {a.status === "approved" &&
                          (() => {
                            const active = a.subscriptionActive === true;
                            const canceled =
                              a.subscriptionStatus === "canceled" ||
                              a.subscriptionStatus === "incomplete_expired";
                            const label = active
                              ? "Paying"
                              : canceled
                              ? "Canceled"
                              : a.subscriptionStatus === "past_due"
                              ? "Past due"
                              : "Awaiting payment";
                            const cls = active
                              ? styles.subActive
                              : canceled || a.subscriptionStatus === "past_due"
                              ? styles.subCanceled
                              : styles.subPending;
                            return (
                              <span
                                className={`${styles.appStatus} ${cls}`}
                                title={
                                  a.subscriptionStatus
                                    ? `Stripe status: ${a.subscriptionStatus}`
                                    : "No Stripe subscription yet"
                                }
                              >
                                {label}
                              </span>
                            );
                          })()}
                      </div>
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
        )}

        {/* TRAINER APPLICATIONS */}
        {appPool === "trainer" && (
          <div className={styles.appList}>
            {filteredTrainers.length === 0 ? (
              <div className={styles.empty}>
                No {currentTab} trainer applications.
              </div>
            ) : (
              filteredTrainers.map((a) => {
                const statusClass = {
                  pending: styles.statusPending,
                  approved: styles.statusApproved,
                  rejected: styles.statusRejected,
                }[a.status];

                const meetsMin = (a.followerCount || 0) >= MIN_INSTAGRAM_FOLLOWERS;
                const handle = a.instagramHandle?.replace(/^@/, "") || "";

                return (
                  <div className={styles.appCard} key={a.id}>
                    <div className={styles.appTop}>
                      <div>
                        <div className={styles.appGym}>{a.fullName || ""}</div>
                        <div className={styles.appDate}>
                          {a.specialty} &middot;{" "}
                          {formatDate(a.createdAt, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                      </div>
                      <span className={`${styles.appStatus} ${statusClass}`}>
                        {a.status}
                      </span>
                    </div>

                    <div className={styles.appDetails}>
                      <div className={styles.appField}>
                        <div className={styles.appFieldLabel}>Email</div>
                        {a.email || ""}
                      </div>
                      <div className={styles.appField}>
                        <div className={styles.appFieldLabel}>Phone</div>
                        {a.phone || ""}
                      </div>
                      <div className={styles.appField}>
                        <div className={styles.appFieldLabel}>Location</div>
                        {a.city || ""}, {a.country || ""}
                      </div>
                      <div className={styles.appField}>
                        <div className={styles.appFieldLabel}>Experience</div>
                        {a.yearsExperience || "—"}
                      </div>
                      <div className={styles.appField}>
                        <div className={styles.appFieldLabel}>Instagram</div>
                        <a
                          href={`https://instagram.com/${handle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.websiteLink}
                        >
                          {a.instagramHandle || ""}
                        </a>
                      </div>
                      <div className={styles.appField}>
                        <div className={styles.appFieldLabel}>Followers</div>
                        <span
                          style={{
                            color: meetsMin ? "var(--green)" : "var(--red)",
                            fontWeight: 700,
                          }}
                        >
                          {(a.followerCount || 0).toLocaleString()}{" "}
                          {meetsMin ? "✓" : "✗ below min"}
                        </span>
                      </div>
                      {a.certifications && (
                        <div className={styles.appField}>
                          <div className={styles.appFieldLabel}>Certs</div>
                          {a.certifications}
                        </div>
                      )}
                      {a.rate && (
                        <div className={styles.appField}>
                          <div className={styles.appFieldLabel}>Rate</div>
                          {a.rate}
                        </div>
                      )}
                      {a.offersDropIns && (
                        <div className={styles.appField}>
                          <div className={styles.appFieldLabel}>Drop-ins</div>
                          {a.offersDropIns}
                        </div>
                      )}
                      {a.websiteOrLink && (
                        <div className={styles.appField}>
                          <div className={styles.appFieldLabel}>Link</div>
                          <a
                            href={
                              a.websiteOrLink.startsWith("http")
                                ? a.websiteOrLink
                                : `https://${a.websiteOrLink}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.websiteLink}
                          >
                            {a.websiteOrLink}
                          </a>
                        </div>
                      )}
                    </div>

                    <div className={styles.appVerify}>
                      <div className={styles.appFieldLabel}>Bio</div>
                      <p>{a.bio || "—"}</p>
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
                          onClick={() => openTrainerModal(a.id)}
                        >
                          Approve
                        </button>
                        <button
                          className={`${styles.actionBtn} ${styles.btnReject}`}
                          onClick={() => rejectTrainer(a.id)}
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
        )}

        </>
        )}

        </>
        )}

        {/* ── Users → App Users sub-tab content ──
            App Users JSX lives here in source order (legacy positioning
            inside the old Operations block, sandwiched between Trainer
            and Career applications). Conditionally rendered only when
            the Users tab + app-users sub-tab is active so it surfaces
            in the right logical home. */}
        {activeSection === "users" && usersTab === "app-users" && (
        <>

        {/* APP USERS — recent Firebase Auth signups from the iOS app.
            Bounded to the 100 most-recent users (orderBy createdAt desc
            in loadAppUsers). Empty today since the App Store just
            launched; populates as people onboard. */}
        <div className={styles.sectionHeader}>
          <h2>App Users</h2>
          <span style={{ fontSize: 11, color: "var(--dim)" }}>
            {appUsers.length > 0
              ? `${appUsers.length} recent · ${appUsersThisWeek} this week · ${appUsersThisMonth} this month`
              : "No signups yet — refresh after the first ones come in"}
          </span>
        </div>
        {/* Dense rows instead of tile cards — 5–8 users visible per
            screen at typical desktop heights vs. 1–2 with the old card
            layout. Avatar bubble shows the first character of the
            display name (or "?" if anonymous) so each row anchors
            visually. Hovering a row lights the background subtly so
            the eye can track which row it's on. */}
        <div className={styles.userTable}>
          {appUsers.length === 0 ? (
            <div className={styles.empty}>
              No app users yet. People who create an account in the iOS app
              will appear here, newest first.
            </div>
          ) : (
            <>
              {/* Column header — appears once above the row list. Mirrors
                  the row grid so labels align with the cell content. */}
              <div className={`${styles.userRow} ${styles.userRowHeader}`}>
                <span />
                <span>Name</span>
                <span>Email</span>
                <span>City</span>
                <span>Joined</span>
                <span style={{ textAlign: "right" }}>Status</span>
              </div>
              {appUsers.map((u) => {
                // Prefer the canonical Auth email; Firestore /users.email
                // may be missing or stale. Stays silent in the UI — no
                // orphan/disabled/provider badges (cluttered the table).
                // Auth detail still surfaces in the per-user detail modal.
                const authRec = authInfo[u.uid];
                const canonicalEmail = authRec?.email ?? u.email ?? null;
                const displayName =
                  u.displayName || u.username || canonicalEmail || u.uid;
                const initial =
                  (u.displayName?.[0] ||
                    u.username?.[0] ||
                    canonicalEmail?.[0] ||
                    "?").toUpperCase();
                return (
                  <div
                    className={styles.userRow}
                    key={u.uid}
                    title={`${u.uid} · click for details`}
                    onClick={() => setUserDetailUid(u.uid)}
                    style={{ cursor: "pointer" }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setUserDetailUid(u.uid);
                      }
                    }}
                  >
                    <div className={styles.userAvatar}>{initial}</div>
                    <div className={styles.userIdentity}>
                      <div className={styles.userName}>{displayName}</div>
                      <div className={styles.userHandle}>
                        {u.username
                          ? `@${u.username.replace(/^@+/, "")}`
                          : "no handle"}
                      </div>
                    </div>
                    <div className={styles.userEmail}>
                      {canonicalEmail ? (
                        <a
                          href={`mailto:${canonicalEmail}`}
                          className={styles.websiteLink}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {canonicalEmail}
                        </a>
                      ) : (
                        <span style={{ color: "var(--dim)" }}>—</span>
                      )}
                    </div>
                    <div className={styles.userCity}>
                      {u.homeCity || (
                        <span style={{ color: "var(--dim)" }}>—</span>
                      )}
                    </div>
                    <div className={styles.userDate}>
                      {u.createdAt
                        ? formatDate(u.createdAt, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : ""}
                    </div>
                    <div className={styles.userStatus}>
                      {u.isVerifiedCreator ? (
                        <span
                          className={`${styles.appStatus} ${styles.statusApproved}`}
                        >
                          ✓ verified
                          {u.verifiedCreatorTier
                            ? ` · ${u.verifiedCreatorTier}`
                            : ""}
                        </span>
                      ) : (
                        <span style={{ color: "var(--dim)", fontSize: 11 }}>
                          standard
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        </>
        )}

        {/* ── Pipeline → Career sub-tab content ── */}
        {activeSection === "pipeline" && pipelineTab === "career" && (
        <>

        {/* CAREER APPLICATIONS */}
        <div className={styles.sectionHeader}>
          <h2>Career Applications</h2>
          {careerPendingCount > 0 && (
            <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>
              {careerPendingCount} pending
            </span>
          )}
        </div>
        <div className={styles.tabs}>
          {(["pending", "reviewed"] as const).map((tab) => {
            const isActive = careerTab === tab;
            const count =
              tab === "pending"
                ? careerPendingCount
                : careerApps.filter((a) => a.status === "reviewed").length;
            return (
              <button
                key={tab}
                className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
                onClick={() => setCareerTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {count > 0 && (
                  <span
                    className={`${styles.badge} ${isActive ? styles.badgeActive : ""}`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className={styles.appList}>
          {filteredCareers.length === 0 ? (
            <div className={styles.empty}>No {careerTab} applications.</div>
          ) : (
            filteredCareers.map((a) => (
              <div className={styles.appCard} key={a.id}>
                <div className={styles.appTop}>
                  <div>
                    <div className={styles.appGym}>{a.fullName}</div>
                    <div className={styles.appDate}>
                      {a.roleTitle}
                      {a.createdAt && (
                        <>
                          {" · "}
                          {formatDate(a.createdAt, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </>
                      )}
                    </div>
                  </div>
                  <span
                    className={`${styles.appStatus} ${a.status === "reviewed" ? styles.statusApproved : styles.statusPending}`}
                  >
                    {a.status || "pending"}
                  </span>
                </div>

                <div className={styles.appDetails}>
                  <div className={styles.appField}>
                    <div className={styles.appFieldLabel}>Email</div>
                    <a href={`mailto:${a.email}`} className={styles.websiteLink}>
                      {a.email}
                    </a>
                  </div>
                  {a.city && (
                    <div className={styles.appField}>
                      <div className={styles.appFieldLabel}>City</div>
                      {a.city}
                    </div>
                  )}
                  {a.schoolName && (
                    <div className={styles.appField}>
                      <div className={styles.appFieldLabel}>School</div>
                      {a.schoolName}
                    </div>
                  )}
                  {a.coordinatorName && (
                    <div className={styles.appField}>
                      <div className={styles.appFieldLabel}>Coordinator</div>
                      {a.coordinatorName}
                    </div>
                  )}
                  {a.semester && (
                    <div className={styles.appField}>
                      <div className={styles.appFieldLabel}>Semester</div>
                      {a.semester}
                    </div>
                  )}
                  {a.creditEligible !== undefined && (
                    <div className={styles.appField}>
                      <div className={styles.appFieldLabel}>Credit eligible</div>
                      <span style={{ color: a.creditEligible ? "var(--green)" : "var(--red)", fontWeight: 700 }}>
                        {a.creditEligible ? "✓ Yes" : "✗ No"}
                      </span>
                    </div>
                  )}
                  {a.startDate && (
                    <div className={styles.appField}>
                      <div className={styles.appFieldLabel}>Earliest start</div>
                      {a.startDate}
                    </div>
                  )}
                  {a.instagramHandle && (
                    <div className={styles.appField}>
                      <div className={styles.appFieldLabel}>Instagram</div>
                      <a
                        href={`https://instagram.com/${a.instagramHandle.replace(/^@/, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.websiteLink}
                      >
                        @{a.instagramHandle.replace(/^@/, "")}
                      </a>
                    </div>
                  )}
                  {a.portfolioLink && (
                    <div className={styles.appField}>
                      <div className={styles.appFieldLabel}>Portfolio / reel</div>
                      <a
                        href={
                          a.portfolioLink.startsWith("http")
                            ? a.portfolioLink
                            : `https://${a.portfolioLink}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.websiteLink}
                      >
                        {a.portfolioLink}
                      </a>
                    </div>
                  )}
                  {a.aiTools && (
                    <div className={styles.appField}>
                      <div className={styles.appFieldLabel}>AI tools</div>
                      {a.aiTools}
                    </div>
                  )}
                </div>

                <div className={styles.appVerify}>
                  <div className={styles.appFieldLabel}>Why GymRoam</div>
                  <p>{a.why}</p>
                </div>

                <div className={styles.appActions}>
                  {(!a.status || a.status === "pending") ? (
                    <button
                      className={`${styles.actionBtn} ${styles.btnApprove}`}
                      onClick={() => markCareerReviewed(a.id, "reviewed")}
                    >
                      Mark Reviewed
                    </button>
                  ) : (
                    <button
                      className={`${styles.actionBtn} ${styles.btnReject}`}
                      onClick={() => markCareerReviewed(a.id, "pending")}
                    >
                      Move to Pending
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        </>
        )}

        {/* ========== FEEDBACK SECTION ========== */}
        {activeSection === "feedback" && (
        <>

        {/* FEEDBACK BOARD SUBMISSIONS — mirrors the Career Applications
            layout. The public /feedback page writes here; this view lets
            the admin read, triage, and progress items through the
            under-review → planned → in-progress → shipped lifecycle. */}
        <div className={styles.sectionHeader}>
          <h2>Feedback Board</h2>
          {(() => {
            const reviewCount = feedbackItems.filter(
              (f) => f.status === "under review"
            ).length;
            return reviewCount > 0 ? (
              <span
                style={{
                  fontSize: 11,
                  color: "var(--accent)",
                  fontWeight: 700,
                }}
              >
                {reviewCount} under review
              </span>
            ) : null;
          })()}
        </div>
        <div className={styles.tabs}>
          {(
            ["all", "under review", "planned", "in progress", "shipped"] as const
          ).map((tab) => {
            const isActive = feedbackTab === tab;
            const count =
              tab === "all"
                ? feedbackItems.length
                : feedbackItems.filter((f) => f.status === tab).length;
            const label =
              tab === "all"
                ? "All"
                : tab.charAt(0).toUpperCase() + tab.slice(1);
            return (
              <button
                key={tab}
                className={`${styles.tab} ${
                  isActive ? styles.tabActive : ""
                }`}
                onClick={() => setFeedbackTab(tab)}
              >
                {label}
                {count > 0 && (
                  <span
                    className={`${styles.badge} ${
                      isActive ? styles.badgeActive : ""
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className={styles.appList}>
          {(() => {
            const filteredFeedback =
              feedbackTab === "all"
                ? feedbackItems
                : feedbackItems.filter((f) => f.status === feedbackTab);
            if (filteredFeedback.length === 0) {
              return (
                <div className={styles.empty}>
                  No{" "}
                  {feedbackTab === "all"
                    ? ""
                    : `"${feedbackTab}" `}
                  feedback submissions yet.
                </div>
              );
            }
            return filteredFeedback.map((f) => {
              // Status pill class — one of four colors matching the public
              // /feedback board so the same item reads the same in both places.
              const statusPillClass =
                f.status === "under review"
                  ? styles.fbStatusReview
                  : f.status === "planned"
                  ? styles.fbStatusPlanned
                  : f.status === "in progress"
                  ? styles.fbStatusProgress
                  : styles.fbStatusShipped;
              return (
                <div className={styles.appCard} key={f.id}>
                  <div className={styles.appTop}>
                    <div>
                      <div className={styles.appGym}>{f.title}</div>
                      <div className={styles.appDate}>
                        {f.submittedBy || "Anonymous"}
                        {f.createdAt && (
                          <>
                            {" · "}
                            {formatDate(f.createdAt, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </>
                        )}
                      </div>
                    </div>
                    <span
                      className={`${styles.appStatus} ${statusPillClass}`}
                    >
                      {f.status}
                    </span>
                  </div>

                  {f.description && (
                    <div className={styles.appVerify}>
                      <div className={styles.appFieldLabel}>Description</div>
                      <p>{f.description}</p>
                    </div>
                  )}

                  <div className={styles.appDetails}>
                    <div className={styles.appField}>
                      <div className={styles.appFieldLabel}>Category</div>
                      {f.category || "Feature"}
                    </div>
                    <div className={styles.appField}>
                      <div className={styles.appFieldLabel}>Votes</div>
                      <span style={{ fontWeight: 700, color: "var(--accent)" }}>
                        {f.votes ?? 0}
                      </span>
                    </div>
                  </div>

                  {/* Status control + delete. The select changes status
                      immediately on pick — no extra "save" step — because
                      it mirrors the public board live. */}
                  <div className={styles.appActions}>
                    <label
                      className={styles.appFieldLabel}
                      htmlFor={`fb-status-${f.id}`}
                      style={{ marginRight: 8, alignSelf: "center" }}
                    >
                      Status
                    </label>
                    <select
                      id={`fb-status-${f.id}`}
                      className={styles.fbStatusSelect}
                      value={f.status}
                      onChange={(e) =>
                        updateFeedbackStatus(
                          f.id,
                          e.target.value as FeedbackStatus
                        )
                      }
                    >
                      <option value="under review">Under Review</option>
                      <option value="planned">Planned</option>
                      <option value="in progress">In Progress</option>
                      <option value="shipped">Shipped</option>
                    </select>
                    <button
                      className={`${styles.actionBtn} ${styles.btnReject}`}
                      onClick={() => deleteFeedbackItem(f.id)}
                      style={{ marginLeft: "auto" }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            });
          })()}
        </div>

        </>
        )}

        {/* ========== TEAM SECTION (Updates + Tasks) ========== */}
        {activeSection === "team" && (
        <>

        {/* Team sub-tab navigation */}
        <div className={styles.subNav}>
          {(
            [
              {
                key: "tasks",
                label: "Tasks",
                count: tasks.filter((t) => t.status === "todo").length,
              },
              {
                key: "updates",
                label: "Updates",
                count: updates.length,
              },
            ] as const
          ).map(({ key, label, count }) => (
            <button
              key={key}
              className={`${styles.subTab} ${teamTab === key ? styles.subTabActive : ""}`}
              onClick={() => setTeamTab(key)}
            >
              {label}
              {count > 0 && (
                <span
                  className={`${styles.badge} ${teamTab === key ? styles.badgeActive : ""}`}
                  style={{ marginLeft: 6 }}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Updates sub-tab content */}
        {teamTab === "updates" && (
        <>
          <div className={styles.sectionHeader}>
            <h2>Updates</h2>
          </div>

          {/* Post form */}
          <div className={styles.updateForm}>
            <textarea
              className={styles.updateInput}
              placeholder="Share an update with the team..."
              value={newUpdateText}
              onChange={(e) => setNewUpdateText(e.target.value)}
              rows={3}
            />
            <button
              className={styles.updatePostBtn}
              onClick={postUpdate}
              disabled={postingUpdate || !newUpdateText.trim()}
            >
              {postingUpdate ? "Posting..." : "Post Update"}
            </button>
          </div>

          {/* Feed */}
          <div className={styles.updateFeed}>
            {updates.length === 0 ? (
              <div className={styles.empty}>No updates yet. Post the first one!</div>
            ) : (
              updates.map((u) => (
                <div className={styles.updateCard} key={u.id}>
                  <div className={styles.updateMeta}>
                    <span className={styles.updateAuthor}>{u.author}</span>
                    <span className={styles.updateTime}>
                      {formatDate(u.createdAt, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className={styles.updateText}>{u.text}</div>
                </div>
              ))
            )}
          </div>
        </>
        )}

        {/* Tasks sub-tab content */}
        {teamTab === "tasks" && (
        <>
          <div className={styles.sectionHeader}>
            <h2>Tasks</h2>
            <button
              className={styles.exportBtn}
              onClick={() => setTaskModalOpen(true)}
            >
              + New Task
            </button>
          </div>

          {/* Status sub-tabs */}
          <div className={styles.tabs}>
            {(["todo", "in_progress", "completed"] as const).map((tab) => {
              const isActive = taskTab === tab;
              const count = tasks.filter((t) => t.status === tab).length;
              const label =
                tab === "todo"
                  ? "To Do"
                  : tab === "in_progress"
                  ? "In Progress"
                  : "Completed";
              return (
                <button
                  key={tab}
                  className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
                  onClick={() => setTaskTab(tab)}
                >
                  {label}
                  {count > 0 && (
                    <span
                      className={`${styles.badge} ${isActive ? styles.badgeActive : ""}`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Task cards */}
          <div className={styles.appList}>
            {tasks.filter((t) => t.status === taskTab).length === 0 ? (
              <div className={styles.empty}>
                No {taskTab === "todo" ? "to do" : taskTab === "in_progress" ? "in progress" : "completed"} tasks.
              </div>
            ) : (
              tasks
                .filter((t) => t.status === taskTab)
                .map((t) => (
                  <div className={styles.appCard} key={t.id}>
                    <div className={styles.appTop}>
                      <div>
                        <div className={styles.appGym}>{t.title}</div>
                        <div className={styles.appDate}>
                          Assigned to {t.assignedTo} &middot; Created by{" "}
                          {t.createdBy}
                        </div>
                      </div>
                      <span
                        className={`${styles.appStatus} ${priorityClass[t.priority] || ""}`}
                      >
                        {t.priority}
                      </span>
                    </div>

                    {t.description && (
                      <div className={styles.appVerify}>
                        <p>{t.description}</p>
                      </div>
                    )}

                    {t.status === "completed" && t.completedAt && (
                      <div className={styles.appDate} style={{ marginBottom: 12 }}>
                        Completed{" "}
                        {formatDate(t.completedAt, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                    )}

                    <div className={styles.appActions}>
                      {t.status === "todo" && (
                        <button
                          className={`${styles.actionBtn} ${styles.btnApprove}`}
                          onClick={() => updateTaskStatus(t.id, "in_progress")}
                        >
                          Start
                        </button>
                      )}
                      {t.status === "in_progress" && (
                        <button
                          className={`${styles.actionBtn} ${styles.btnApprove}`}
                          onClick={() => updateTaskStatus(t.id, "completed")}
                        >
                          Complete
                        </button>
                      )}
                      {t.status !== "todo" && (
                        <button
                          className={`${styles.actionBtn} ${styles.btnReject}`}
                          onClick={() => updateTaskStatus(t.id, "todo")}
                        >
                          Move to To Do
                        </button>
                      )}
                      {t.status === "completed" && (
                        <button
                          className={`${styles.actionBtn} ${styles.btnDelete}`}
                          onClick={() => deleteTask(t.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
        </>
        )}

        </>
        )}

      </div>

      {/* APP USER DETAIL MODAL — opens when an admin clicks a row in
          the App Users list. Shows full Firestore profile, Auth identity
          (when present), per-user stats, recent passport stamps, and
          the friends list. Backdrop click + Close button both dismiss. */}
      {userDetailUid && (() => {
        const u = appUsers.find((x) => x.uid === userDetailUid);
        if (!u) return null;
        const authRec = authInfo[userDetailUid];
        const canonicalEmail = authRec?.email ?? u.email ?? null;
        const displayName =
          u.displayName || u.username || canonicalEmail || u.uid;
        return (
          <div
            className={styles.modalOverlay}
            onClick={() => setUserDetailUid(null)}
          >
            <div
              className={styles.modal}
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: 680,
                maxHeight: "85vh",
                overflowY: "auto",
              }}
            >
              <h3>{displayName}</h3>
              <p className={styles.modalSubtitle}>
                {u.username
                          ? `@${u.username.replace(/^@+/, "")}`
                          : "no handle"}
                {" · "}
                <code style={{ fontSize: 11, color: "var(--dim)" }}>
                  {u.uid}
                </code>
              </p>

              {/* PROFILE */}
              <div style={{ marginTop: 16 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: "var(--dim)",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    marginBottom: 8,
                  }}
                >
                  Profile
                </div>
                <DetailRow label="Email">
                  {canonicalEmail ? (
                    <a
                      href={`mailto:${canonicalEmail}`}
                      className={styles.websiteLink}
                    >
                      {canonicalEmail}
                    </a>
                  ) : (
                    <span style={{ color: "var(--dim)" }}>—</span>
                  )}
                </DetailRow>
                <DetailRow label="Home city">
                  {u.homeCity || (
                    <span style={{ color: "var(--dim)" }}>—</span>
                  )}
                </DetailRow>
                <DetailRow label="Joined">
                  {u.createdAt
                    ? formatDate(u.createdAt, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : authRec?.createdAt
                      ? new Date(authRec.createdAt).toLocaleDateString()
                      : "—"}
                </DetailRow>
                <DetailRow label="Verified creator">
                  {u.isVerifiedCreator
                    ? `✓ yes${u.verifiedCreatorTier ? ` (${u.verifiedCreatorTier})` : ""}`
                    : "no"}
                </DetailRow>
              </div>

              {/* AUTH — always shown so it's clear WHY email is or
                  isn't populated. Three possible states:
                    1. authInfo populated + this UID present → real fields
                    2. authInfo populated + this UID missing → "no Auth
                       record for this UID" (true orphan in Auth)
                    3. authInfo never loaded (API failed / hasn't returned
                       yet) → "Auth lookup unavailable" notice */}
              <div style={{ marginTop: 20 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: "var(--dim)",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    marginBottom: 8,
                  }}
                >
                  Auth account
                  <span
                    style={{
                      marginLeft: 8,
                      fontWeight: 600,
                      letterSpacing: 0,
                      textTransform: "none",
                      color: "var(--dim)",
                    }}
                  >
                    — from Firebase Auth (canonical source for email)
                  </span>
                </div>
                {!authInfoLoaded ? (
                  <div style={{ color: "var(--dim)", fontSize: 13 }}>
                    Loading Auth roster…
                  </div>
                ) : authInfoError ? (
                  // API call failed entirely. Show the actual error so
                  // we can diagnose without DevTools.
                  <div
                    style={{
                      fontSize: 13,
                      padding: 12,
                      borderRadius: 8,
                      border: "1px solid var(--red, #FF4D6D)",
                      background: "rgba(255, 77, 109, 0.08)",
                      color: "var(--text)",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 800,
                        marginBottom: 6,
                        color: "var(--red, #FF4D6D)",
                      }}
                    >
                      Auth cross-reference failed
                      {authInfoError.status > 0 &&
                        ` (HTTP ${authInfoError.status})`}
                    </div>
                    <div
                      style={{
                        fontFamily: "monospace",
                        fontSize: 12,
                        color: "var(--dim)",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        maxHeight: 160,
                        overflowY: "auto",
                      }}
                    >
                      {authInfoError.body || "(no response body)"}
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 12,
                        color: "var(--dim)",
                      }}
                    >
                      Until this is fixed, no user's email or Auth
                      details will populate.
                    </div>
                  </div>
                ) : !authRec ? (
                  <div style={{ color: "var(--dim)", fontSize: 13 }}>
                    No matching Auth record for this UID
                    {authInfoCount > 0 &&
                      ` (${authInfoCount} Auth users scanned)`}
                    . The /users doc exists in Firestore but no Firebase
                    Auth account is associated with this user (likely a
                    leftover Firestore doc from a deleted Auth account,
                    partial signup, or test data).
                  </div>
                ) : (
                  <>
                    <DetailRow label="Sign-in providers">
                      {authRec.providers.length > 0
                        ? authRec.providers.join(", ")
                        : "—"}
                    </DetailRow>
                    <DetailRow label="Email verified">
                      {authRec.emailVerified ? "✓ yes" : "no"}
                    </DetailRow>
                    <DetailRow label="Last sign-in">
                      {authRec.lastSignIn
                        ? new Date(authRec.lastSignIn).toLocaleString()
                        : "—"}
                    </DetailRow>
                    <DetailRow label="Account state">
                      {authRec.disabled ? "disabled" : "active"}
                    </DetailRow>
                  </>
                )}
              </div>

              {/* STATS */}
              <div style={{ marginTop: 20 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: "var(--dim)",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    marginBottom: 8,
                  }}
                >
                  Stats
                </div>
                <DetailRow label="Passport stamps">
                  {userDetailLoading ? "loading…" : userWorkouts.length}
                </DetailRow>
                <DetailRow label="Friends">
                  {userDetailLoading ? "loading…" : userFriends.length}
                </DetailRow>
              </div>

              {/* RECENT STAMPS */}
              <div style={{ marginTop: 20 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: "var(--dim)",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    marginBottom: 8,
                  }}
                >
                  Recent stamps {userWorkouts.length > 10 ? `(top 10 of ${userWorkouts.length})` : ""}
                </div>
                {userDetailLoading ? (
                  <div style={{ color: "var(--dim)", fontSize: 13 }}>
                    Loading…
                  </div>
                ) : userWorkouts.length === 0 ? (
                  <div style={{ color: "var(--dim)", fontSize: 13 }}>
                    No stamps yet.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 6 }}>
                    {userWorkouts.slice(0, 10).map((w) => {
                      const ts =
                        (w.createdAt as FirestoreTimestamp | undefined) ??
                        (typeof w.timestamp === "number"
                          ? {
                              seconds: Math.floor(w.timestamp),
                              nanoseconds: 0,
                            }
                          : undefined);
                      return (
                        <div
                          key={w.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 13,
                            borderBottom: "1px solid var(--surface2)",
                            paddingBottom: 4,
                          }}
                        >
                          <span>
                            {(w.gymName as string) ||
                              (w.name as string) ||
                              (w.gymId as string) ||
                              w.id}
                            {(w.city as string) && (
                              <span style={{ color: "var(--dim)" }}>
                                {" · "}
                                {w.city as string}
                              </span>
                            )}
                          </span>
                          <span
                            style={{ color: "var(--dim)", fontSize: 12 }}
                          >
                            {ts
                              ? formatDate(ts, {
                                  month: "short",
                                  day: "numeric",
                                })
                              : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* FRIENDS */}
              <div style={{ marginTop: 20 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: "var(--dim)",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    marginBottom: 8,
                  }}
                >
                  Friends {userFriends.length > 20 ? `(top 20 of ${userFriends.length})` : ""}
                </div>
                {userDetailLoading ? (
                  <div style={{ color: "var(--dim)", fontSize: 13 }}>
                    Loading…
                  </div>
                ) : userFriends.length === 0 ? (
                  <div style={{ color: "var(--dim)", fontSize: 13 }}>
                    No friends yet.
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                    }}
                  >
                    {userFriends.slice(0, 20).map((f) => (
                      <span
                        key={f.id}
                        title={f.id}
                        style={{
                          fontSize: 12,
                          color: "var(--text)",
                          border: "1px solid var(--surface2)",
                          borderRadius: 6,
                          padding: "3px 8px",
                          background: "var(--surface)",
                        }}
                      >
                        {(f.displayName as string) ||
                          (f.username as string) ||
                          f.id.slice(0, 8)}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.modalActions} style={{ marginTop: 24 }}>
                <button
                  className={styles.btnCancel}
                  onClick={() => setUserDetailUid(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Gym Approve Modal */}
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

      {/* Trainer Approve Modal */}
      {trainerModalOpen && trainerModalApp && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Approve Trainer</h3>
            <p className={styles.modalSubtitle}>
              {trainerModalApp.fullName} &middot; {trainerModalApp.specialty}
            </p>

            <label className={styles.modalLabel}>Verify Instagram</label>
            <a
              href={`https://instagram.com/${trainerModalApp.instagramHandle?.replace(/^@/, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.websiteLink}
              style={{ display: "block", marginBottom: 8, fontSize: 14 }}
            >
              Open {trainerModalApp.instagramHandle} →
            </a>
            <p className={styles.passcodeHint} style={{ marginBottom: 12 }}>
              Claimed <strong>{trainerModalApp.followerCount.toLocaleString()}</strong>{" "}
              followers. Minimum: {MIN_INSTAGRAM_FOLLOWERS.toLocaleString()}.
            </p>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "var(--muted)",
                marginBottom: 16,
                cursor: "pointer",
                textTransform: "none",
                letterSpacing: "normal",
                fontWeight: 400,
              }}
            >
              <input
                type="checkbox"
                checked={instagramConfirmed}
                onChange={(e) => setInstagramConfirmed(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "var(--accent)" }}
              />
              I verified this Instagram account and follower count
            </label>

            <label className={styles.modalLabel}>Trainer&apos;s Email</label>
            <input
              className={styles.modalInput}
              type="email"
              value={trainerModalApp.email}
              readOnly
            />

            <label className={styles.modalLabel}>Temporary Passcode</label>
            <div className={styles.passcodeRow}>
              <div className={styles.passcodeDisplay}>{trainerPasscode}</div>
              <button className={styles.copyBtn} onClick={copyTrainerPasscode}>
                Copy
              </button>
            </div>
            <p className={styles.passcodeHint}>
              Trainer receives email with this passcode + instructions to
              subscribe in-app via Apple ({TRAINER_PRO_PRICE}).
            </p>

            <div className={styles.modalActions}>
              <button
                className={styles.btnCancel}
                onClick={closeTrainerModal}
              >
                Cancel
              </button>
              <button
                className={styles.btnConfirm}
                onClick={confirmTrainerApprove}
                disabled={trainerApproving || !instagramConfirmed}
              >
                {trainerApproving ? "Approving..." : "Approve & Send Email"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Task Modal */}
      {taskModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>New Task</h3>
            <p className={styles.modalSubtitle}>Create a task for the team</p>

            <label className={styles.modalLabel}>Title</label>
            <input
              className={styles.modalInput}
              placeholder="Task title"
              value={newTask.title}
              onChange={(e) =>
                setNewTask({ ...newTask, title: e.target.value })
              }
            />

            <label className={styles.modalLabel}>Description</label>
            <textarea
              className={styles.modalInput}
              placeholder="Optional description"
              value={newTask.description}
              onChange={(e) =>
                setNewTask({ ...newTask, description: e.target.value })
              }
              rows={3}
              style={{ resize: "vertical" }}
            />

            <label className={styles.modalLabel}>Assign To</label>
            <select
              className={styles.modalInput}
              value={newTask.assignedTo}
              onChange={(e) => {
                const name = e.target.value;
                const email =
                  name === "Alessandro"
                    ? "gymroamapp@gmail.com"
                    : "kevin@aigrowthhouse.com";
                setNewTask({
                  ...newTask,
                  assignedTo: name,
                  assignedToEmail: email,
                });
              }}
            >
              <option value="Alessandro">Alessandro</option>
              <option value="Kevin">Kevin</option>
            </select>

            <label className={styles.modalLabel}>Priority</label>
            <select
              className={styles.modalInput}
              value={newTask.priority}
              onChange={(e) =>
                setNewTask({
                  ...newTask,
                  priority: e.target.value as "low" | "medium" | "high",
                })
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>

            <div className={styles.modalActions}>
              <button
                className={styles.btnCancel}
                onClick={() => setTaskModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className={styles.btnConfirm}
                onClick={createTask}
                disabled={creatingTask || !newTask.title.trim()}
              >
                {creatingTask ? "Creating..." : "Create Task"}
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
