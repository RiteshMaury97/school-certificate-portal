type Props = {
  email: string;
  emailInvalid: boolean;
  resetBusy: boolean;
  onEmailChange: (email: string) => void;
  onEmailValidityChange: (valid: boolean) => void;
  onReset: (email: string) => void;
  onCancel: () => void;
};

const field =
  "admin-auth-input mt-2 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--text)] placeholder:text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] aria-[invalid=true]:border-[var(--danger)]";
const primary =
  "flex min-h-11 w-full items-center justify-center rounded-lg bg-[var(--primary)] py-2.5 font-semibold text-[var(--on-primary)] transition hover:bg-[var(--primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

export default function PasswordResetForm({
  email,
  emailInvalid,
  resetBusy,
  onEmailChange,
  onEmailValidityChange,
  onReset,
  onCancel,
}: Props) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onReset(email);
      }}
      className="space-y-4"
    >
      <h3 className="text-lg font-bold tracking-tight">Reset Your Password</h3>
      <label htmlFor="admin-reset-email" className="block text-sm font-medium">
        Email Address
        <input
          id="admin-reset-email"
          aria-label="Registered email address"
          aria-invalid={emailInvalid}
          translate="no"
          type="email"
          autoComplete="email"
          required
          placeholder="Enter your registered email address"
          value={email}
          onInvalid={() => {
            onEmailValidityChange(false);
          }}
          onBlur={(event) => {
            onEmailValidityChange(event.currentTarget.validity.valid);
          }}
          onChange={(event) => {
            onEmailChange(event.target.value);
            onEmailValidityChange(event.currentTarget.validity.valid);
          }}
          className={field}
        />
      </label>
      <button type="submit" disabled={resetBusy} aria-busy={resetBusy} className={primary}>
        {resetBusy ? "Sending…" : "Send Password Reset Link"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="min-h-10 w-full text-sm font-medium text-[var(--primary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
      >
        Return to Administrator Login
      </button>
    </form>
  );
}
