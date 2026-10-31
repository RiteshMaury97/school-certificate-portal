import { pageMetadata } from "@/lib/page-metadata";
import AdminAuthView from "@/features/auth/AdminAuthView";

export const metadata = pageMetadata(
  "Multi-factor authentication",
  "Satyam International School administration.",
  { index: false },
);

export default function Page() {
  return <AdminAuthView />;
}
