"use client";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";

import { auth } from "@/src/lib/firebase-client";
export default function GoogleLoginButton() {
  return (
    <button
      type="button"
      onClick={() => void signInWithPopup(auth, new GoogleAuthProvider())}
      className="min-h-11 w-full rounded-lg border border-slate-300 px-4 font-semibold"
    >
      Continue with Google
    </button>
  );
}
