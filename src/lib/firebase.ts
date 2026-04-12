import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB9BRB-kO_LKsBj1-h7142ejbWyskwsMAQ",
  authDomain: "gymroam-ad7dc.firebaseapp.com",
  projectId: "gymroam-ad7dc",
  storageBucket: "gymroam-ad7dc.firebasestorage.app",
  messagingSenderId: "882063435578",
  appId: "1:882063435578:web:waitlist",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
