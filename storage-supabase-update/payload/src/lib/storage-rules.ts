export type StorageNorm = {
  id: number; product_name: string | null; category: string | null;
  temperature: string | null; shelf_life: string | null;
  storage_conditions: string | null; notes: string | null;
};
export function storageSearch(value: string): string {
  return value.toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}
export function matchesStorage(rule: StorageNorm, query: string): boolean {
  const haystack = storageSearch([rule.product_name,rule.category,rule.storage_conditions,rule.notes].filter(Boolean).join(' '));
  return storageSearch(query).split(' ').filter(Boolean).every(word => haystack.includes(word));
}
export function storageValue(value: string | null, fallback = 'Не указано'): string {
  return !value?.trim() || /^_+$/.test(value.trim()) ? fallback : value;
}
