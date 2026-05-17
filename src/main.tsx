import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { isChunkLoadError, reloadOnceForChunkError } from "@/lib/chunkRecovery";

// Auto-recover from stale lazy chunks after a redeploy.
// Use a timestamp-throttled reload (max once per 10s) to avoid infinite loops
// while still recovering when the user navigates to a new route post-deploy.
window.addEventListener("vite:preloadError", () => {
  reloadOnceForChunkError();
});

window.addEventListener("error", (e) => {
  if (isChunkLoadError(e?.error || e?.message || "")) reloadOnceForChunkError();
});
window.addEventListener("unhandledrejection", (e) => {
  if (isChunkLoadError(e?.reason)) reloadOnceForChunkError();
});

createRoot(document.getElementById("root")!).render(<App />);
