/**
 * A template (unlike a layout) is re-created on every navigation, so the CSS
 * entrance animation below plays each time the visitor moves between pages.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
