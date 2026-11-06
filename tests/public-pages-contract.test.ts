import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("public certificate portal page contracts", () => {
  it("home page includes the primary journeys and content sections", async () => {
    const source = await readFile("src/features/home/HomeView.tsx", "utf8");
    for (const text of [
      "Find my certificates",
      "Verify a certificate",
      "How it works",
      'title: "Find my certificates"',
      'title: "Verify a certificate"',
      'href: "/faq"',
    ]) {
      expect(source).toContain(text);
    }
  });
  it("certificate search uses published sessions, consent and inline duplicate challenge", async () => {
    const source = await readFile("src/features/certificates/FinderView.tsx", "utf8");
    expect(source).toContain("/api/public/sessions");
    expect(source).toContain("sessions.length === 0");
    expect(source).toContain("form.consent");
    expect(source).toContain("challengeToken");
    expect(source).toContain("disambiguationValue");
    expect(source).toContain('router.push("/certificates/results"');
  });
  it("results are guarded and include ZIP, print, feedback and search again", async () => {
    const source = await readFile("src/features/certificates/ResultsView.tsx", "utf8");
    for (const text of [
      'router.replace("/certificates"',
      "Download certificate",
      "Print summary",
      "FeedbackWidget",
      "Back to certificate search",
    ]) {
      expect(source).toContain(text);
    }
  });
  it("data rights supports consent withdrawal and wrong-record reports have their own page", async () => {
    const page = await readFile("src/features/info/InformationView.tsx", "utf8");
    expect(page).toContain("Withdraw consent");
    expect(page).toContain("withdrawal of consent");
    expect(page).toContain("Submit a request");
  });
  it("verification labels replaced and revoked states and masks student details server-side", async () => {
    const page = await readFile("src/features/verify/VerifyView.tsx", "utf8");
    const route = await readFile("src/app/api/certificates/verify/route.ts", "utf8");
    expect(page).toContain("Certificate replaced");
    expect(page).toContain("Certificate revoked");
    expect(route).toContain("maskStudentName(studentName)");
  });
});
