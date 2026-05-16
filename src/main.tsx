import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Auto-recover from stale lazy chunks after a redeploy.
// When the deployed bundle references a chunk filename that no longer exists,
// dynamic import() throws "Importing a module script failed." -> reload once.
window.addEventListener("error", (e) => {
  const msg = e?.message || "";
  if (/Importing a module script failed|Failed to fetch dynamically imported module|ChunkLoadError/i.test(msg)) {
    if (!sessionStorage.getItem("__chunk_reloaded__")) {
      sessionStorage.setItem("__chunk_reloaded__", "1");
      window.location.reload();
    }
  }
});
window.addEventListener("unhandledrejection", (e) => {
  const msg = String(e?.reason?.message || e?.reason || "");
  if (/Importing a module script failed|Failed to fetch dynamically imported module|ChunkLoadError/i.test(msg)) {
    if (!sessionStorage.getItem("__chunk_reloaded__")) {
      sessionStorage.setItem("__chunk_reloaded__", "1");
      window.location.reload();
    }
  }
});

createRoot(document.getElementById("root")!).render(<App />);
