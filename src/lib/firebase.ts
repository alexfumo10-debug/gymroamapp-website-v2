import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  // Browser key (auto created by Firebase) for project gymroam-ad7dc.
  // The previously-set key (AIzaSyB9...) was the iOS-restricted one —
  // all web auth requests failed with `auth/requests-from-this-ios-
  // client-application-<empty>-are-blocked`. The iOS key stays
  // iOS-restricted (correct); the website uses the Browser key.
  apiKey: "AIzaSyDVFT7KDRiAikE_yGpeBLDc5pLsq3Cy9_g",
  authDomain: "gymroam-ad7dc.firebaseapp.com",
  projectId: "gymroam-ad7dc",
  storageBucket: "gymroam-ad7dc.firebasestorage.app",
  messagingSenderId: "882063435578",
  appId: "1:882063435578:web:waitlist",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
