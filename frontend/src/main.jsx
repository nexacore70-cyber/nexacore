import React, { Component, StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.jsx";
import ScrollRestoration from "./ScrollRestoration.jsx";
import ThemeLayer from "./theme/ThemeLayer.jsx";
import LanguageProvider from "./i18n/LanguageProvider.jsx";
import AutoPageTranslator from "./i18n/AutoPageTranslator.jsx";

import "./index.css";
import "./theme/theme.css";

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("NexaCore React render error:", error);
    console.error("NexaCore component stack:", info?.componentStack);
  }

  render() {
    if (this.state.error) {
      const message =
        this.state.error?.stack ||
        this.state.error?.message ||
        String(this.state.error);

      return (
        <main
          style={{
            minHeight: "100vh",
            padding: "32px 20px",
            background: "#111",
            color: "#fff",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <h1 style={{ color: "#ff5555", fontSize: 28 }}>
              NexaCore could not load
            </h1>
            <p style={{ lineHeight: 1.6 }}>
              A frontend component crashed while rendering. The details below
              can help identify the exact file that needs fixing.
            </p>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                padding: 16,
                borderRadius: 12,
                background: "#222",
                border: "1px solid #555",
                fontSize: 13,
              }}
            >
              {message}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                marginTop: 16,
                padding: "12px 18px",
                border: 0,
                borderRadius: 8,
                background: "#dc2626",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Reload NexaCore
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  document.body.innerHTML =
    '<main style="padding:32px;font-family:system-ui,sans-serif"><h1>NexaCore startup error</h1><p>The #root element is missing from frontend/index.html.</p></main>';
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <AppErrorBoundary>
        <ThemeLayer>
          <LanguageProvider>
            <ScrollRestoration />
            <App />
            <AutoPageTranslator />
          </LanguageProvider>
        </ThemeLayer>
      </AppErrorBoundary>
    </StrictMode>,
  );
}
