export function belongsToImportScope(
  restaurantIds: readonly (string | null)[] | null | undefined,
  scopeIds: readonly string[],
): boolean {
  if (!restaurantIds?.length || !scopeIds.length) return false;
  const scope = new Set(scopeIds);
  return restaurantIds.some((id) => id !== null && scope.has(id));
}