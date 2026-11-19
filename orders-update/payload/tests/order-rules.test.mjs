import test from "node:test";
import assert from "node:assert/strict";
import { evaluateOrder, filterProducts } from "../src/lib/order-rules.ts";
const products = [
  {
    id: "a",
    name: "Товар А",
    supplierId: "s",
    category: "Вино",
    price: "600.00",
  },
  {
    id: "b",
    name: "Товар Б",
    supplierId: "t",
    category: "Чай",
    price: "500.00",
  },
  {
    id: "c",
    name: "Товар В",
    supplierId: "s",
    category: "Чай",
    price: "200.00",
  },
];
const suppliers = [
  { id: "s", name: "Поставщик S", minimum: "1000.00" },
  { id: "t", name: "Поставщик T", minimum: "1000.00" },
];
test("unused suppliers do not block; exact minimum passes", () =>
  assert.equal(
    evaluateOrder(products, suppliers, { a: "1", c: "2" }).canSubmit,
    true,
  ));
test("one supplier cannot cover another supplier shortage", () => {
  const r = evaluateOrder(products, suppliers, { a: "5", b: "1" });
  assert.equal(r.canSubmit, false);
  assert.equal(r.supplierTotals.find((x) => x.id === "t").shortfall, "500.00");
});
test("separate restaurant orders are validated separately", () => {
  assert.equal(evaluateOrder(products, suppliers, { a: "1" }).canSubmit, false);
  assert.equal(evaluateOrder(products, suppliers, { a: "2" }).canSubmit, true);
});
test("empty order blocked", () =>
  assert.equal(evaluateOrder(products, suppliers, {}).canSubmit, false));
test("unknown minimum is not zero", () =>
  assert.equal(
    evaluateOrder(products, [{ ...suppliers[0], minimum: null }], { a: "100" })
      .canSubmit,
    false,
  ));
test("explicit zero minimum allowed", () =>
  assert.equal(
    evaluateOrder(products, [{ ...suppliers[0], minimum: "0.00" }], { a: "1" })
      .canSubmit,
    true,
  ));
test("unknown price blocks selected product", () =>
  assert.equal(
    evaluateOrder([{ ...products[0], price: null }], suppliers, { a: "1" })
      .canSubmit,
    false,
  ));
test("unknown supplier blocks selected product", () =>
  assert.equal(
    evaluateOrder([{ ...products[0], supplierId: null }], suppliers, { a: "1" })
      .canSubmit,
    false,
  ));
test("negative and invalid quantities blocked", () => {
  for (const q of ["-1", "1a", "1.0001"])
    assert.equal(evaluateOrder(products, suppliers, { a: q }).canSubmit, false);
});
test("line rounding uses exact kopecks, supports decimal comma", () => {
  const r = evaluateOrder(
    [{ ...products[0], price: "0.01" }],
    [{ ...suppliers[0], minimum: "0.00" }],
    { a: "0,5" },
  );
  assert.equal(r.supplierTotals[0].amount, "0.01");
});
test("shortage filter includes unselected goods of insufficient supplier", () => {
  const r = evaluateOrder(products, suppliers, { a: "1" });
  assert.deepEqual(
    filterProducts(products, r.supplierTotals, { insufficientOnly: true }).map(
      (p) => p.id,
    ),
    ["a", "c"],
  );
});
test("price/category filtering does not alter order totals", () => {
  const r = evaluateOrder(products, suppliers, { a: "2", b: "2" });
  const filtered = filterProducts(products, r.supplierTotals, {
    category: "Чай",
    minPrice: "300",
    sort: "price_desc",
  });
  assert.deepEqual(
    filtered.map((p) => p.id),
    ["b"],
  );
  assert.equal(r.canSubmit, true);
});
