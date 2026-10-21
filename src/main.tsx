import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "./AppErrorBoundary";
import { recordDiagnostic } from "./diagnostics";
import "./styles.css";

window.addEventListener("error", () => recordDiagnostic("runtime-error"));
window.addEventListener("unhandledrejection", () =>
  recordDiagnostic("unhandled-rejection"),
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
