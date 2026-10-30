"use client";
import dynamic from "next/dynamic";
const App = dynamic(() => import("./App"), {
  ssr: false,
  loading: () => (
    <main className="grid min-h-screen place-items-center text-slate-600">
      Loading certificate portal…
    </main>
  ),
});
export default function ClientAppLoader() {
  return <App />;
}
