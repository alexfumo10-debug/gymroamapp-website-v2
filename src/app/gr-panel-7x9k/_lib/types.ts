/**
 * Shared types for the v2 admin dashboard.
 *
 * The Firestore-backed shapes (AppUser, FeedbackItem, the three
 * Application kinds, PageView) are kept in sync with what the live
 * page.tsx and the public submission forms actually write. The
 * external-source shapes (subscriptions, ads, reviews, social,
 * crashes) describe the normalized data each connect-ready tab will
 * render once its integration is wired — defined now so the UI and
 * the future API routes share one contract.
 */

export interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
}

/* ────────────────────────────────────────────────────────────
   LIVE SOURCES — already in Firestore today
   ──────────────────────────────────────────────────────────── */

export interface AppUser {
  uid: string;
  email?: string;
  displayName?: string;
  username?: string;
  photoURL?: string;
  homeCity?: string;
  isVerifiedCreator?: boolean;
  verifiedCreatorTier?: string | null;
  createdAt?: FirestoreTimestamp;
  updatedAt?: number; // iOS writes epoch seconds on every save
}

/** Canonical Firebase Auth identity, from /api/admin/users-auth. */
export interface AuthUserInfo {
  email: string | null;
  emailVerified: boolean;
  providers: string[];
  lastSignIn: string | null;
  createdAt: string | null;
  disabled: boolean;
}

export type FeedbackStatus =
  | "under review"
  | "planned"
  | "in progress"
  | "shipped";

export interface FeedbackItem {
  id: string;
  title: string;
  description?: string;
  category?: string;
  submittedBy?: string;
  votes?: number;
  status: FeedbackStatus;
  createdAt?: FirestoreTimestamp;
  reviewedAt?: FirestoreTimestamp;
}

export interface PageView {
  id: string;
  path: string;
  sessionId: string;
  referrer?: string;
  createdAt?: FirestoreTimestamp;
}

export interface GymApplication {
  id: string;
  status: "pending" | "approved" | "rejected";
  gymName: string;
  ownerName: string;
  ownerEmail: string;
  gymType: string;
  gymCity: string;
  gymState: string;
  subscriptionActive?: boolean;
  subscriptionStatus?: string;
  createdAt?: FirestoreTimestamp;
}

export interface TrainerApplication {
  id: string;
  status: "pending" | "approved" | "rejected";
  fullName: string;
  email: string;
  city: string;
  instagramHandle: string;
  followerCount: number;
  specialty: string;
  paymentStatus?: "unpaid" | "paid";
  createdAt?: FirestoreTimestamp;
}

export interface CareerApplication {
  id: string;
  status: "pending" | "reviewed";
  roleTitle: string;
  fullName: string;
  email: string;
  city?: string;
  createdAt?: FirestoreTimestamp;
}

/* ────────────────────────────────────────────────────────────
   EXTERNAL SOURCES — normalized contracts for connect-ready tabs.
   These are what each tab renders; the matching /api/admin/<source>
   route will return this shape once the integration is wired.
   ──────────────────────────────────────────────────────────── */

/** A single subscription tier's current state + recent movement. */
export interface SubscriptionTierStat {
  tier: string; // "Pro" | "Pro+" | "Gym Partner" | "Trainer Pro"
  activeCount: number;
  mrr: number; // monthly recurring revenue in USD
  newThisMonth: number;
  canceledThisMonth: number;
}

export interface SubscriptionEvent {
  id: string;
  tier: string;
  type: "purchase" | "renewal" | "cancellation" | "refund";
  amount: number;
  email?: string;
  at: number; // epoch ms
}

/** One Meta ad/post's performance. */
export interface AdStat {
  id: string;
  name: string;
  thumbnailUrl?: string;
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number; // %
  cpc: number; // $
  conversions?: number;
}

export interface Review {
  id: string;
  author: string;
  rating: number; // 1-5
  title?: string;
  body: string;
  territory?: string; // "US", "GB", ...
  appVersion?: string;
  at: number; // epoch ms
}

export interface SocialStat {
  platform: "instagram";
  followers: number;
  followingDelta7d: number; // net new followers, last 7 days
  posts: number;
  engagementRate?: number; // %
}

export interface CrashStat {
  id: string;
  title: string; // e.g. "EXC_BAD_ACCESS in MapView.swift:142"
  occurrences: number;
  usersAffected: number;
  appVersion: string;
  lastSeen: number; // epoch ms
  fatal: boolean;
}

/* ────────────────────────────────────────────────────────────
   GENERIC
   ──────────────────────────────────────────────────────────── */

/** A simple {label,value} datum for charts. */
export interface SeriesPoint {
  label: string;
  value: number;
  /** Optional ISO date for time-series x-axis sorting. */
  date?: string;
}

export type LoadState = "idle" | "loading" | "ready" | "error";
