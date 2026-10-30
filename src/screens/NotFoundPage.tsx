import { Link } from "react-router-dom";
import SiteShell from "@/src/components/SiteShell";
export default function NotFoundPage() {
  return (
    <SiteShell>
      <section className="mx-auto grid min-h-[55vh] max-w-2xl place-items-center px-5 text-center">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-amber-600">
            404
          </p>
          <h1 className="mt-3 text-3xl font-bold">Page not found</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            The page may have moved, or the address may be incorrect.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex min-h-12 items-center rounded-lg bg-[#173b68] px-5 py-3 font-semibold text-white"
          >
            Return to certificate finder
          </Link>
          <p className="mt-5 text-sm text-slate-500">
            Need help? Contact the school office using the support details
            below.
          </p>
        </div>
      </section>
    </SiteShell>
  );
}
