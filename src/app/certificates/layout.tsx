import CertificateFlowProvider from "@/features/certificates/CertificateFlowProvider";

export default function CertificatesLayout({ children }: { children: React.ReactNode }) {
  return <CertificateFlowProvider>{children}</CertificateFlowProvider>;
}
