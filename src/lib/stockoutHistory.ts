export interface HistoryStockout {
  restaurant_id: string;
  restaurant_name: string;
  item_id: string;
  product_name: string;
  category: string | null;
  started_at: string;
  duration_minutes: number;
  is_ongoing: boolean;
}

export type StockoutSort = "recent" | "oldest" | "longest" | "shortest" | "product";
export type RestaurantStockoutSort = "products" | "events" | "duration" | "name";

export function filterStockoutProduct<T extends HistoryStockout>(rows: T[], product: string | null) {
  return rows.filter(r => !product || r.product_name === product);
}

export function selectStockoutHistory<T extends HistoryStockout>(rows: T[], restaurantId: string | null, category: string, sort: StockoutSort) {
  return rows.filter((r) => (!restaurantId || r.restaurant_id === restaurantId) &&
    (category === "all" || (r.category ?? "Sans catégorie") === category)).sort((a, b) => {
    if (sort === "longest" || sort === "shortest") return (Number(b.duration_minutes) - Number(a.duration_minutes)) * (sort === "longest" ? 1 : -1);
    if (sort === "product") return a.product_name.localeCompare(b.product_name, "fr");
    return (new Date(b.started_at).getTime() - new Date(a.started_at).getTime()) * (sort === "recent" ? 1 : -1);
  });
}

export function rankStockoutRestaurants(rows: HistoryStockout[], sort: RestaurantStockoutSort) {
  const groups = new Map<string, { id: string; name: string; n: number; min: number; ongoing: number; products: Set<string> }>();
  rows.forEach((r) => {
    const x = groups.get(r.restaurant_id) ?? { id: r.restaurant_id, name: r.restaurant_name, n: 0, min: 0, ongoing: 0, products: new Set<string>() };
    x.n++; x.min += Number(r.duration_minutes); x.ongoing += Number(r.is_ongoing); x.products.add(r.item_id);
    groups.set(r.restaurant_id, x);
  });
  return [...groups.values()].map(({ products, ...r }) => ({ ...r, productCount: products.size })).sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name, "fr");
    const key = sort === "products" ? "productCount" : sort === "events" ? "n" : "min";
    return b[key] - a[key] || a.name.localeCompare(b.name, "fr");
  });
}