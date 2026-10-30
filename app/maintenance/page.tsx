import Link from "next/link";
import { db } from "@/src/lib/firebase-admin";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Service unavailable",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function MaintenancePage() {
  let school = "School Certificate Portal",
    email = "",
    phone = "";
  try {
    const doc = await db.collection("siteSettings").doc("main").get();
    school = String(doc.get("schoolName") || school);
    email = String(doc.get("email") || "");
    phone = String(doc.get("phone") || "");
  } catch {
    /* safe fallback */
  }
  return (
    <main id="main-content" tabIndex={-1} className="error-page">
      <p className="error-code">503</p>
      <h1>We’ll be back soon</h1>
      <p>
        {school} is temporarily unavailable while scheduled maintenance is in
        progress.
      </p>
      <Link href="/admin/login">Staff sign in</Link>
      <p className="error-support">
        {email ? <a href={`mailto:${email}`}>{email}</a> : null}{" "}
        {phone ? <a href={`tel:${phone}`}>{phone}</a> : null}
      </p>
    </main>
  );
}
