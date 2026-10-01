import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import "./styles/global.css";

/** Shown if the preload bridge is unavailable (packaging error or load failure). */
function MissingBridge() {
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        fontFamily: "system-ui, sans-serif",
        background: "#0f0e17",
        color: "#f2f0fa",
      }}
    >
      <div style={{ fontSize: 28, letterSpacing: "0.2em" }}>JADUU</div>
      <div style={{ color: "#b6b1c9", fontSize: 14 }}>
        The secure bridge couldn't load. Please restart the app.
      </div>
      <div style={{ color: "#7d7794", fontSize: 12 }}>
        If this keeps happening, reinstall JADUU.
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root")!);

if (!window.jaduu) {
  root.render(<MissingBridge />);
} else {
  root.render(
    <React.StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </React.StrictMode>,
  );
}
