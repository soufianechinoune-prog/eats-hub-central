import { supabase } from "@/integrations/supabase/client";
import csLogoFallback from "@/assets/cs-logo.jpeg";

// In-memory cache: chainId → base64 string
const logoCache: Record<string, string> = {};

/**
 * Load the logo for the given chain as a base64 data URL.
 * Falls back to the built-in CS logo when no chain or no logo_url is set.
 */
export async function loadChainLogoBase64(chainId: string | null): Promise<string> {
  // Check cache first
  const cacheKey = chainId || "__default__";
  if (logoCache[cacheKey]) return logoCache[cacheKey];

  let logoUrl: string | null = null;

  if (chainId) {
    try {
      const { data } = await supabase
        .from("chains")
        .select("logo_url")
        .eq("id", chainId)
        .single();
      logoUrl = data?.logo_url ?? null;
    } catch {
      // ignore – will use fallback
    }
  }

  const urlToFetch = logoUrl || csLogoFallback;

  try {
    const resp = await fetch(urlToFetch);
    const blob = await resp.blob();
    const base64: string = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
    if (base64) {
      logoCache[cacheKey] = base64;
      return base64;
    }
  } catch {
    // ignore
  }

  // Ultimate fallback: load the bundled CS logo
  try {
    const resp = await fetch(csLogoFallback);
    const blob = await resp.blob();
    const base64: string = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
    logoCache[cacheKey] = base64;
    return base64;
  } catch {
    return "";
  }
}

/**
 * Get the chain name for PDF titles. Falls back to "CS Delivery Performance".
 */
export async function getChainName(chainId: string | null): Promise<string> {
  if (!chainId) return "CS Delivery Performance";
  try {
    const { data } = await supabase
      .from("chains")
      .select("name")
      .eq("id", chainId)
      .single();
    return data?.name || "CS Delivery Performance";
  } catch {
    return "CS Delivery Performance";
  }
}
