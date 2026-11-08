"use client";

import Link from "next/link";

import Logo from "@/components/ui/Logo";

export default function NotFound() {
  return (
    <main id="main-content" tabIndex={-1} className="error-page">
      <Logo size={72} className="mx-auto rounded-xl bg-white p-1 object-contain" />
      <p className="error-code">404</p>
      <h1>{"Page not found"}</h1>
      <p>{"The page you are looking for could not be found."}</p>
      <Link href="/">{"Go to home page"}</Link>
    </main>
  );
}
