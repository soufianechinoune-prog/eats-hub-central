const CHUNK_LOAD_ERROR_PATTERN =
  /Importing a module script failed|Failed to fetch dynamically imported module|ChunkLoadError|error loading dynamically imported module|Loading chunk \d+ failed/i;

const RELOAD_KEY_PREFIX = "__chunk_reload_attempted__";

export const isChunkLoadError = (error: unknown) => {
  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === "string"
        ? error
        : JSON.stringify(error ?? "");

  return CHUNK_LOAD_ERROR_PATTERN.test(message);
};

// An already-open preview can mix old provider modules with newly loaded pages
// after dependency replacement. A full reload restores one router instance.
export const isRouterContextError = (error: unknown) => {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /use(?:Navigate|Location|Routes)\(\) may be used only in the context of a <Router> component/.test(message);
};

export const isRecoverableModuleError = (error: unknown) =>
  isChunkLoadError(error) || isRouterContextError(error);

export const reloadOnceForChunkError = () => {
  if (typeof window === "undefined") return false;

  const key = `${RELOAD_KEY_PREFIX}${window.location.pathname}${window.location.search}`;

  try {
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, String(Date.now()));
  } catch {
    // If storage is unavailable, still try a single recovery reload.
  }

  window.location.reload();
  return true;
};
