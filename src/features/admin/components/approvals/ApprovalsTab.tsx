import Image from "next/image";

import EmptyState from "@/components/feedback/EmptyState";

import type { CertificatePreviewMap, PreviewUrl } from "../../types/admin-state.types";
import type { Cert } from "../../types/admin.types";
import type { Role } from "../../types/admin.types";
import type { Dispatch, SetStateAction } from "react";

function valueOrFallback(value: string | undefined, fallback: string): string {
  return value && value.length > 0 ? value : fallback;
}

type ApprovalsTabProps = {
  pending: Cert[];
  rejectReason: Record<string, string>;
  setRejectReason: Dispatch<SetStateAction<Record<string, string>>>;
  approvalChecks: Record<string, boolean>;
  setApprovalChecks: Dispatch<SetStateAction<Record<string, boolean>>>;
  previewUrls: CertificatePreviewMap;
  decideCertificate: (id: string, decision: "approve" | "reject") => void;
  busy: boolean;
  uid: string;
  role: Role;
  loadPreview: (id: string) => void;
};

function ApprovalDetails({
  certificate,
  rejectReason,
  setRejectReason,
  approvalChecked,
  setApprovalChecked,
  previewAvailable,
  busy,
  uid,
  canReviewOwnUpload,
  onDecision,
}: {
  certificate: Cert;
  rejectReason: string;
  setRejectReason: (value: string) => void;
  approvalChecked: boolean;
  setApprovalChecked: (value: boolean) => void;
  previewAvailable: boolean;
  busy: boolean;
  uid: string;
  canReviewOwnUpload: boolean;
  onDecision: (decision: "approve" | "reject") => void;
}) {
  const c = certificate;
  const ownUploadBlocked = c.uploadedBy === uid && !canReviewOwnUpload;
  return (
    <div>
      <div className="flex flex-wrap justify-between gap-2">
        <b>{c.type} · {c.session}</b>
        <span className="text-xs font-semibold text-[var(--text)]">Pending</span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div><dt className="text-[var(--text-muted)]">Student</dt><dd className="font-semibold">{valueOrFallback(c.studentName, c.studentId)}</dd></div>
        <div><dt className="text-[var(--text-muted)]">Father</dt><dd>{valueOrFallback(c.fatherName, "—")}</dd></div>
        <div><dt className="text-[var(--text-muted)]">Mother</dt><dd>{valueOrFallback(c.motherName, "—")}</dd></div>
        <div><dt className="text-[var(--text-muted)]">Certificate number</dt><dd className="font-semibold">{valueOrFallback(c.certificateNumber, "Not recorded")}</dd></div>
        <div><dt className="text-[var(--text-muted)]">Session</dt><dd>{c.session}</dd></div>
        <div><dt className="text-[var(--text-muted)]">Type</dt><dd>{c.type}</dd></div>
        <div><dt className="text-[var(--text-muted)]">Issue date</dt><dd>{c.issueDate}</dd></div>
        <div><dt className="text-[var(--text-muted)]">Uploaded by</dt><dd>{c.uploadedBy ?? "Unknown"}</dd></div>
      </dl>
      {c.replacesId && (
        <p className="mt-3 rounded bg-[var(--surface-2)] p-2 text-xs text-[var(--text)]">
          Replacement for certificate record {c.replacesId}. The old version will be superseded only after this approval.
        </p>
      )}
      <label className="mt-4 block text-sm">
        Rejection reason
        <textarea
          translate="no"
          aria-label="Reason for rejection"
          minLength={10}
          maxLength={1000}
          value={rejectReason}
          onChange={(event) => {
            setRejectReason(event.target.value);
          }}
          rows={2}
          className="mt-1 w-full rounded border p-2"
          placeholder="Required only when rejecting"
          required
          aria-required="true"
        />
      </label>
      <label className="mt-3 flex items-start gap-2 text-sm">
        <input
          translate="no"
          type="checkbox"
          aria-label="Confirm certificate details match the document"
          required={previewAvailable}
          aria-required={previewAvailable}
          checked={approvalChecked}
          disabled={!previewAvailable}
          onChange={(event) => {
            setApprovalChecked(event.target.checked);
          }}
          className="mt-0.5 h-4 w-4"
        />
        <span>Details match the document</span>
      </label>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => {
            onDecision("approve");
          }}
          disabled={busy || ownUploadBlocked || !previewAvailable || !approvalChecked}
          className="rounded bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-40"
        >
          Approve &amp; publish
        </button>
        <button
          onClick={() => {
            onDecision("reject");
          }}
          disabled={busy || ownUploadBlocked}
          className="rounded bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-40"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

function ApprovalPreview({
  certificate,
  preview,
  loadPreview,
}: {
  certificate: Cert;
  preview: PreviewUrl | undefined;
  loadPreview: (id: string) => void;
}) {
  const c = certificate;
  return (
    <div className="min-h-64 rounded-lg border bg-[var(--surface-2)] p-2">
      <div className="mb-2 flex items-center justify-between">
        <b className="text-sm">Document preview</b>
        {!preview ? (
          <button onClick={() => { loadPreview(c.id); }} className="rounded border bg-[var(--surface)] px-3 py-1.5 text-xs">Load 60-second preview</button>
        ) : (
          <a
            href={preview.url}
            target="_blank"
            rel="noreferrer"
            className="rounded border bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold"
          >
            Open document in new tab
          </a>
        )}
      </div>
      {preview ? (
        preview.mimeType === "application/pdf" ? (
          <iframe title={`Preview ${c.fileName}`} src={preview.url} referrerPolicy="no-referrer" className="h-[520px] w-full rounded" />
        ) : (
          <Image
            src={preview.url}
            alt={`Certificate preview for ${c.studentName ?? "student"}`}
            width={1200}
            height={800}
            unoptimized
            className="max-h-[520px] max-w-full object-contain"
          />
        )
      ) : (
        <p className="grid min-h-56 place-items-center text-sm text-[var(--text-muted)]">
          Preview is private and is not cached.
        </p>
      )}
    </div>
  );
}

function ApprovalCard({
  certificate,
  props,
}: {
  certificate: Cert;
  props: ApprovalsTabProps;
}) {
  return (
    <article className="rounded-lg border p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <ApprovalDetails
          certificate={certificate}
          rejectReason={props.rejectReason[certificate.id] ?? ""}
          setRejectReason={(value) => {
            props.setRejectReason((previous) => ({ ...previous, [certificate.id]: value }));
          }}
          approvalChecked={props.approvalChecks[certificate.id] === true}
          setApprovalChecked={(value) => {
            props.setApprovalChecks((previous) => ({ ...previous, [certificate.id]: value }));
          }}
          previewAvailable={Boolean(props.previewUrls[certificate.id])}
          busy={props.busy}
          uid={props.uid}
          canReviewOwnUpload={props.role === "admin" || props.role === "superadmin"}
          onDecision={(decision) => {
            props.decideCertificate(certificate.id, decision);
          }}
        />
        <ApprovalPreview
          certificate={certificate}
          preview={props.previewUrls[certificate.id]}
          loadPreview={props.loadPreview}
        />
      </div>
    </article>
  );
}

export default function ApprovalsTab({
  pending,
  rejectReason,
  setRejectReason,
  approvalChecks,
  setApprovalChecks,
  previewUrls,
  decideCertificate,
  busy,
  uid,
  role,
  loadPreview,
}: ApprovalsTabProps) {
  return (
    <section className="rounded-xl border bg-[var(--surface)] p-5">
      <h2 className="text-lg font-bold">Pending certificate approvals</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Review the original upload in a private preview. Uploader submissions need a different approver; admin and superadmin uploads can be published directly.
      </p>
      <div className="mt-4 space-y-4">
        {pending.map((certificate) => (
          <ApprovalCard
            key={certificate.id}
            certificate={certificate}
            props={{
              pending,
              rejectReason,
              setRejectReason,
              approvalChecks,
              setApprovalChecks,
              previewUrls,
              decideCertificate,
              busy,
              uid,
              role,
              loadPreview,
            }}
          />
        ))}
        {pending.length === 0 && <EmptyState title="No pending approvals" description="There are no certificates awaiting review." />}
      </div>
    </section>
  );
}
