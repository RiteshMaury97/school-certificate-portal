import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/src/lib/firebase-admin";
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};
export default async function NotFound() {
  let schoolName = "School",
    email = "",
    phone = "";
  try {
    const settings = await db.collection("siteSettings").doc("main").get();
    schoolName = String(settings.get("schoolName") || schoolName);
    email = String(settings.get("email") || "");
    phone = String(settings.get("phone") || "");
  } catch {
    /* fallback page */
  }
  return (
    <main id="main-content" tabIndex={-1} className="error-page">
      <p className="error-code">404</p>
      <h1>Page not found</h1>
      <p>The page may have moved, or the address may be incorrect.</p>
      <Link href="/">Return to home</Link>
      <p className="error-support">
        {schoolName} support:{" "}
        {email ? <a href={`mailto:${email}`}>{email}</a> : null}{" "}
        {phone ? <a href={`tel:${phone}`}>{phone}</a> : null}
      </p>
    </main>
  );
}
