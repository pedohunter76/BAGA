import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { recordDiagnostic } from "./diagnostics";
window.addEventListener("error", () => recordDiagnostic("runtime-error"));
window.addEventListener("unhandledrejection", () =>
  recordDiagnostic("unhandled-rejection"),
);
import { AppErrorBoundary } from "./AppErrorBoundary";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
