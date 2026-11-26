import type { Variant } from './recipe-model';

const units: Record<string, { group: string; factor: number }> = {
  'мл': { group: 'volume', factor: 1 },
  'л': { group: 'volume', factor: 1000 },
  'г': { group: 'mass', factor: 1 },
  'кг': { group: 'mass', factor: 1000 },
  'шт': { group: 'count', factor: 1 },
};

export function normalizeUnit(unit: string): string {
  return unit.trim().toLowerCase().replace(/\\.$/, '');
}

export function parseOutput(value: string): number | null {
  const clean = value.trim().replace(',', '.');

  if (!/^[0-9]+([.][0-9]+)?$/.test(clean)) {
    return null;
  }

  const n = Number(clean);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function canCalculate(variant: Variant): boolean {
  return variant.yield_amount != null &&
    Number.isFinite(Number(variant.yield_amount)) &&
    Number(variant.yield_amount) > 0 &&
    !!units[normalizeUnit(variant.yield_unit ?? '')];
}

export function compatibleUnits(unit: string): string[] {
  const source = units[normalizeUnit(unit)];
  if (!source) return [];
  return Object.keys(units).filter(
    key => units[key].group === source.group
  );
}

export function convertOutput(
  amount: number,
  from: string,
  to: string
): number | null {
  const a = units[normalizeUnit(from)];
  const b = units[normalizeUnit(to)];

  if (!a || !b || a.group !== b.group) return null;

  const result = amount * a.factor / b.factor;
  return Number.isFinite(result) ? result : null;
}

export function calculateFactor(
  standard: number,
  standardUnit: string,
  target: number,
  targetUnit: string
): number | null {
  const converted = convertOutput(
    target, targetUnit, standardUnit
  );

  if (converted === null || converted <= 0 ||
      !Number.isFinite(standard) || standard <= 0) {
    return null;
  }

  const result = converted / standard;
  return Number.isFinite(result) ? result : null;
}

export function scaleQuantity(
  quantity: number | null,
  factor: number
): number | null {
  if (quantity == null) return null;
  const result = Number(quantity) * factor;
  return Number.isFinite(result) ? result : null;
}
