"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  serverTimestamp,
  onSnapshot,
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

interface Message {
  id: string;
  author: string;
  authorEmail: string;
  text: string;
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
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");

  // Section navigation
  const [activeSection, setActiveSection] = useState<"operations" | "updates" | "tasks" | "messages">("operations");

  // Data state
  const [applications, setApplications] = useState<Application[]>([]);
  const [trainerApps, setTrainerApps] = useState<TrainerApplication[]>([]);
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  const [feedbackCount, setFeedbackCount] = useState<number | null>(null);

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

  // Messages state
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessageText, setNewMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

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

  const loadFeedbackCount = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, "feedback"));
      setFeedbackCount(snap.size);
    } catch (e) {
      console.error("Feedback load error:", e);
      setFeedbackCount(0);
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

  // loadMessages is kept for initial load; real-time sync handled by onSnapshot below
  const loadMessages = useCallback(() => {}, []);

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
    setFeedbackCount(null);
    setUpdates([]);
    setTasks([]);
    setMessages([]);
  };

  // Load data after login
  useEffect(() => {
    if (isLoggedIn) {
      loadApplications();
      loadTrainerApplications();
      loadWaitlist();
      loadFeedbackCount();
      loadUpdates();
      loadTasks();
    }
  }, [
    isLoggedIn,
    loadApplications,
    loadTrainerApplications,
    loadWaitlist,
    loadFeedbackCount,
    loadUpdates,
    loadTasks,
    loadMessages,
  ]);

  // Real-time messages listener
  useEffect(() => {
    if (!isLoggedIn) return;
    const q = query(collection(db, "messages"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const msgs: Message[] = [];
      snap.forEach((d) => msgs.push({ id: d.id, ...d.data() } as Message));
      setMessages(msgs);
    }, (err) => {
      console.error("Messages realtime error:", err);
    });
    return () => unsub();
  }, [isLoggedIn]);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  const weekAgo = Date.now() / 1000 - 7 * 24 * 60 * 60;
  const recentSignups = waitlistEntries.filter(
    (e) => (e.createdAt?.seconds || 0) > weekAgo
  ).length;

  const filteredApps = applications.filter((a) => a.status === currentTab);
  const filteredTrainers = trainerApps.filter((a) => a.status === currentTab);

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

  // --- Messages actions ---

  const postMessage = async () => {
    const text = newMessageText.trim();
    if (!text) return;
    setSendingMessage(true);
    try {
      await addDoc(collection(db, "messages"), {
        author: adminName,
        authorEmail: adminEmail,
        text,
        createdAt: serverTimestamp(),
      });
      setNewMessageText("");
    } catch (e: unknown) {
      const err = e as { message?: string };
      showToast("Error: " + (err.message || "Unknown error"));
    }
    setSendingMessage(false);
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

        {/* Section Navigation */}
        <div className={styles.sectionNav}>
          {(["operations", "updates", "tasks", "messages"] as const).map((section) => (
            <button
              key={section}
              className={`${styles.sectionTab} ${activeSection === section ? styles.sectionTabActive : ""}`}
              onClick={() => setActiveSection(section)}
            >
              {section.charAt(0).toUpperCase() + section.slice(1)}
            </button>
          ))}
        </div>

        {/* ========== OPERATIONS SECTION ========== */}
        {activeSection === "operations" && (
        <>

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

        {/* ========== UPDATES SECTION ========== */}
        {activeSection === "updates" && (
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

        {/* ========== TASKS SECTION ========== */}
        {activeSection === "tasks" && (
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

        {/* ========== MESSAGES SECTION ========== */}
        {activeSection === "messages" && (
        <>
          <div className={styles.sectionHeader}>
            <h2>Messages</h2>
          </div>

          {/* Chat thread */}
          <div className={styles.chatThread}>
            {messages.length === 0 ? (
              <div className={styles.empty}>No messages yet. Start the conversation!</div>
            ) : (
              messages.map((m) => {
                const isMe = m.authorEmail === adminEmail;
                return (
                  <div
                    className={`${styles.chatBubbleRow} ${isMe ? styles.chatBubbleRowMe : ""}`}
                    key={m.id}
                  >
                    <div
                      className={`${styles.chatBubble} ${isMe ? styles.chatBubbleMe : styles.chatBubbleThem}`}
                    >
                      {!isMe && (
                        <div className={styles.chatAuthor}>{m.author}</div>
                      )}
                      <div className={styles.chatText}>{m.text}</div>
                      <div className={styles.chatTime}>
                        {formatDate(m.createdAt, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Message input */}
          <div className={styles.chatInputRow}>
            <input
              className={styles.chatInput}
              placeholder="Type a message..."
              value={newMessageText}
              onChange={(e) => setNewMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  postMessage();
                }
              }}
            />
            <button
              className={styles.chatSendBtn}
              onClick={postMessage}
              disabled={sendingMessage || !newMessageText.trim()}
            >
              {sendingMessage ? "..." : "Send"}
            </button>
          </div>
        </>
        )}

      </div>

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
