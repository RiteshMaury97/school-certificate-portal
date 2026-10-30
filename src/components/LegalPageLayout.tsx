import type { ReactNode } from "react";
import SiteShell from "@/src/components/SiteShell";
import { useTranslation } from "react-i18next";

export type LegalSection = { id: string; title: string; content: ReactNode };
export default function LegalPageLayout({
  title,
  subtitle,
  version,
  updated,
  sections,
  children,
  extraToc,
}: {
  title: string;
  subtitle: string;
  version: string;
  updated: string;
  sections: LegalSection[];
  children?: ReactNode;
  extraToc?: { id: string; title: string };
}) {
  const { i18n } = useTranslation();
  const hindi = i18n.language.startsWith("hi");
  const titleHi: Record<string, string> = {
    "Terms & Conditions": "नियम और शर्तें",
    "Privacy Policy": "गोपनीयता नीति",
  };
  const subtitleHi: Record<string, string> = {
    "Rules for responsible use of the School’s certificate retrieval service.":
      "विद्यालय की प्रमाणपत्र सेवा के जिम्मेदार उपयोग के नियम।",
    "How the School collects, uses, protects and retains personal data for certificate retrieval.":
      "प्रमाणपत्र प्राप्ति के लिए विद्यालय व्यक्तिगत डेटा कैसे एकत्र, उपयोग, सुरक्षित और संरक्षित करता है।",
  };
  const sectionHi: Record<string, string> = {
    acceptance: "स्वीकृति और दायरा",
    "acceptable-use": "स्वीकार्य उपयोग",
    "automated-access": "स्वचालित पहुँच निषिद्ध",
    certificates: "प्रमाणपत्र प्रतियाँ और आधिकारिक मूल",
    availability: "उपलब्धता और परिवर्तन",
    "access-revocation": "पहुँच निलंबन और निरस्तीकरण",
    privacy: "गोपनीयता और व्यक्तिगत डेटा",
    liability: "जिम्मेदारी और सीमाएँ",
    law: "लागू कानून और क्षेत्राधिकार",
    contact: "संपर्क और अपडेट",
    fiduciary: "आपके डेटा के लिए कौन जिम्मेदार है?",
    data: "हम कौन-सा व्यक्तिगत डेटा एकत्र करते हैं",
    purposes: "डेटा का उपयोग क्यों किया जाता है",
    children: "बच्चों और अभिभावकों का डेटा",
    processors: "सेवा प्रदाता, स्टोरेज और ट्रांसफर",
    retention: "डेटा संरक्षण अवधि और सटीकता",
    rights: "आपके अधिकार और उनका उपयोग",
    grievance: "शिकायत अधिकारी और आगे की प्रक्रिया",
    security: "सुरक्षा उपाय",
    breach: "व्यक्तिगत डेटा उल्लंघन सूचना",
    cookies: "कुकीज़ और समान तकनीक",
    "rights-request": "डेटा तक पहुँच, सुधार या मिटाने का अनुरोध",
  };
  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-10">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-slate-500">
            {hindi
              ? "विद्यालय प्रमाणपत्र पोर्टल · कानूनी जानकारी"
              : "School Certificate Portal · Legal information"}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            {hindi ? (titleHi[title] ?? title) : title}
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
            {hindi ? (subtitleHi[subtitle] ?? subtitle) : subtitle}
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs font-medium text-slate-600">
            <span className="rounded-full bg-slate-100 px-3 py-1.5">
              {hindi ? "संस्करण" : "Version"} {version}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5">
              {hindi ? "अंतिम अपडेट" : "Last updated"} {updated}
            </span>
          </div>
        </header>
        {hindi && (
          <p className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-950">
            शीर्षक और नेविगेशन का अनुवाद किया गया है। नीचे कानूनी धाराओं का
            विद्यालय द्वारा अनुमोदित अंग्रेज़ी मूल पाठ दिया गया है; इस पर निर्भर
            करने से पहले विधिक समीक्षा सहित हिंदी अनुवाद प्रकाशित करें।
          </p>
        )}
        <div className="grid items-start gap-8 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-6">
            <nav
              aria-label={hindi ? "इस पृष्ठ पर" : "On this page"}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h2 className="text-sm font-bold text-slate-900">
                {hindi ? "इस पृष्ठ पर" : "On this page"}
              </h2>
              <ol className="mt-3 space-y-1.5">
                {sections.map((section, index) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="flex gap-2 rounded-lg px-2 py-1.5 text-sm leading-5 text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
                    >
                      <span className="w-5 shrink-0 text-right text-xs tabular-nums text-slate-400">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {section.title}
                    </a>
                  </li>
                ))}
                {extraToc && (
                  <li>
                    <a
                      href={`#${extraToc.id}`}
                      className="flex gap-2 rounded-lg px-2 py-1.5 text-sm leading-5 text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
                    >
                      <span className="w-5 shrink-0 text-right text-xs tabular-nums text-slate-400">
                        {String(sections.length + 1).padStart(2, "0")}
                      </span>
                      {hindi
                        ? (sectionHi[extraToc.id] ?? extraToc.title)
                        : extraToc.title}
                    </a>
                  </li>
                )}
              </ol>
            </nav>
          </aside>
          <article className="min-w-0 rounded-2xl border border-slate-200 bg-white px-5 py-7 shadow-sm sm:px-9 sm:py-10">
            <div className="space-y-10">
              {sections.map((section) => (
                <section
                  id={section.id}
                  key={section.id}
                  className="scroll-mt-8"
                >
                  <h2 className="text-xl font-bold tracking-tight text-slate-950">
                    {hindi
                      ? (sectionHi[section.id] ?? section.title)
                      : section.title}
                  </h2>
                  <div className="mt-3 space-y-3 text-sm leading-7 text-slate-700">
                    {section.content}
                  </div>
                </section>
              ))}
            </div>
            {children}
          </article>
        </div>
      </div>
    </SiteShell>
  );
}
