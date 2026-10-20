import type { PerfChannel } from "@/hooks/useRestaurantPerformance";

export const CHANNEL_META: Record<PerfChannel, { label: string; color: string }> = {
  caisse: { label: "Caisse (hors Châtaigne)", color: "hsl(var(--cash))" },
  uber_eats: { label: "Uber Eats", color: "hsl(var(--uber))" },
  deliveroo: { label: "Deliveroo", color: "hsl(var(--deliveroo))" },
  chataigne: { label: "Châtaigne", color: "hsl(var(--chart-3))" },
};

export const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(v)) + " €";
export const fmtEur2 = (v: number) =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + " €";
export const fmtInt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v));
