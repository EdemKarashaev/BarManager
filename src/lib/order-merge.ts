export type Quantities = Record<string, string>;

function normalize(value?: string): string {
  const raw = (value ?? '').trim().replace(',', '.');

  if (!raw) return '0';

  if (!/^\d+(\.\d{1,3})?$/.test(raw)) {
    return raw;
  }

  const [whole, fraction = ''] = raw.split('.');
  const integer = BigInt(whole).toString();
  const decimal = fraction.replace(/0+$/, '');

  return decimal ? `${integer}.${decimal}` : integer;
}

export function mergeOrderQuantities(
  base: Quantities,
  local: Quantities,
  remote: Quantities,
) {
  const quantities: Quantities = {};
  const conflicts: string[] = [];

  const ids = new Set([
    ...Object.keys(base),
    ...Object.keys(local),
    ...Object.keys(remote),
  ]);

  for (const id of ids) {
    const b = normalize(base[id]);
    const l = normalize(local[id]);
    const r = normalize(remote[id]);

    const localChanged = l !== b;
    const remoteChanged = r !== b;

    if (localChanged && remoteChanged && l !== r) {
      conflicts.push(id);
      continue;
    }

    const value = localChanged ? l : r;

    if (value !== '0') {
      quantities[id] = value;
    }
  }

  return { quantities, conflicts };
}
