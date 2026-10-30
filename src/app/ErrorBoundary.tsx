"use client";
import React from "react";
type State = { failed: boolean };
export default class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { failed: false };
  static getDerivedStateFromError(): State {
    return { failed: true };
  }
  componentDidCatch(error: Error): void {
    console.error("Page rendering failed", error);
  }
  render() {
    if (this.state.failed)
      return (
        <main role="alert" className="mx-auto max-w-3xl p-8">
          <h1 className="text-2xl font-bold">This page could not be loaded</h1>
          <p className="mt-2 text-slate-600">Please refresh the page or return to the home page.</p>
          <a
            className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-[var(--primary)] px-5 text-[var(--primary-contrast)]"
            href="/"
          >
            Return home
          </a>
        </main>
      );
    return this.props.children;
  }
}
