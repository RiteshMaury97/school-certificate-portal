"use client";
import { useState, type FormEvent } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/src/lib/firebase-client";
export default function EmailLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setError("Unable to sign in. Check your credentials and try again.");
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-medium">
        Email
        <input
          translate="no"
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 min-h-11 w-full rounded-lg border px-3"
        />
      </label>
      <label className="block text-sm font-medium">
        Password
        <input
          translate="no"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 min-h-11 w-full rounded-lg border px-3"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button className="min-h-11 w-full rounded-lg bg-[var(--primary)] px-4 font-semibold text-[var(--primary-contrast)]">
        Sign in
      </button>
    </form>
  );
}
