"use client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import FinderPage from "@/src/screens/FinderPage";
import VerifyPage from "@/src/screens/VerifyPage";
import FaqPage from "@/src/screens/FaqPage";
import TermsPage from "@/src/screens/TermsPage";
import PrivacyPage from "@/src/screens/PrivacyPage";
import LoginPage from "@/src/screens/LoginPage";
import AdminPage from "@/src/screens/AdminPage";
import NotFoundPage from "@/src/screens/NotFoundPage";
import I18nProvider from "@/src/components/I18nProvider";
export default function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<FinderPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  );
}
