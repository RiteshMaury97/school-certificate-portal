import AdminAuthView from "@/features/auth/AdminAuthView";
import GoogleSignInController from "@/features/auth/GoogleSignInController";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata(
  "Administrator sign in",
  "Satyam International School administration.",
  { index: false },
);

export default function Page() {
  return (
    <>
      <AdminAuthView />
      <GoogleSignInController />
    </>
  );
}
