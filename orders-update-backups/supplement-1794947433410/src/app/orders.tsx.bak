/* eslint-disable react-hooks/set-state-in-effect -- Reset remote data immediately when account or reporting period changes; stale data must not remain editable. */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/providers/auth";
import {
  emptyFilters,
  OButton,
  OrderFilters,
  os,
  type Filters,
} from "@/components/order-ui";
import { OrdersAdmin } from "@/components/orders-admin";
import {
  decimalUnits,
  evaluateOrder,
  filterProducts,
  lineAmount,
  sumMoney,
} from "@/lib/order-rules";
import {
  monday,
  orderError,
  orderStatus,
  ordersRpc,
  shiftWeek,
  type Catalog,
  type Order,
  type OrderContext,
  type OrderItem,
} from "@/lib/orders-api";
export default function OrdersScreen() {
  const { session } = useAuth();
  const [week, setWeek] = useState(monday());
  const [context, setContext] = useState<OrderContext | null>(null);
  const [catalog, setCatalog] = useState<Catalog>({
    products: [],
    suppliers: [],
  });
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const [reload, setReload] = useState(0);
  const live = useRef(0);
  const working = useRef(false);
  const localWrites = useRef(Promise.resolve());
  const draftKey = `bm:order-draft:${session?.user.id}:${week}`;
  // Clear the previous account/week before fetching so stale orders cannot be edited.
  useEffect(() => {
    let active = true;
    const generation = ++live.current;
    setLoading(true);
    setBusy(false);
    setContext(null);
    setOrder(null);
    setQuantities({});
    setDirty(false);
    setError("");
    setNotice("");
    (async () => {
      const [ctx, cat] = await Promise.all([
        ordersRpc<OrderContext>("bm_orders_context"),
        ordersRpc<Catalog>("bm_orders_catalog"),
      ]);
      if (!active || generation !== live.current) return;
      setContext(ctx);
      setCatalog(cat);
      if (!ctx.isAdmin) {
        const result = await ordersRpc<{ order: Order; items: OrderItem[] }>(
          "bm_orders_open",
          { p_week: week },
        );
        if (!active) return;
        const q = Object.fromEntries(
          result.items.map((i) => [i.product_id, i.quantity]),
        );
        setOrder(result.order);
        setOrderItems(result.items);
        setQuantities(q);
        try {
          const raw = await AsyncStorage.getItem(draftKey);
          if (!active) return;
          if (
            raw &&
            ["draft", "revision_requested"].includes(result.order.status)
          ) {
            const local = JSON.parse(raw) as {
              orderId: string;
              revision: number;
              quantities: Record<string, string>;
            };
            if (
              local.orderId === result.order.id &&
              local.revision === result.order.revision &&
              local.quantities &&
              typeof local.quantities === "object" &&
              Object.values(local.quantities).every(
                (v) => typeof v === "string" && v.length <= 12,
              )
            ) {
              setQuantities(local.quantities);
              setDirty(true);
              setNotice(
                "Восстановлены несохранённые изменения на этом устройстве.",
              );
            } else {
              setNotice(
                "На сервере более новая версия заказа. Загружена она; старые локальные изменения не применены.",
              );
            }
          }
        } catch {
          if (active)
            setNotice(
              "Локальный черновик недоступен. Сохраняйте заказ кнопкой ниже.",
            );
        }
      }
    })()
      .catch((e) => {
        if (active) setError(orderError(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      live.current = generation + 1;
    };
  }, [week, session?.user.id, reload, draftKey]);
  const editable =
    !!order && ["draft", "revision_requested"].includes(order.status);
  const currentProducts = catalog.products
    .filter((p) => p.is_active)
    .map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category || "Без раздела",
      supplierId: p.supplier_id,
      price: p.unit_price,
    }));
  const currentVendors = catalog.suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    minimum: s.minimum_order_amount,
  }));
  const products = editable
    ? currentProducts
    : orderItems.map((i) => ({
        id: i.product_id,
        name: i.product_name_snapshot,
        category: i.category_snapshot || "Без раздела",
        supplierId: i.supplier_id_snapshot,
        price: i.unit_price_snapshot,
      }));
  const vendors = editable
    ? currentVendors
    : [
        ...new Map(
          orderItems
            .filter((i) => i.supplier_id_snapshot)
            .map((i) => [
              i.supplier_id_snapshot!,
              {
                id: i.supplier_id_snapshot!,
                name: i.supplier_name_snapshot || "Не указан",
                minimum:
                  i.minimum_snapshot === null
                    ? null
                    : String(i.minimum_snapshot),
              },
            ]),
        ).values(),
      ];
  const check = evaluateOrder(products, vendors, quantities);
  const unavailable = Object.entries(quantities).some(
    ([id, q]) =>
      Number(q.replace(",", ".")) > 0 &&
      (!catalog.products.find((p) => p.id === id)?.is_active ||
        !catalog.suppliers.find(
          (s) =>
            s.id === catalog.products.find((p) => p.id === id)?.supplier_id,
        )?.is_active),
  );
  const shown = filterProducts(products, check.supplierTotals, filters).filter(
    (p) =>
      p.name
        .toLocaleLowerCase("ru")
        .includes(filters.query.toLocaleLowerCase("ru")),
  );
  const missing = Object.keys(quantities).filter(
    (id) =>
      !products.some((p) => p.id === id) &&
      Number(quantities[id].replace(",", ".")) > 0,
  );
  function change(id: string, q: string) {
    const next = { ...quantities, [id]: q };
    setQuantities(next);
    setDirty(true);
    setNotice("Есть изменения, не сохранённые на сервере.");
    const data = JSON.stringify({
      orderId: order?.id,
      revision: order?.revision,
      quantities: next,
    });
    localWrites.current = localWrites.current
      .then(() => AsyncStorage.setItem(draftKey, data))
      .catch(() => {
        setNotice(
          "Не удалось сохранить локальную копию. Сохраните черновик на сервер.",
        );
      });
  }
  async function save(submit = false) {
    if (!order || working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    const generation = live.current;
    try {
      const items = [];
      for (const [id, input] of Object.entries(quantities)) {
        if (!input.trim()) continue;
        const q = decimalUnits(input, 3);
        if (q === null)
          throw Error(
            "Исправьте некорректное количество. Допустимы до трёх знаков после запятой.",
          );
        if (q > 0n) {
          const p = catalog.products.find((p) => p.id === id);
          const supplier = catalog.suppliers.find(
            (s) => s.id === p?.supplier_id,
          );
          items.push({
            product_id: id,
            quantity: input.trim().replace(",", "."),
            expected_price: p?.unit_price ?? null,
            expected_supplier: p?.supplier_id ?? null,
            expected_minimum: supplier?.minimum_order_amount ?? null,
          });
        }
      }
      const result = await ordersRpc<{
        revision: number;
        catalogChanged: boolean;
      }>("bm_orders_save", {
        p_order: order.id,
        p_revision: order.revision,
        p_items: items,
      });
      if (generation !== live.current) return;
      setOrder({ ...order, revision: result.revision });
      setDirty(false);
      await localWrites.current;
      await AsyncStorage.removeItem(draftKey).catch(() => {});
      if (submit && result.catalogChanged) {
        setCatalog(await ordersRpc<Catalog>("bm_orders_catalog"));
        setNotice(
          "Цены или минимумы изменились. Черновик сохранён. Проверьте новые суммы и нажмите отправку повторно.",
        );
        return;
      }
      if (submit) {
        const sent = await ordersRpc<{ ok: boolean; issues?: string[] }>(
          "bm_orders_submit",
          { p_order: order.id, p_revision: result.revision },
        );
        if (!sent.ok) {
          setError((sent.issues || []).join("\n"));
          setCatalog(await ordersRpc<Catalog>("bm_orders_catalog"));
          setNotice("Черновик сохранён. Проверьте причины блокировки.");
        } else {
          setReload((n) => n + 1);
        }
      } else {
        setCatalog(await ordersRpc<Catalog>("bm_orders_catalog"));
        setNotice("Черновик сохранён на сервере.");
      }
    } catch (e) {
      if (generation === live.current) setError(orderError(e));
    } finally {
      working.current = false;
      if (generation === live.current) setBusy(false);
    }
  }
  return (
    <SafeAreaView style={os.screen}>
      <View style={{ padding: 16, gap: 10 }}>
        <View style={os.row}>
          <OButton
            title="‹ Главная"
            disabled={busy}
            onPress={() => router.back()}
          />
          <Text style={os.title}>Заказы</Text>
        </View>
        <View style={os.row}>
          <OButton
            title="‹ Неделя"
            disabled={loading || busy || dirty}
            onPress={() => setWeek(shiftWeek(week, -7))}
          />
          <Text style={os.text}>{week}</Text>
          <OButton
            title="Неделя ›"
            disabled={loading || busy || dirty}
            onPress={() => setWeek(shiftWeek(week, 7))}
          />
        </View>
        {!!error && (
          <>
            <Text accessibilityRole="alert" style={os.error}>
              {error}
            </Text>
            <OButton
              title="Загрузить серверную версию вместо текущих изменений"
              disabled={busy}
              onPress={() => {
                void localWrites.current
                  .then(() => AsyncStorage.removeItem(draftKey))
                  .then(() => setReload((n) => n + 1))
                  .catch((e) => setError(orderError(e)));
              }}
            />
          </>
        )}
        {!!notice && <Text style={os.muted}>{notice}</Text>}
      </View>
      {loading ? (
        <ActivityIndicator color="#EE9EA4" />
      ) : !context ? (
        <View style={os.content}>
          <OButton title="Повторить" onPress={() => setReload((n) => n + 1)} />
        </View>
      ) : context.isAdmin ? (
        <OrdersAdmin
          context={context}
          catalog={catalog}
          setCatalog={setCatalog}
          week={week}
        />
      ) : !order ? (
        <View style={os.content}>
          <OButton
            title="Повторить загрузку заказа"
            onPress={() => setReload((n) => n + 1)}
          />
        </View>
      ) : (
        <>
          <FlatList
            data={shown}
            keyExtractor={(p) => p.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
            ListHeaderComponent={
              <View style={{ gap: 12, paddingBottom: 15 }}>
                <Text style={os.heading}>
                  {context.locations[0]?.name} · {orderStatus[order.status]}
                </Text>
                {!!order.manager_comment && (
                  <Text style={os.error}>
                    Комментарий: {order.manager_comment}
                  </Text>
                )}
                <OButton
                  title="Обновить с сервера"
                  disabled={busy || dirty}
                  onPress={() => setReload((n) => n + 1)}
                />
                <OrderFilters
                  filters={filters}
                  onChange={setFilters}
                  suppliers={vendors}
                  categories={[...new Set(products.map((p) => p.category))]}
                />
                {missing.map((id) => (
                  <View key={id} style={os.card}>
                    <Text style={os.error}>
                      Недоступный товар в черновике: {id}
                    </Text>
                    <OButton
                      title="Убрать из заказа"
                      disabled={!editable || busy}
                      onPress={() => change(id, "0")}
                    />
                  </View>
                ))}
                <Text style={os.muted}>
                  Товаров: {shown.length}. Цена — за единицу заказа из таблицы.
                </Text>
              </View>
            }
            ListEmptyComponent={
              <Text style={os.muted}>Товары не найдены. Измените фильтры.</Text>
            }
            renderItem={({ item: p }) => (
              <View style={os.card}>
                <Text style={os.heading}>{p.name}</Text>
                <Text style={os.muted}>
                  {p.category} ·{" "}
                  {vendors.find((s) => s.id === p.supplierId)?.name ||
                    "Поставщик не указан"}
                </Text>
                <View style={os.row}>
                  <Text style={[os.text, { flex: 1 }]}>
                    {p.price === null ? "Цена не задана" : `${p.price} ₽`}
                  </Text>
                  <TextInput
                    accessibilityLabel={`Количество: ${p.name}`}
                    editable={editable && !busy}
                    keyboardType="decimal-pad"
                    maxLength={12}
                    placeholder="0"
                    placeholderTextColor="#aaa"
                    value={quantities[p.id] || ""}
                    onChangeText={(q) => change(p.id, q)}
                    style={[os.input, os.qty]}
                  />
                </View>
                <Text style={os.muted}>
                  Сумма:{" "}
                  {lineAmount(p.price, quantities[p.id] || "0") ??
                    "не рассчитана"}{" "}
                  ₽
                </Text>
              </View>
            )}
          />
          <View style={os.footer}>
            <Text style={os.heading}>
              Итого: {sumMoney(check.supplierTotals.map((t) => t.amount))} ₽
              {check.supplierTotals.some((t) => t.incomplete)
                ? " (неполная сумма)"
                : ""}
            </Text>
            <ScrollView style={{ maxHeight: 130 }}>
              {check.supplierTotals.map((t) => (
                <Text
                  key={t.id}
                  style={
                    t.shortfall && Number(t.shortfall) > 0 ? os.error : os.muted
                  }
                >
                  {t.name}: {t.amount} / {t.minimum ?? "минимум не задан"} ₽
                  {t.shortfall && Number(t.shortfall) > 0
                    ? ` · не хватает ${t.shortfall} ₽`
                    : ""}
                </Text>
              ))}
              {editable &&
                check.issues.map((issue, i) => (
                  <Text key={i} style={os.error}>
                    {issue}
                  </Text>
                ))}
              {editable && unavailable && (
                <Text style={os.error}>
                  В заказе есть недоступный товар или поставщик.
                </Text>
              )}
            </ScrollView>
            {editable ? (
              <View style={os.row}>
                <OButton
                  title={busy ? "Сохраняем…" : "Сохранить черновик"}
                  disabled={busy}
                  onPress={() => void save()}
                />
                <OButton
                  title="Отправить администратору"
                  disabled={busy || !check.canSubmit || unavailable}
                  onPress={() => void save(true)}
                />
              </View>
            ) : (
              <Text style={os.success}>
                Заказ доступен администратору. Редактирование закрыто.
              </Text>
            )}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
