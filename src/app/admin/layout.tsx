import AdminArea from "@/features/auth/AdminArea";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminArea>{children}</AdminArea>;
}
