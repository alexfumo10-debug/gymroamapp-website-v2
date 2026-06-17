/**
 * Auth gate + data-loading hooks for the v2 dashboard.
 *
 * Mirrors the auth approach the live page.tsx already uses (Firebase
 * client SDK, email/password sign-in, ADMIN_EMAILS allowlist) but
 * packaged as reusable hooks so each tab/component can pull exactly
 * the data it needs without a 3,500-line god-component.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { db, auth } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit as fsLimit,
  type QueryConstraint,
} from "firebase/firestore";
import type { AuthUserInfo, LoadState } from "./types";

export const ADMIN_EMAILS = [
  "gymroamapp@gmail.com",
  "kevin@aigrowthhouse.com",
];

export const ADMIN_NAMES: Record<string, string> = {
  "gymroamapp@gmail.com": "Alessandro",
  "kevin@aigrowthhouse.com": "Kevin",
};

interface AdminAuth {
  ready: boolean; // initial auth-state check finished
  isAdmin: boolean;
  email: string;
  name: string;
  /** Returns a fresh Firebase ID token for server-route calls. */
  getIdToken: () => Promise<string | null>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  doSignOut: () => Promise<void>;
  signInError: string;
  signingIn: boolean;
}

export function useAdminAuth(): AdminAuth {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [signInError, setSignInError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
    return () => unsub();
  }, []);

  const email = (user?.email || "").toLowerCase();
  const isAdmin = !!user && ADMIN_EMAILS.includes(email);

  const signInWithPassword = useCallback(
    async (e: string, password: string) => {
      setSigningIn(true);
      setSignInError("");
      try {
        const cred = await signInWithEmailAndPassword(
          auth,
          e.trim().toLowerCase(),
          password
        );
        if (!ADMIN_EMAILS.includes((cred.user.email || "").toLowerCase())) {
          await signOut(auth);
          setSignInError("This account isn't an admin.");
        }
      } catch {
        setSignInError("Invalid email or password.");
      }
      setSigningIn(false);
    },
    []
  );

  const doSignOut = useCallback(async () => {
    await signOut(auth);
  }, []);

  const getIdToken = useCallback(async () => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  }, []);

  return {
    ready,
    isAdmin,
    email,
    name: ADMIN_NAMES[email] || "Admin",
    getIdToken,
    signInWithPassword,
    doSignOut,
    signInError,
    signingIn,
  };
}

/* ────────────────────────────────────────────────────────────
   Generic Firestore collection loader.
   ──────────────────────────────────────────────────────────── */

interface CollectionOptions {
  /** Field to orderBy (omit to skip ordering — e.g. /users has no
      reliable createdAt on every doc). */
  orderField?: string;
  orderDir?: "asc" | "desc";
  max?: number;
  /** Only load once `enabled` is true (e.g. after auth resolves). */
  enabled?: boolean;
}

interface CollectionResult<T> {
  data: T[];
  state: LoadState;
  error: string;
  reload: () => void;
}

/**
 * Load a whole Firestore collection (client SDK), typed as T[]. Each
 * doc becomes `{ id, ...data }`. Re-runs when `enabled` flips true.
 */
export function useCollection<T>(
  name: string,
  options: CollectionOptions = {}
): CollectionResult<T> {
  const { orderField, orderDir = "desc", max, enabled = true } = options;
  const [data, setData] = useState<T[]>([]);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState("");
  // Stable key so the effect re-fires only on real option changes.
  const optsKey = `${name}|${orderField || ""}|${orderDir}|${max || ""}`;
  const reloadTick = useRef(0);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => {
    reloadTick.current += 1;
    setTick(reloadTick.current);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState("loading");
    (async () => {
      try {
        const constraints: QueryConstraint[] = [];
        if (orderField) constraints.push(orderBy(orderField, orderDir));
        if (max) constraints.push(fsLimit(max));
        const ref = collection(db, name);
        const snap = await getDocs(
          constraints.length ? query(ref, ...constraints) : ref
        );
        if (cancelled) return;
        const rows: T[] = [];
        snap.forEach((d) => rows.push({ id: d.id, ...d.data() } as T));
        setData(rows);
        setState("ready");
      } catch (e) {
        if (cancelled) return;
        console.error(`useCollection(${name}) error:`, e);
        setError((e as { message?: string })?.message || "Load failed");
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optsKey, enabled, tick]);

  return { data, state, error, reload };
}

/* ────────────────────────────────────────────────────────────
   Firebase Auth cross-reference (canonical email + orphan flag).
   ──────────────────────────────────────────────────────────── */

export function useAuthUsers(
  getIdToken: () => Promise<string | null>,
  enabled: boolean
): { map: Record<string, AuthUserInfo>; state: LoadState } {
  const [map, setMap] = useState<Record<string, AuthUserInfo>>({});
  const [state, setState] = useState<LoadState>("idle");

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState("loading");
    (async () => {
      try {
        const token = await getIdToken();
        if (!token) throw new Error("no token");
        const res = await fetch("/api/admin/users-auth", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        setMap(json.users || {});
        setState("ready");
      } catch (e) {
        if (cancelled) return;
        console.error("useAuthUsers error:", e);
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { map, state };
}

/* ────────────────────────────────────────────────────────────
   Generic authed GET to an /api/admin/* route.
   ──────────────────────────────────────────────────────────── */

export function useAdminApi<T>(
  path: string,
  getIdToken: () => Promise<string | null>,
  enabled: boolean
): { data: T | null; state: LoadState; error: string } {
  const [data, setData] = useState<T | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState("loading");
    (async () => {
      try {
        const token = await getIdToken();
        if (!token) throw new Error("no token");
        const res = await fetch(path, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json?.error || `${res.status}`);
          setData(json); // may still carry { configured } for the UI
          setState("error");
          return;
        }
        setData(json);
        setState("ready");
      } catch (e) {
        if (cancelled) return;
        console.error(`useAdminApi(${path}) error:`, e);
        setError((e as Error).message);
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled]);

  return { data, state, error };
}
