import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("public certificate portal page contracts", () => {
  it("home page includes the primary journeys and content sections", async () => {
    const source = await readFile("src/screens/HomePage.tsx", "utf8");
    for (const text of [
      "Find My Certificates",
      "Verify a Certificate",
      "How it works",
      "Principal’s message",
      "Frequently asked questions",
      'to="/faq"',
    ]) {
      expect(source).toContain(text);
    }
  });
  it("certificate search uses published sessions, consent and inline duplicate challenge", async () => {
    const source = await readFile("src/screens/FinderPage.tsx", "utf8");
    expect(source).toContain("/api/public/sessions");
    expect(source).toContain("sessions.length === 0");
    expect(source).toContain("form.consent");
    expect(source).toContain("challengeToken");
    expect(source).toContain("disambiguationValue");
    expect(source).toContain('navigate("/certificates/results"');
  });
  it("results are guarded and include ZIP, print, feedback and search again", async () => {
    const source = await readFile("src/screens/ResultsPage.tsx", "utf8");
    for (const text of [
      'navigate("/certificates"',
      "Download all (ZIP)",
      "Print view",
      "FeedbackWidget",
      "Search again",
      "noindex, nofollow, noarchive",
    ]) {
      expect(source).toContain(text);
    }
  });
  it("data rights supports consent withdrawal and wrong-record reports have their own page", async () => {
    const route = await readFile("app/api/public/data-rights/route.ts", "utf8");
    const page = await readFile("src/screens/InformationPage.tsx", "utf8");
    expect(route).toContain("withdraw_consent");
    expect(page).toContain("/api/public/report");
    expect(page).toContain("/api/public/data-rights");
    expect(page).toContain("acknowledgmentId");
    expect(page).toContain("referenceId");
  });
  it("verification labels replaced and revoked states and masks student details server-side", async () => {
    const page = await readFile("src/screens/VerifyPage.tsx", "utf8");
    const route = await readFile("app/api/certificates/verify/route.ts", "utf8");
    expect(page).toContain("Certificate replaced");
    expect(page).toContain("Certificate revoked");
    expect(route).toContain("maskStudentName(studentName)");
  });
});
