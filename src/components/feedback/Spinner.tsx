type Props = { label?: string; className?: string };

/** Small inline spinner for "waiting for the server" states. */
export default function Spinner({ label, className = "" }: Props) {
  return (
    <span role="status" className={`inline-flex items-center gap-2 ${className}`}>
      <span className="spinner" aria-hidden="true" />
      {label ? <span>{label}</span> : <span className="sr-only">Loading</span>}
    </span>
  );
}
