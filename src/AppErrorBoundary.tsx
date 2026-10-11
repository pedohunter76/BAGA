import { recordDiagnostic } from "./diagnostics";
import { Component, type ReactNode } from "react";

export class AppErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    recordDiagnostic("render-failure");
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="storage-error" role="alert">
        <h1>BAGA couldn’t open this page.</h1>
        <p>Reload to try again. Your saved diary has not been deleted.</p>
        <button
          className="button primary"
          onClick={() => window.location.reload()}
        >
          Reload BAGA
        </button>
      </main>
    );
  }
}
