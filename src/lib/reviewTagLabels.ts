/**
 * Complete English-to-French tag translation dictionary
 * Categorized as positive or negative for visual styling
 */

export const TAG_LABELS: Record<string, string> = {
  // Tags positifs - Restaurant
  "restaurant_sustainable_packaging": "Conditionnement durable",
  "restaurant_delicious_options": "Délicieux plats",
  "restaurant_perfectly_cooked": "Cuisson parfaite",
  "restaurant_perfect_portions": "Portions parfaites",
  "restaurant_perfectly_seasoned": "Assaisonnement parfait",
  "restaurant_unique_flavors": "Saveurs uniques",
  "restaurant_fresh_ingredients": "Ingrédients frais",
  "restaurant_large_portions": "Grandes portions",
  "restaurant_nicely_presented": "Jolie présentation",
  "restaurant_authentic_dishes": "Plats authentiques",
  "restaurant_high-quality_ingredients": "Ingrédients de qualité",
  "restaurant_customizable_options": "Options personnalisables",
  "restaurant_extensive_menu": "Menu varié",
  "restaurant_upscale": "Haut de gamme",
  "restaurant_local_ingredients": "Ingrédients locaux",
  "restaurant_hole-in-the-wall": "Sans prétention",
  "restaurant_locally_owned": "Entreprise locale",
  "restaurant_creative_menu": "Menu créatif",
  "restaurant_hidden_gem": "Joyau caché",
  "restaurant_creative_options": "Options créatives",
  "restaurant_no-frills": "Sans fioritures",
  "restaurant_veggie-heavy_menu": "Menu spécial végétarien",
  "restaurant_classic": "Classique",
  "restaurant_fast_casual": "Rapide décontracté",
  "restaurant_consistent": "Qualité constante",
  "restaurant_convenient": "Pratique",
  // Tags positifs - Items
  "item_perfect_temperature": "Température parfaite",
  "item_tasty": "Savoureux",
  "item_fresh": "Frais",
  "item_good_portion": "Bonne portion",
  "item_nice_presentation": "Belle présentation",
  "item_perfectly_cooked": "Cuisson parfaite",
  "item_well_seasoned": "Bien assaisonné",
  // Tags négatifs - Restaurant
  "restaurant_not_worth_price": "Ne vaut pas le prix",
  "restaurant_not_tasty": "Pas très savoureux",
  "restaurant_poor_packaging": "Emballage médiocre",
  "restaurant_unsustainable_packaging": "Conditionnement non durable",
  "restaurant_missed_request": "Instructions non respectées",
  "restaurant_too_slow": "Trop lent",
  // Tags négatifs - Items
  "item_small_portion": "Petite portion",
  "item_cold_melted": "Froid/fondu",
  "item_not_fresh": "Pas frais",
  "item_poorly_cooked": "Mal cuit",
  "item_not_tasty": "Pas savoureux",
  "item_bad_presentation": "Mauvaise présentation",
};

// Tags considérés comme négatifs
export const NEGATIVE_TAGS = new Set([
  "restaurant_not_worth_price",
  "restaurant_not_tasty",
  "restaurant_poor_packaging",
  "restaurant_unsustainable_packaging",
  "restaurant_missed_request",
  "restaurant_too_slow",
  "item_small_portion",
  "item_cold_melted",
  "item_not_fresh",
  "item_poorly_cooked",
  "item_not_tasty",
  "item_bad_presentation",
]);

/**
 * Get the French label for a tag, or a cleaned-up version if not found
 */
export function getTagLabel(tag: string): string {
  if (TAG_LABELS[tag]) {
    return TAG_LABELS[tag];
  }
  // Fallback: clean up the tag name
  return tag
    .replace(/^(restaurant_|item_)/, '')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Check if a tag is negative
 */
export function isNegativeTag(tag: string): boolean {
  return NEGATIVE_TAGS.has(tag);
}
