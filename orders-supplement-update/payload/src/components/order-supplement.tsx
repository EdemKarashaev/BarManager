import { useRef, useState } from "react";
import { Modal, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { OButton, OrderFilters, emptyFilters, os } from "./order-ui";
import {
  decimalUnits,
  evaluateOrder,
  filterProducts,
  sumMoney,
} from "@/lib/order-rules";
import {
  ordersRpc,
  orderError,
  type Order,
  type OrderItem,
  type Catalog,
} from "@/lib/orders-api";
export function OrderSupplement({
  order,
  items,
  onDone,
}: {
  order: Order;
  items: OrderItem[];
  onDone: () => void;
}) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState(emptyFilters);
  const lock = useRef(false);
  const products = (catalog?.products || [])
    .filter((p) => p.is_active)
    .map((p) => {
      const old = items.find((i) => i.product_id === p.id);
      return {
        id: p.id,
        name: old?.product_name_snapshot || p.name,
        category: old?.category_snapshot || p.category || "Без раздела",
        price: old ? old.unit_price_snapshot : p.unit_price,
        supplierId: old ? old.supplier_id_snapshot : p.supplier_id,
      };
    });
  const vendors = (catalog?.suppliers || []).map((s) => ({
    id: s.id,
    name: s.name,
    minimum: s.minimum_order_amount,
  }));
  const merged = Object.fromEntries(
    items.map((i) => [i.product_id, i.quantity]),
  );
  let valid = true,
    hasAddition = false;
  for (const [id, input] of Object.entries(quantities)) {
    const q = decimalUnits(input || "0", 3);
    if (q === null) {
      valid = false;
      continue;
    }
    if (q > 0n) hasAddition = true;
    const total = (decimalUnits(merged[id] || "0", 3) || 0n) + q;
    merged[id] = `${total / 1000n}.${String(total % 1000n).padStart(3, "0")}`;
  }
  const allProducts = [
    ...products,
    ...items
      .filter((i) => !products.some((p) => p.id === i.product_id))
      .map((i) => ({
        id: i.product_id,
        name: i.product_name_snapshot,
        category: i.category_snapshot || "Без раздела",
        price: i.unit_price_snapshot,
        supplierId: i.supplier_id_snapshot,
      })),
  ];
  const check = evaluateOrder(allProducts, vendors, merged);
  const shown = filterProducts(products, check.supplierTotals, filters).filter(
    (p) => p.name.toLowerCase().includes(filters.query.toLowerCase()),
  );
  async function start() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      setCatalog(await ordersRpc<Catalog>("bm_orders_catalog"));
      setQuantities({});
      setFilters(emptyFilters);
      setOpen(true);
    } catch (e) {
      setError(orderError(e));
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  async function send() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await ordersRpc("bm_orders_supplement", {
        p_order: order.id,
        p_revision: order.revision,
        p_items: Object.entries(quantities)
          .filter(([, q]) => (decimalUnits(q || "0", 3) || 0n) > 0n)
          .map(([id, q]) => {
            const p = products.find((p) => p.id === id)!;
            return {
              product_id: id,
              quantity: q.replace(",", "."),
              expected_price: p.price,
              expected_supplier: p.supplierId,
              expected_minimum: vendors.find((s) => s.id === p.supplierId)
                ?.minimum,
            };
          }),
      });
      setOpen(false);
      onDone();
    } catch (e) {
      setError(orderError(e));
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  return (
    <>
      <OButton
        title="Дополнить заказ"
        disabled={busy}
        onPress={() => void start()}
      />
      {!!error && !open && <Text style={os.error}>{error}</Text>}
      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={() => {
          if (!busy) setOpen(false);
        }}
      >
        <SafeAreaView style={os.screen}>
          <ScrollView
            contentContainerStyle={os.content}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={os.title}>Дополнить заказ</Text>
            <Text style={os.muted}>
              Введите только добавляемое количество. Минимум проверяется по
              общей сумме заказа у каждого поставщика. Для уже заказанных
              товаров сохраняется прежняя цена.
            </Text>
            <OrderFilters
              filters={filters}
              onChange={setFilters}
              suppliers={vendors}
              categories={[...new Set(products.map((p) => p.category))]}
            />
            {shown.map((p) => (
              <View style={os.card} key={p.id}>
                <Text style={os.heading}>{p.name}</Text>
                <Text style={os.muted}>
                  {p.price ?? "Цена не задана"} ₽ · уже заказано:{" "}
                  {items.find((i) => i.product_id === p.id)?.quantity || "0"}
                </Text>
                <TextInput
                  accessibilityLabel={`Добавить: ${p.name}`}
                  style={os.input}
                  editable={!busy}
                  keyboardType="decimal-pad"
                  maxLength={12}
                  placeholder="Добавить количество"
                  placeholderTextColor="#aaa"
                  value={quantities[p.id] || ""}
                  onChangeText={(q) =>
                    setQuantities({ ...quantities, [p.id]: q })
                  }
                />
              </View>
            ))}
            <Text style={os.heading}>
              Итог с дополнением:{" "}
              {sumMoney(check.supplierTotals.map((t) => t.amount))} ₽
            </Text>
            {check.issues.map((s, i) => (
              <Text key={i} style={os.error}>
                {s}
              </Text>
            ))}
            {!valid && <Text style={os.error}>Исправьте количество</Text>}
            {!!error && <Text style={os.error}>{error}</Text>}
            <OButton
              title={busy ? "Отправляем…" : "Отправить дополнение"}
              disabled={busy || !valid || !hasAddition || !check.canSubmit}
              onPress={() => void send()}
            />
            <OButton
              title="Закрыть без отправки"
              disabled={busy}
              onPress={() => setOpen(false)}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
