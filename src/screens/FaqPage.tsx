"use client";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import SiteShell from "@/src/components/SiteShell";
import PublicServiceTabs from "@/src/components/PublicServiceTabs";
type Faq = {
  questionEn: string;
  answerEn: string;
  questionHi?: string;
  answerHi?: string;
};
const defaults: Faq[] = [
  {
    questionEn: "Name not found",
    answerEn:
      "Check that the student's name and both parents' names match the school register, including spaces and spelling. If the record still does not appear, use the report form so the school can review it.",
    questionHi: "नाम नहीं मिला",
    answerHi:
      "जाँचें कि छात्र और माता-पिता के नाम विद्यालय रजिस्टर से मेल खाते हैं। फिर भी रिकॉर्ड न मिले तो रिपोर्ट फ़ॉर्म भेजें।",
  },
  {
    questionEn: "Which spelling should I use?",
    answerEn:
      "Use the exact spelling recorded in the school's admission or examination records. Do not use a nickname or a different transliteration.",
    questionHi: "किस वर्तनी का उपयोग करें?",
    answerHi:
      "विद्यालय के प्रवेश या परीक्षा रिकॉर्ड में दर्ज बिल्कुल वही वर्तनी लिखें। उपनाम का उपयोग न करें।",
  },
  {
    questionEn: "Wrong details in my certificate",
    answerEn:
      "Submit a wrong-record report with the session, the incorrect detail and a contact method. The school will review the request; do not upload sensitive identity documents unless the school asks through an approved channel.",
    questionHi: "प्रमाणपत्र में गलत विवरण",
    answerHi:
      "सत्र, गलत विवरण और संपर्क जानकारी के साथ रिपोर्ट भेजें। विद्यालय अनुरोध की जाँच करेगा।",
  },
  {
    questionEn: "I passed in a different session",
    answerEn:
      "Choose the session in which you passed, not the year in which you are requesting the certificate. If that session is not listed, contact the school office.",
    questionHi: "मैंने दूसरे सत्र में परीक्षा उत्तीर्ण की",
    answerHi:
      "जिस सत्र में आपने परीक्षा उत्तीर्ण की थी, वही चुनें। सत्र उपलब्ध न हो तो विद्यालय कार्यालय से संपर्क करें।",
  },
  {
    questionEn: "Is my data safe? (DPDP)",
    answerEn:
      "The portal uses your details only to match the school record and provide the requested certificate. Access is rate-limited, protected by security verification and logged. See the Privacy page for the school's data-rights and grievance process under applicable Indian data-protection law.",
    questionHi: "क्या मेरा डेटा सुरक्षित है? (DPDP)",
    answerHi:
      "आपके विवरण का उपयोग केवल विद्यालय रिकॉर्ड मिलाने और प्रमाणपत्र देने के लिए किया जाता है। गोपनीयता पृष्ठ पर डेटा अधिकार और शिकायत प्रक्रिया देखें।",
  },
  {
    questionEn: "How do I verify a certificate as an employer?",
    answerEn:
      "Open the Verify page and enter the certificate number. The result confirms whether the certificate record is valid, revoked or unavailable. It does not expose the student's full record.",
    questionHi: "नियोक्ता प्रमाणपत्र कैसे सत्यापित करें?",
    answerHi:
      "सत्यापन पृष्ठ खोलें और प्रमाणपत्र संख्या दर्ज करें। परिणाम प्रमाणपत्र की वैधता बताएगा।",
  },
  {
    questionEn: "Can I get a hard copy?",
    answerEn:
      "The portal provides digital copies. For a printed or officially issued hard copy, contact the school office using the support details in the footer. Availability and any applicable fee are decided by the school.",
    questionHi: "क्या मुझे हार्ड कॉपी मिल सकती है?",
    answerHi:
      "पोर्टल डिजिटल कॉपी देता है। मुद्रित या आधिकारिक हार्ड कॉपी के लिए विद्यालय कार्यालय से संपर्क करें।",
  },
];
export default function FaqPage() {
  const [faqs, setFaqs] = useState<Faq[]>(defaults);
  const [loading, setLoading] = useState(true);
  const { t, i18n } = useTranslation();
  useEffect(() => {
    let active = true;
    fetch("/api/public/site-settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (active && Array.isArray(d.settings?.faqs) && d.settings.faqs.length)
          setFaqs(d.settings.faqs as Faq[]);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const hindi = i18n.language.startsWith("hi");
  return (
    <SiteShell>
      <div className="mx-auto max-w-4xl">
        <PublicServiceTabs />
        <h1 className="text-3xl font-bold dark:text-white">{t("faqTitle")}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {hindi
            ? "प्रमाणपत्र खोजने, सत्यापित करने और सहायता प्राप्त करने के बारे में उत्तर।"
            : "Answers about finding, verifying and requesting support for school certificates."}
        </p>
        <div className="mt-6 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white px-5 dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-900">
          {(loading ? defaults : faqs).map((item, index) => (
            <details key={`${item.questionEn}-${index}`} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-4 dark:text-slate-100">
                <span>
                  {hindi && item.questionHi ? item.questionHi : item.questionEn}
                </span>
                <span
                  aria-hidden="true"
                  className="text-xl text-slate-500 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                {hindi && item.answerHi ? item.answerHi : item.answerEn}
              </p>
            </details>
          ))}
        </div>
      </div>
    </SiteShell>
  );
}
