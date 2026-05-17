import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Auto-recover from stale lazy chunks after a redeploy.
// Use a timestamp-throttled reload (max once per 10s) to avoid infinite loops
// while still recovering when the user navigates to a new route post-deploy.
const CHUNK_ERR_RE = /Importing a module script failed|Failed to fetch dynamically imported module|ChunkLoadError|error loading dynamically imported module/i;
const tryReload = () => {
  const last = Number(sessionStorage.getItem("__chunk_reloaded_at__") || 0);
  if (Date.now() - last > 10_000) {
    sessionStorage.setItem("__chunk_reloaded_at__", String(Date.now()));
    window.location.reload();
  }
};
window.addEventListener("error", (e) => {
  if (CHUNK_ERR_RE.test(e?.message || "")) tryReload();
});
window.addEventListener("unhandledrejection", (e) => {
  if (CHUNK_ERR_RE.test(String(e?.reason?.message || e?.reason || ""))) tryReload();
});

createRoot(document.getElementById("root")!).render(<App />);
