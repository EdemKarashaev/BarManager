export type Product = {
  id: string;
  name: string;
  supplierId: string | null;
  category: string;
  price: string | null;
};
export type Supplier = { id: string; name: string; minimum: string | null };
export type SupplierTotal = {
  id: string;
  name: string;
  amount: string;
  minimum: string | null;
  shortfall: string | null;
  incomplete: boolean;
};
export function decimalUnits(value: string, decimals: number): bigint | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > decimals) return null;
  return (
    BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt(fraction.padEnd(decimals, "0") || "0")
  );
}
const money = (cents: bigint) =>
  `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
/** Quantities max 3 decimals. Round each monetary line to kopecks, half up. */
export function evaluateOrder(
  products: Product[],
  suppliers: Supplier[],
  quantities: Record<string, string>,
) {
  const issues: string[] = [];
  const catalog = new Map(products.map((p) => [p.id, p]));
  const vendors = new Map(suppliers.map((s) => [s.id, s]));
  const totals = new Map<string, { cents: bigint; incomplete: boolean }>();
  let selected = 0;
  for (const [id, input] of Object.entries(quantities)) {
    if (!input.trim()) continue;
    const q = decimalUnits(input, 3);
    if (q === null) {
      issues.push(`Некорректное количество: ${catalog.get(id)?.name || id}`);
      continue;
    }
    if (q === 0n) continue;
    selected++;
    const p = catalog.get(id);
    if (!p) {
      issues.push(`Товар недоступен: ${id}`);
      continue;
    }
    if (!p.supplierId || !vendors.has(p.supplierId)) {
      issues.push(`Не указан поставщик: ${p.name}`);
      continue;
    }
    const total = totals.get(p.supplierId) || { cents: 0n, incomplete: false };
    const price = p.price === null ? null : decimalUnits(p.price, 2);
    if (price === null) {
      total.incomplete = true;
      issues.push(`Не указана корректная цена: ${p.name}`);
    } else total.cents += (price * q + 500n) / 1000n;
    totals.set(p.supplierId, total);
  }
  if (selected === 0) issues.push("Добавьте товары в заказ.");
  const supplierTotals: SupplierTotal[] = [];
  for (const [id, total] of totals) {
    const s = vendors.get(id)!;
    const minimum = s.minimum === null ? null : decimalUnits(s.minimum, 2);
    if (minimum === null) issues.push(`Не задан минимум: ${s.name}`);
    const shortfall =
      minimum === null || total.incomplete
        ? null
        : minimum > total.cents
          ? minimum - total.cents
          : 0n;
    if (shortfall !== null && shortfall > 0n)
      issues.push(`${s.name}: не хватает ${money(shortfall)} ₽`);
    supplierTotals.push({
      id,
      name: s.name,
      amount: money(total.cents),
      minimum: minimum === null ? null : money(minimum),
      shortfall: shortfall === null ? null : money(shortfall),
      incomplete: total.incomplete,
    });
  }
  return { canSubmit: issues.length === 0, issues, supplierTotals };
}
/** Apply to the full catalogue AFTER evaluateOrder; totals must not depend on filters. */
export function filterProducts(
  products: Product[],
  totals: SupplierTotal[],
  filters: {
    supplierId?: string;
    category?: string;
    insufficientOnly?: boolean;
    minPrice?: string;
    maxPrice?: string;
    sort?: "price_asc" | "price_desc";
  },
) {
  const insufficient = new Set(
    totals
      .filter((t) => t.shortfall !== null && decimalUnits(t.shortfall, 2)! > 0n)
      .map((t) => t.id),
  );
  const min = filters.minPrice ? decimalUnits(filters.minPrice, 2) : null;
  const max = filters.maxPrice ? decimalUnits(filters.maxPrice, 2) : null;
  return products
    .filter((p) => {
      const price = p.price === null ? null : decimalUnits(p.price, 2);
      return (
        (!filters.supplierId || p.supplierId === filters.supplierId) &&
        (!filters.category || p.category === filters.category) &&
        (!filters.insufficientOnly ||
          (!!p.supplierId && insufficient.has(p.supplierId))) &&
        (min === null || (price !== null && price >= min)) &&
        (max === null || (price !== null && price <= max))
      );
    })
    .sort((a, b) => {
      if (!filters.sort) return 0;
      const x = a.price === null ? null : decimalUnits(a.price, 2),
        y = b.price === null ? null : decimalUnits(b.price, 2);
      if (x === null) return y === null ? 0 : 1;
      if (y === null) return -1;
      const order = x < y ? -1 : x > y ? 1 : 0;
      return filters.sort === "price_desc" ? -order : order;
    });
}

export function lineAmount(
  price: string | null,
  quantity: string,
): string | null {
  const cents = price === null ? null : decimalUnits(price, 2);
  const units = decimalUnits(quantity || "0", 3);
  return cents === null || units === null
    ? null
    : money((cents * units + 500n) / 1000n);
}
export function sumMoney(values: string[]): string {
  return money(
    values.reduce((sum, value) => sum + (decimalUnits(value, 2) ?? 0n), 0n),
  );
}
