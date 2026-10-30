"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/src/lib/firebase-client";
export function useAdminSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(
    () =>
      onAuthStateChanged(auth, (current) => {
        setUser(current);
        setLoading(false);
      }),
    [],
  );
  return { user, loading, authenticated: Boolean(user) };
}
