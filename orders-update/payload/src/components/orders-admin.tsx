/* eslint-disable react-hooks/set-state-in-effect -- Reset remote data immediately when account or reporting period changes; stale data must not remain editable. */
import { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import {
  Choice,
  emptyFilters,
  OButton,
  OrderFilters,
  os,
  type Filters,
} from "./order-ui";
import { decimalUnits } from "@/lib/order-rules";
import {
  orderError,
  ordersRpc,
  orderStatus,
  type Catalog,
  type Order,
  type OrderContext,
  type OrderItem,
} from "@/lib/orders-api";
type SummaryRow = {
  key: string;
  name: string;
  supplier: string;
  supplierId: string | null;
  category: string;
  price: string | null;
  quantities: Record<string, number>;
  total: number;
  amount: number;
};
export function OrdersAdmin({
  context,
  catalog,
  setCatalog,
  week,
}: {
  context: OrderContext;
  catalog: Catalog;
  setCatalog: (c: Catalog) => void;
  week: string;
}) {
  const [tab, setTab] = useState("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [editKind, setEditKind] = useState("supplier");
  const [editId, setEditId] = useState("");
  const [amount, setAmount] = useState("");
  const [supplier, setSupplier] = useState("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  // Clear selection when the remote reporting period changes.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setSelected("");
    ordersRpc<Order[]>("bm_orders_dashboard", { p_week: week })
      .then((rows) => {
        if (active) setOrders(rows);
      })
      .catch((e) => {
        if (active) setError(orderError(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [week, reload]);
  const picked = orders.find((o) => o.id === selected);
  const rows = new Map<string, SummaryRow>();
  for (const o of orders.filter((o) =>
    ["submitted", "approved"].includes(o.status),
  )) {
    for (const it of o.items || []) {
      const key = JSON.stringify([
        it.product_id,
        it.product_name_snapshot,
        it.supplier_id_snapshot,
        it.unit_price_snapshot,
        it.unit_snapshot,
        it.category_snapshot,
      ]);
      const row = rows.get(key) || {
        key,
        name: it.product_name_snapshot,
        supplier: it.supplier_name_snapshot || "Не указан",
        supplierId: it.supplier_id_snapshot,
        category: it.category_snapshot || "Без раздела",
        price: it.unit_price_snapshot,
        quantities: {},
        total: 0,
        amount: 0,
      };
      const q = Number(it.quantity);
      row.quantities[o.location_id] = (row.quantities[o.location_id] || 0) + q;
      row.total += q;
      const cents =
        it.unit_price_snapshot === null
          ? null
          : decimalUnits(it.unit_price_snapshot, 2);
      const units = decimalUnits(it.quantity, 3);
      if (cents !== null && units !== null)
        row.amount += Number((cents * units + 500n) / 1000n) / 100;
      rows.set(key, row);
    }
  }
  const summary = [...rows.values()]
    .filter(
      (r) =>
        (!filters.supplierId || r.supplierId === filters.supplierId) &&
        (!filters.category || r.category === filters.category) &&
        r.name.toLowerCase().includes(filters.query.toLowerCase()) &&
        (!filters.minPrice ||
          (r.price !== null &&
            Number(r.price) >= Number(filters.minPrice.replace(",", ".")))) &&
        (!filters.maxPrice ||
          (r.price !== null &&
            Number(r.price) <= Number(filters.maxPrice.replace(",", ".")))),
    )
    .sort((a, b) =>
      filters.sort
        ? (Number(a.price) - Number(b.price)) *
          (filters.sort === "price_desc" ? -1 : 1)
        : a.name.localeCompare(b.name, "ru"),
    );
  async function review(action: string) {
    if (!picked || busy) return;
    setBusy(true);
    setError("");
    try {
      await ordersRpc("bm_orders_review", {
        p_order: picked.id,
        p_revision: picked.revision,
        p_action: action,
        p_comment: comment,
      });
      setComment("");
      setReload((n) => n + 1);
    } catch (e) {
      setError(orderError(e));
    } finally {
      setBusy(false);
    }
  }
  async function edit() {
    if (!editId || busy) return;
    const value = amount.trim() ? decimalUnits(amount, 2) : null;
    if (amount.trim() && value === null) {
      setError("Введите сумму с точностью до копейки.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await ordersRpc("bm_orders_catalog_edit", {
        p_kind: editKind,
        p_id: editId,
        p_amount: amount.trim() ? amount.trim().replace(",", ".") : null,
        p_supplier: supplier || null,
      });
      setCatalog(await ordersRpc<Catalog>("bm_orders_catalog"));
      setEditId("");
      setMessage(
        "Изменения сохранены. Уже отправленные заказы сохраняют прежние цены.",
      );
    } catch (e) {
      setError(orderError(e));
    } finally {
      setBusy(false);
    }
  }
  function choose(id: string) {
    setEditId(id);
    if (editKind === "supplier") {
      setAmount(
        catalog.suppliers.find((s) => s.id === id)?.minimum_order_amount || "",
      );
    } else {
      const p = catalog.products.find((p) => p.id === id);
      setAmount(p?.unit_price || "");
      setSupplier(p?.supplier_id || "");
    }
  }
  const entries =
    editKind === "supplier" ? catalog.suppliers : catalog.products;
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={os.content}
    >
      <Choice
        value={tab}
        options={[
          { id: "orders", name: "Заказы и сводка" },
          { id: "catalog", name: "Цены и минимумы" },
        ]}
        onChange={setTab}
        disabled={busy}
      />
      {!!error && (
        <Text accessibilityRole="alert" style={os.error}>
          {error}
        </Text>
      )}
      {!!message && <Text style={os.success}>{message}</Text>}
      {tab === "orders" ? (
        <>
          <Text style={os.heading}>Рестораны · неделя {week}</Text>
          <OButton
            title={loading ? "Обновляем…" : "Обновить заказы"}
            disabled={loading || busy}
            onPress={() => setReload((n) => n + 1)}
          />
          {!loading &&
            context.locations.map((l) => {
              const order = orders.find((o) => o.location_id === l.id);
              return (
                <View style={os.card} key={l.id}>
                  <Text style={os.heading}>{l.name}</Text>
                  <Text style={os.muted}>{l.address}</Text>
                  <Text style={os.text}>
                    {order ? orderStatus[order.status] : "Заказ ещё не создан"}
                  </Text>
                  {order && (
                    <OButton
                      title="Открыть заказ"
                      disabled={busy}
                      onPress={() => {
                        setSelected(order.id);
                        setComment("");
                      }}
                    />
                  )}
                </View>
              );
            })}
          {picked && (
            <View style={os.card}>
              <Text style={os.heading}>
                Заказ:{" "}
                {
                  context.locations.find((l) => l.id === picked.location_id)
                    ?.name
                }
              </Text>
              <Text style={os.text}>{orderStatus[picked.status]}</Text>
              {picked.manager_comment && (
                <Text style={os.muted}>{picked.manager_comment}</Text>
              )}
              {(picked.items || []).map((i: OrderItem) => (
                <View key={i.product_id}>
                  <Text style={os.text}>
                    {i.product_name_snapshot} · {i.quantity} ×{" "}
                    {i.unit_price_snapshot ?? "цена не задана"} ₽
                  </Text>
                  <Text style={os.muted}>
                    {i.supplier_name_snapshot || "Поставщик не указан"}
                  </Text>
                </View>
              ))}
              {picked.status === "submitted" && (
                <>
                  <TextInput
                    accessibilityLabel="Комментарий к заказу"
                    style={os.input}
                    placeholder="Причина возврата / комментарий"
                    placeholderTextColor="#aaa"
                    value={comment}
                    onChangeText={setComment}
                    maxLength={2000}
                    multiline
                  />
                  <OButton
                    title="Подтвердить"
                    disabled={busy}
                    onPress={() => void review("approved")}
                  />
                  <OButton
                    title="Вернуть на доработку"
                    disabled={busy || !comment.trim()}
                    onPress={() => void review("revision_requested")}
                  />
                </>
              )}
            </View>
          )}
          <Text style={os.title}>Сводный заказ</Text>
          <Text style={os.muted}>
            Только отправленные и подтверждённые заказы. Разные цены одного
            товара показаны отдельными строками.
          </Text>
          <OrderFilters
            filters={filters}
            onChange={setFilters}
            suppliers={catalog.suppliers}
            categories={[...new Set([...rows.values()].map((r) => r.category))]}
            showShortage={false}
          />
          <ScrollView horizontal>
            <View>
              <View style={{ flexDirection: "row" }}>
                <Text style={[os.cell, os.nameCell]}>Товар / поставщик</Text>
                <Text style={os.cell}>Цена</Text>
                {context.locations.map((l) => (
                  <Text key={l.id} style={os.cell}>
                    {l.name}
                  </Text>
                ))}
                <Text style={os.cell}>Всего</Text>
                <Text style={os.cell}>Сумма ₽</Text>
              </View>
              {summary.map((r) => (
                <View key={r.key} style={{ flexDirection: "row" }}>
                  <Text style={[os.cell, os.nameCell]}>
                    {r.name}
                    {"\n"}
                    {r.supplier}
                  </Text>
                  <Text style={os.cell}>{r.price ?? "—"}</Text>
                  {context.locations.map((l) => (
                    <Text key={l.id} style={os.cell}>
                      {r.quantities[l.id] || "—"}
                    </Text>
                  ))}
                  <Text style={os.cell}>{Number(r.total.toFixed(3))}</Text>
                  <Text style={os.cell}>{r.amount.toFixed(2)}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
          {!summary.length && (
            <Text style={os.muted}>В сводке пока нет товаров.</Text>
          )}
          <Text style={os.heading}>
            Итог всей сводки:{" "}
            {[...rows.values()].reduce((n, r) => n + r.amount, 0).toFixed(2)} ₽
          </Text>
        </>
      ) : (
        <>
          <Text style={os.heading}>Настройка каталога</Text>
          <Text style={os.muted}>
            Пустая сумма означает «не задана» и блокирует отправку выбранных
            товаров. Для поставщика без минимума укажите 0.
          </Text>
          <Choice
            value={editKind}
            options={[
              { id: "supplier", name: "Минимумы поставщиков" },
              { id: "product", name: "Цены и поставщики товаров" },
            ]}
            onChange={(v) => {
              setEditKind(v);
              setEditId("");
              setQuery("");
            }}
            disabled={busy}
          />
          <TextInput
            accessibilityLabel="Поиск в каталоге"
            style={os.input}
            placeholder="Найти…"
            placeholderTextColor="#aaa"
            value={query}
            onChangeText={setQuery}
          />
          {editId && (
            <View style={os.card}>
              <Text style={os.heading}>
                {entries.find((p) => p.id === editId)?.name}
              </Text>
              <TextInput
                accessibilityLabel={
                  editKind === "supplier" ? "Минимальная сумма" : "Цена товара"
                }
                style={os.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="Не задано"
                placeholderTextColor="#aaa"
                maxLength={13}
              />
              {editKind === "product" && (
                <Choice
                  value={supplier}
                  options={[
                    { id: "", name: "Поставщик не задан" },
                    ...catalog.suppliers,
                  ]}
                  onChange={setSupplier}
                  disabled={busy}
                />
              )}
              <OButton
                title="Сохранить изменение"
                disabled={busy}
                onPress={() => void edit()}
              />
              <OButton
                title="Отмена"
                disabled={busy}
                onPress={() => setEditId("")}
              />
            </View>
          )}
          {entries
            .filter((e) => e.name.toLowerCase().includes(query.toLowerCase()))
            .map((e) => (
              <View style={os.card} key={e.id}>
                <Text style={os.text}>{e.name}</Text>
                <Text style={os.muted}>
                  {"unit_price" in e
                    ? (e.unit_price ?? "Цена не задана")
                    : (e.minimum_order_amount ?? "Минимум не задан")}{" "}
                  ₽
                </Text>
                <OButton
                  title="Изменить"
                  disabled={busy}
                  onPress={() => choose(e.id)}
                />
              </View>
            ))}
        </>
      )}
    </ScrollView>
  );
}
