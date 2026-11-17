import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { isRecoverableModuleError, reloadOnceForChunkError } from "@/lib/chunkRecovery";

// Auto-recover from stale lazy chunks after a redeploy.
// Use a timestamp-throttled reload (max once per 10s) to avoid infinite loops
// while still recovering when the user navigates to a new route post-deploy.
window.addEventListener("vite:preloadError", () => {
  reloadOnceForChunkError();
});

window.addEventListener("error", (e) => {
  if (isRecoverableModuleError(e?.error || e?.message || "")) reloadOnceForChunkError();
});
window.addEventListener("unhandledrejection", (e) => {
  if (isRecoverableModuleError(e?.reason)) reloadOnceForChunkError();
});

const root = document.getElementById("root");
if (!root) throw new Error("Application root element is missing");
createRoot(root).render(<App />);
