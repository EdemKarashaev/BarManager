import { OrderCycleManager } from "@/components/order-cycle-manager";
import type { OrderCycle } from "@/lib/orders-api";
import { useAppTheme } from '@/providers/theme';
import { OrderProductCreate } from "@/components/order-product-create";
import { blockUpdates } from "@/lib/update-guard";
/* eslint-disable react-hooks/set-state-in-effect -- Reset remote data immediately when account or reporting period changes; stale data must not remain editable. */

import { decimalUnits } from "@/lib/order-rules";

import {
  orderError,

  ordersRpc,

  orderStatus,

  type Catalog,

  type Order,

  type OrderContext,
} from "@/lib/orders-api";

import { useEffect, useRef, useState } from "react";

import {
  exportAllSuppliersZip,

  exportSupplierExcel,
} from "@/lib/order-excel-export";

import { FlatList, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

import {
  Choice,

  emptyFilters,

  OButton,

  OrderFilters,

  getThemeos,

  type Filters,
} from "../../components/order-ui";

type SummaryRow = {

  key: string;

  productId: string;

  name: string;

  supplier: string;

  supplierId: string | null;

  category: string;

  price: string | null;

  quantities: Record<string, number>;

  total: number;

  amount: number;

};

function AdminQuantityCell({

  value,

  disabled,

  onSave,
  mobile = false,

}: {

  mobile?: boolean;
  value: number;

  disabled: boolean;

  onSave: (quantity: number) => Promise<boolean>;

}) {
  const { mode: bmMode } = useAppTheme();
  const os = getThemeos(bmMode);


  const [text, setText] = useState(String(value));

  const [focused, setFocused] = useState(false);

  const [saving, setSaving] = useState(false);

  const savingRef = useRef(false);

  useEffect(() => {

    if (!focused && !saving) setText(String(value));

  }, [value, focused, saving]);

  async function save() {

    if (disabled || savingRef.current) return;

    const raw = text.trim().replace(",", ".");

    const parsed = Number(raw);

    if (!raw || !/^\d+(\.\d{1,3})?$/.test(raw) || !Number.isFinite(parsed)) {

      setText(String(value));

      return;

    }

    if (parsed === value) return;

    savingRef.current = true;

    setSaving(true);

    try {

      if (!(await onSave(parsed))) setText(String(value));

    } catch {

      setText(String(value));

    } finally {

      savingRef.current = false;

      setSaving(false);

    }

  }

  return (

    <View style={mobile
      ? { width: "100%", padding: 3, justifyContent: "center" }
      : [os.cell, { padding: 3, justifyContent: "center" }]
    }>

      <TextInput

        accessibilityLabel="Количество для ресторана"

        value={text}

        onChangeText={setText}

        onFocus={() => setFocused(true)}

        onBlur={() => { setFocused(false); void save(); }}

        onSubmitEditing={() => void save()}

        keyboardType="decimal-pad"

        selectTextOnFocus

        editable={!disabled && !saving}

        style={{ color: disabled ? "#888" : "#fff", backgroundColor: (bmMode === 'light' ? '#F5F5F5' : "#292b30"), borderColor: focused ? "#c7a56b" : "#505056", borderWidth: 1, borderRadius: 5, textAlign: "center", minHeight: 34, padding: 3 }}

      />

    </View>

  );

}



function CatalogAmountCell({

  value,

  disabled,

  label,

  onSave,

}: {

  value: string | null | undefined;

  disabled: boolean;

  label: string;

  onSave: (amount: string | null) => Promise<boolean>;

}) {
  const { mode: bmMode } = useAppTheme();
  const os = getThemeos(bmMode);


  const original = value ?? "";

  const [text, setText] = useState(original);

  const [focused, setFocused] = useState(false);

  const [saving, setSaving] = useState(false);

  const lock = useRef(false);

  useEffect(() => {

    if (!focused && !saving) setText(original);

  }, [original, focused, saving]);

  async function save() {

    if (disabled || lock.current) return;

    const normalized = text.trim().replace(",", ".");

    if (normalized && (!/^\d+(\.\d{1,2})?$/.test(normalized) || !Number.isFinite(Number(normalized)))) {

      setText(original);

      return;

    }

    const next = normalized ? String(Number(normalized)) : null;

    if ((next ?? "") === (original ? String(Number(original)) : "")) return;

    lock.current = true;

    setSaving(true);

    try {

      if (!(await onSave(next))) setText(original);

    } catch {

      setText(original);

    } finally {

      lock.current = false;

      setSaving(false);

    }

  }

  return (

    <View style={[os.cell, { padding: 3, justifyContent: "center" }]}>

      <TextInput

        accessibilityLabel={label}

        value={text}

        onChangeText={setText}

        onFocus={() => setFocused(true)}

        onBlur={() => { setFocused(false); void save(); }}

        onSubmitEditing={() => void save()}

        keyboardType="decimal-pad"

        selectTextOnFocus

        placeholder="Не задано"

        placeholderTextColor={(bmMode === 'light' ? '#666666' : "#888")}

        editable={!disabled && !saving}

        style={{ color: (bmMode === 'light' ? '#111111' : "#fff"), backgroundColor: (bmMode === 'light' ? '#F5F5F5' : "#292b30"), borderColor: focused ? "#c7a56b" : "#505056", borderWidth: 1, borderRadius: 5, minHeight: 34, padding: 4, textAlign: "center" }}

      />

    </View>

  );

}



function SupplierDropdown({

  value,

  suppliers,

  disabled,

  productName,

  onChange,

}: {

  value: string | null;

  suppliers: Catalog["suppliers"];

  disabled: boolean;

  productName: string;

  onChange: (supplierId: string | null) => Promise<boolean>;

}) {
  const { mode: bmMode } = useAppTheme();


  const [open, setOpen] = useState(false);

  const [search, setSearch] = useState("");

  const currentName = suppliers.find((s) => s.id === value)?.name ?? "Не указан";

  const options = [{ id: "", name: "Не указан" }, ...suppliers]

    .filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase()));



  async function choose(id: string) {

    setOpen(false);

    setSearch("");

    if ((id || null) !== value) await onChange(id || null);

  }



  return (

    <View style={{ width: 230, padding: 3, justifyContent: "center" }}>

      <TouchableOpacity

        accessibilityRole="button"

        accessibilityLabel={`Поставщик для ${productName}: ${currentName}`}

        disabled={disabled}

        onPress={() => setOpen(true)}

        style={{ minHeight: 38, borderWidth: 1, borderColor: (bmMode === 'light' ? '#DDDDDD' : "#505056"), borderRadius: 6, backgroundColor: (bmMode === 'light' ? '#F5F5F5' : "#292b30"), paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 }}

      >

        <Text numberOfLines={1} style={{ color: (bmMode === 'light' ? '#111111' : "#fff"), flex: 1 }}>{currentName}</Text>

        <Text style={{ color: (bmMode === 'light' ? '#B00020' : "#c7a56b") }}>▾</Text>

      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>

        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.7)", padding: 20 }}>

          <View style={{ width: "100%", maxWidth: 440, maxHeight: "80%", backgroundColor: (bmMode === 'light' ? '#F5F5F5' : "#202226"), borderColor: (bmMode === 'light' ? '#DDDDDD' : "#505056"), borderWidth: 1, borderRadius: 12, padding: 16 }}>

            <Text style={{ color: (bmMode === 'light' ? '#111111' : "#fff"), fontSize: 18, fontWeight: "700", marginBottom: 12 }}>Выбрать поставщика</Text>

            <Text style={{ color: (bmMode === 'light' ? '#666666' : "#aaa"), marginBottom: 10 }} numberOfLines={2}>{productName}</Text>

            <TextInput

              accessibilityLabel="Поиск поставщика"

              value={search}

              onChangeText={setSearch}

              placeholder="Поиск поставщика…"

              placeholderTextColor={(bmMode === 'light' ? '#666666' : "#999")}

              style={{ color: (bmMode === 'light' ? '#111111' : "#fff"), backgroundColor: (bmMode === 'light' ? '#F5F5F5' : "#303238"), borderRadius: 7, padding: 10, marginBottom: 10 }}

            />

            <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }}>

              {options.map((option) => (

                <TouchableOpacity

                  key={option.id || "none"}

                  onPress={() => void choose(option.id)}

                  style={{ paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: (bmMode === 'light' ? '#DDDDDD' : "#383a40"), flexDirection: "row", justifyContent: "space-between" }}

                >

                  <Text style={{ color: (bmMode === 'light' ? '#111111' : "#fff"), flex: 1 }}>{option.name}</Text>

                  {(value ?? "") === option.id && <Text style={{ color: (bmMode === 'light' ? '#B00020' : "#c7a56b") }}>✓</Text>}

                </TouchableOpacity>

              ))}

              {!options.length && <Text style={{ color: (bmMode === 'light' ? '#666666' : "#aaa"), padding: 12 }}>Поставщики не найдены</Text>}

            </ScrollView>

            <TouchableOpacity onPress={() => { setOpen(false); setSearch(""); }} style={{ padding: 12, marginTop: 12, alignItems: "center" }}>

              <Text style={{ color: (bmMode === 'light' ? '#B00020' : "#c7a56b"), fontWeight: "600" }}>Отмена</Text>

            </TouchableOpacity>

          </View>

        </View>

      </Modal>

    </View>

  );

}



export function OrdersAdmin({

  context,

  catalog,

  setCatalog,

  week: initialWeek,
  cycleId: initialCycleId = null,

}: {

  context: OrderContext;

  catalog: Catalog;

  setCatalog: (c: Catalog) => void;

  week: string;
  cycleId?: string | null;

}) {
  const { mode: bmMode } = useAppTheme();
  const os = getThemeos(bmMode);

  useEffect(() => blockUpdates(), []);


  const [tab, setTab] = useState("orders");

  const [orders, setOrders] = useState<Order[]>([]);

  const [error, setError] = useState("");

  const [loading, setLoading] = useState(true);

  const [busy, setBusy] = useState(false);

  const [reload, setReload] = useState(0);

  const [filters, setFilters] = useState<Filters>(emptyFilters);

  const [editKind, setEditKind] = useState("supplier");

  const [query, setQuery] = useState("");

  const [message, setMessage] = useState("");

  const [showAllProducts, setShowAllProducts] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [selectedCycle, setSelectedCycle] =
    useState<OrderCycle | null>(null);

  const week = selectedCycle?.week_start ?? initialWeek;

  // До серверной активации используем старый API.
  const cycleId = selectedCycle?.id ?? initialCycleId;

  const orderLabel = selectedCycle
    ? `${selectedCycle.name}_${new Date(
        selectedCycle.check_at
      ).toLocaleDateString("ru-RU", {
        timeZone: "Europe/Moscow",
      })}_${selectedCycle.id.slice(0, 8)}`
    : week;


  const [androidLocationIndex, setAndroidLocationIndex] = useState(0);
  const isAndroid = Platform.OS === "android";
  const selectedLocation = context.locations[Math.min(androidLocationIndex, Math.max(0, context.locations.length - 1))];

  // Clear selection when the remote reporting period changes.

  useEffect(() => {

    let active = true;

    setLoading(true);

    setError("");

    ordersRpc<Order[]>(
      cycleId
        ? "bm_orders_dashboard_cycle"
        : "bm_orders_dashboard",
      cycleId
        ? { p_cycle_id: cycleId }
        : { p_week: week }
    )

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

  }, [week, cycleId, reload]);

  const exportSummary = new Map<string, SummaryRow>();

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

      const row = exportSummary.get(key) || {

        key,

        productId: it.product_id,

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

      exportSummary.set(key, row);

    }

  }


  const rows = new Map<string, SummaryRow>();

  for (const o of orders.filter((o) =>

    ["draft", "revision_requested", "submitted", "approved"].includes(o.status),

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

        productId: it.product_id,

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

  // Add products not present in any submitted order, only when requested.

  if (showAllProducts) {

    const existingProductIds = new Set([...rows.values()].map((r) => r.productId));
    const suppliersById = new Map(catalog.suppliers.map((supplier) => [supplier.id, supplier]));
    for (const p of catalog.products) {

      if (existingProductIds.has(p.id)) continue;

      const sp = suppliersById.get(p.supplier_id ?? "");

      const key = JSON.stringify(["catalog", p.id]);

      rows.set(key, {

        key,

        productId: p.id,

        name: p.name,

        supplier: sp?.name || "Не указан",

        supplierId: p.supplier_id,

        category: p.category || "Без раздела",

        price: p.unit_price,

        quantities: {},

        total: 0,

        amount: 0,

      });

    }

  }

  const productRowCounts = new Map<string, number>();

  for (const r of rows.values()) {

    productRowCounts.set(r.productId, (productRowCounts.get(r.productId) || 0) + 1);

  }

  async function saveAdminQuantity(productId: string, locationId: string, quantity: number) {

    if (busy) return false;

    setBusy(true);

    setError("");

    setMessage("");

    try {

      // Requires the matching administrator-only RPC in Supabase.

      await ordersRpc(
        cycleId
          ? "bm_orders_admin_set_quantity_cycle_v2"
          : "bm_orders_admin_set_quantity_v2",
        {

        ...(cycleId
          ? { p_cycle_id: cycleId }
          : { p_week: week }),

        p_location_id: locationId,

        p_product_id: productId,

        p_quantity: quantity,
        p_expected_revision:
          orders.find((o) => o.location_id === locationId)?.revision ?? null,


      });

      setReload((n) => n + 1);

      return true;

    } catch (e) {

      setError("Не удалось сохранить количество: " + orderError(e));

      return false;

    } finally {

      setBusy(false);

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

  // Export from the complete order summary, independent of on-screen filters.
  // Each location keeps its own quantity column.
  const exportRows = [...exportSummary.values()]
    .filter((r) => r.total > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));

  const exportSuppliers = [...new Map(
    exportRows.map((r) => [
      r.supplierId ?? `unknown:${r.supplier}`,
      { id: r.supplierId, name: r.supplier },
    ] as const),
  ).values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));

  async function downloadAll() {
    if (loading || busy || exporting) return;
    setExporting(true);
    setError("");
    try {
      await exportAllSuppliersZip(exportRows, context.locations, orderLabel);
    } catch (e) {
      setError("Не удалось выгрузить заказы: " + orderError(e));
    } finally {
      setExporting(false);
    }
  }

  async function downloadSupplier(id: string | null, name: string) {
    if (loading || busy || exporting) return;
    setExporting(true);
    setError("");
    try {
      const supplierRows = exportRows.filter((r) =>
        id === null
          ? r.supplierId === null && r.supplier === name
          : r.supplierId === id,
      );
      await exportSupplierExcel(supplierRows, context.locations, name, orderLabel);
    } catch (e) {
      setError("Не удалось выгрузить поставщика: " + orderError(e));
    } finally {
      setExporting(false);
    }
  }

  async function approveOrder(order: Order) {

    if (busy || order.status !== "submitted") return;

    setBusy(true);

    setError("");

    setMessage("");

    try {

      await ordersRpc("bm_orders_review", {

        p_order: order.id,

        p_revision: order.revision,

        p_action: "approved",

        p_comment: "",

      });

      setMessage("Заказ подтверждён.");

      setReload((n) => n + 1);

    } catch (e) {

      setError("Не удалось подтвердить заказ: " + orderError(e));

    } finally {

      setBusy(false);

    }

  }

  async function returnOrderToBartender(order: Order) {

    if (busy || order.status !== "approved") return;

    setBusy(true);

    setError("");

    setMessage("");

    try {

      await ordersRpc("bm_orders_review", {

        p_order: order.id,

        p_revision: order.revision,

        p_action: "revision_requested",

        p_comment: "Подтверждение отменено администратором. Заказ возвращён на заполнение.",

      });

      setMessage("Подтверждение отменено. Заказ возвращён бармену на заполнение.");

      setReload((n) => n + 1);

    } catch (e) {

      setError("Не удалось отменить подтверждение: " + orderError(e));

    } finally {

      setBusy(false);

    }

  }

  async function saveCatalogCell(

    kind: "supplier" | "product",

    id: string,

    nextAmount: string | null,

    supplierId: string | null = null,

  ): Promise<boolean> {

    if (busy) return false;

    setBusy(true);

    setError("");

    setMessage("");

    try {

      await ordersRpc("bm_orders_catalog_edit", {

        p_kind: kind,

        p_id: id,

        p_amount: nextAmount,

        p_supplier: kind === "product" ? supplierId : null,

      });

      setCatalog(await ordersRpc<Catalog>("bm_orders_catalog"));

      setMessage("Каталог обновлён. В отправленных заказах прежние цены сохранены.");

      return true;

    } catch (e) {

      setError("Не удалось сохранить изменение: " + orderError(e));

      return false;

    } finally {

      setBusy(false);

    }

  }

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

          <Text style={os.title}>Сводный заказ</Text>

          <Text style={os.muted}>

            Сводка всех заказов, включая черновики. При включении галочки

            также показываются товары из каталога. Товары с несколькими ценами

            временно недоступны для изменения количества.

          </Text>

          <OrderFilters

            filters={filters}

            onChange={setFilters}

            suppliers={catalog.suppliers}

            categories={[...new Set([...rows.values()].map((r) => r.category))]}

            showShortage={false}

          />

          <TouchableOpacity

            accessibilityRole="checkbox"

            accessibilityState={{ checked: showAllProducts }}

            onPress={() => setShowAllProducts((v) => !v)}

            style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 10 }}

          >

            <Text style={{ color: (bmMode === 'light' ? '#B00020' : "#c7a56b"), fontSize: 21 }}>{showAllProducts ? "☑" : "☐"}</Text>

            <Text style={os.text}>Показать все товары</Text>

          </TouchableOpacity>

          <View style={{ gap: 8, marginVertical: 12 }}>
          <Text style={os.heading}>Экспорт заказов в Excel</Text>
          <OButton
            title={exporting ? "Подготавливаем файлы…" : "Скачать все заказы (ZIP)"}
            disabled={loading || busy || exporting || !exportRows.length}
            onPress={() => void downloadAll()}
          />
          {exportSuppliers.map((supplier) => (
            <OButton
              key={supplier.id ?? `unknown:${supplier.name}`}
              title={`Excel · ${supplier.name}`}
              disabled={loading || busy || exporting}
              onPress={() => void downloadSupplier(supplier.id, supplier.name)}
            />
          ))}
          <Text style={os.muted}>
            Черновики не выгружаются. Отдельный Excel для каждого поставщика: товары слева, рестораны сверху, количество в ячейках.
          </Text>
        </View>
        <Text style={os.muted}>Нажмите на количество, чтобы изменить его. Сохранение — Enter или переход в другую ячейку.</Text>

          {isAndroid ? (
            <View style={{ gap: 10, marginBottom: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <TouchableOpacity
                  accessibilityLabel="Предыдущий ресторан"
                  disabled={androidLocationIndex === 0 || busy}
                  onPress={() => setAndroidLocationIndex((index) => Math.max(0, index - 1))}
                  style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: (bmMode === 'light' ? '#F5F5F5' : "#292b30"), borderRadius: 8, opacity: androidLocationIndex === 0 ? 0.4 : 1 }}
                >
                  <Text style={os.text}>‹</Text>
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: "center" }}>
                  <Text style={os.heading} numberOfLines={2}>{selectedLocation?.name ?? "Нет ресторанов"}</Text>
                  <Text style={os.muted}>{context.locations.length ? `${Math.min(androidLocationIndex + 1, context.locations.length)} из ${context.locations.length}` : ""}</Text>
                </View>
                <TouchableOpacity
                  accessibilityLabel="Следующий ресторан"
                  disabled={androidLocationIndex >= context.locations.length - 1 || busy}
                  onPress={() => setAndroidLocationIndex((index) => Math.min(context.locations.length - 1, index + 1))}
                  style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: (bmMode === 'light' ? '#F5F5F5' : "#292b30"), borderRadius: 8, opacity: androidLocationIndex >= context.locations.length - 1 ? 0.4 : 1 }}
                >
                  <Text style={os.text}>›</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: "row", backgroundColor: (bmMode === 'light' ? '#F5F5F5' : "#25272b") }}>
                <Text style={[os.cell, { flex: 1.7, width: undefined, minWidth: 0, borderBottomWidth: 0 }]}>Товар / поставщик</Text>
                <Text style={[os.cell, { flex: 0.8, width: undefined, minWidth: 0, borderBottomWidth: 0 }]}>Цена</Text>
                <Text style={[os.cell, { flex: 0.9, width: undefined, minWidth: 0, borderBottomWidth: 0 }]}>Кол-во</Text>
              </View>
              <FlatList
                data={summary}
                keyExtractor={(row) => row.key}
                style={{ height: 470, flexGrow: 0 }}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                initialNumToRender={12}
                maxToRenderPerBatch={8}
                windowSize={5}
                removeClippedSubviews
                renderItem={({ item: row }) => (
                  <View style={{ flexDirection: "row",
                      alignItems: "center",
                      minHeight: 55,
                      paddingVertical: 8,
                      borderBottomWidth: 1,
                      borderBottomColor: (bmMode === 'light' ? '#DDDDDD' : "#383a40") }}>
                    <Text style={[os.cell, { flex: 1.7, width: undefined, minWidth: 0, borderBottomWidth: 0 }]} numberOfLines={3}>{row.name}{"\n"}{row.supplier}</Text>
                    <Text style={[os.cell, { flex: 0.8, width: undefined, minWidth: 0, borderBottomWidth: 0 }]}>{row.price ?? "—"}</Text>
                    <View style={{ flex: 0.9, minWidth: 0 }}>
                      {selectedLocation ? (
                        <AdminQuantityCell
                          key={`${row.key}:${selectedLocation.id}`} mobile
                          value={row.quantities[selectedLocation.id] ?? 0}
                          disabled={busy || loading || (productRowCounts.get(row.productId) || 0) > 1}
                          onSave={(quantity) => saveAdminQuantity(row.productId, selectedLocation.id, quantity)}
                        />
                      ) : null}
                    </View>
                  </View>
                )}
              />
              <Text style={os.muted}>Товаров: {summary.length} · Всего по выбранному ресторану: {selectedLocation ? summary.reduce((sum, row) => sum + (row.quantities[selectedLocation.id] ?? 0), 0) : 0}</Text>
            </View>
          ) : (
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

                    <AdminQuantityCell

                      key={`${r.key}:${l.id}`}

                      value={r.quantities[l.id] ?? 0}

                      disabled={busy || loading || (productRowCounts.get(r.productId) || 0) > 1}

                      onSave={(quantity) => saveAdminQuantity(r.productId, l.id, quantity)}

                    />

                  ))}

                  <Text style={os.cell}>{Number(r.total.toFixed(3))}</Text>

                  <Text style={os.cell}>{r.amount.toFixed(2)}</Text>

                </View>

              ))}

            </View>

          </ScrollView>

          )}

          {!summary.length && (

            <Text style={os.muted}>В сводке пока нет товаров.</Text>

          )}

          <Text style={os.heading}>

            Итог сводки с черновиками:{" "}

            {[...rows.values()].reduce((n, r) => n + r.amount, 0).toFixed(2)} ₽

          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>

            
            <OrderCycleManager
              selected={selectedCycle}
              week={week}
              disabled={loading || busy || exporting}
              onSelect={(cycle) => {
                if (loading || busy || exporting) return;

                if (
                  cycle.status !== "open"
                ) return;

                setSelectedCycle(cycle);
              }}
            />
<Text style={os.heading}>Рестораны · {selectedCycle?.name ?? week}</Text>

            <OButton

              title={loading ? "Обновляем…" : "Обновить заказы"}

              disabled={loading || busy}

              onPress={() => setReload((n) => n + 1)}

            />

          </View>

          {!loading && (

            <View style={{ gap: 5 }}>

              {context.locations.map((l) => {

                const order = orders.find((o) => o.location_id === l.id);

                const submitted = order?.status === "submitted";

                const approved = order?.status === "approved";

                return (

                  <View

                    key={l.id}

                    style={{

                      flexDirection: "row",

                      alignItems: "center",

                      justifyContent: "space-between",

                      flexWrap: "wrap",

                      gap: 8,

                      paddingVertical: 7,

                      paddingHorizontal: 10,

                      borderWidth: 1,

                      borderColor: (bmMode === 'light' ? '#DDDDDD' : "#383a40"),

                      borderRadius: 7,

                      backgroundColor: (bmMode === 'light' ? '#F5F5F5' : "#202226"),

                    }}

                  >

                    <View style={{ flex: 1, minWidth: 145 }}>

                      <Text style={[os.text, { fontWeight: "600" }]}>{l.name}</Text>

                      <Text style={os.muted}>

                        {order ? orderStatus[order.status] : "Заказ ещё не создан"}

                      </Text>

                    </View>

                    {submitted ? (

                      <OButton

                        title="Подтвердить заказ"

                        disabled={busy}

                        onPress={() => void approveOrder(order)}

                      />

                    ) : approved && order ? (

                      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 }}>

                        <Text style={[os.muted, { color: (bmMode === 'light' ? '#187747' : "#87c99b") }]}>✓ Подтверждён</Text>

                        <OButton

                          title="Отменить подтверждение"

                          disabled={busy}

                          onPress={() => void returnOrderToBartender(order)}

                        />

                      </View>

                    ) : (

                      <Text style={os.muted}>Ожидает отправки</Text>

                    )}

                  </View>

                );

              })}

            </View>

          )}

        </>

      ) : (

        <>

          <Text style={os.heading}>Настройка каталога</Text>

          <Text style={os.muted}>

            Пустая сумма означает «не задана» и блокирует отправку выбранных

            товаров. Для поставщика без минимума укажите 0.

          </Text>

          <OrderProductCreate
              catalog={catalog}
              setCatalog={setCatalog}
              disabled={busy || loading}
            />
            <Choice

            value={editKind}

            options={[

              { id: "supplier", name: "Минимумы поставщиков" },

              { id: "product", name: "Цены и поставщики товаров" },

            ]}

            onChange={(v) => { setEditKind(v); setQuery(""); }}

            disabled={busy}

          />

          <TextInput

            accessibilityLabel="Поиск в каталоге"

            style={os.input}

            placeholder="Поиск по названию…"

            placeholderTextColor={(bmMode === 'light' ? '#666666' : "#aaa")}

            value={query}

            onChangeText={setQuery}

          />

          <Text style={os.muted}>

            Изменяйте значения прямо в таблице. Сохранение — Enter или переход

            в другую ячейку. Пустое поле означает «не задано», 0 — отсутствие минимума.

          </Text>

          <ScrollView horizontal keyboardShouldPersistTaps="handled">

            <View>

              <View style={{ flexDirection: "row" }}>

                <Text style={[os.cell, os.nameCell]}>

                  {editKind === "supplier" ? "Поставщик" : "Товар"}

                </Text>

                <Text style={os.cell}>

                  {editKind === "supplier" ? "Минимум, ₽" : "Цена, ₽"}

                </Text>

                {editKind === "product" && <Text style={[os.cell, { width: 230 }]}>Поставщик</Text>}

              </View>

              {editKind === "supplier"

                ? catalog.suppliers

                    .filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase()))

                    .sort((a, b) => a.name.localeCompare(b.name, "ru"))

                    .map((s) => (

                      <View key={s.id} style={{ flexDirection: "row", alignItems: "center" }}>

                        <Text style={[os.cell, os.nameCell]}>{s.name}</Text>

                        <CatalogAmountCell

                          key={`minimum:${s.id}`}

                          label={`Минимальный заказ: ${s.name}`}

                          value={s.minimum_order_amount}

                          disabled={busy}

                          onSave={(value) => saveCatalogCell("supplier", s.id, value)}

                        />

                      </View>

                    ))

                : catalog.products

                    .filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))

                    .sort((a, b) => a.name.localeCompare(b.name, "ru"))

                    .map((p) => (

                      <View key={p.id} style={{ flexDirection: "row", alignItems: "center" }}>

                        <Text style={[os.cell, os.nameCell]}>{p.name}</Text>

                        <CatalogAmountCell

                          key={`price:${p.id}`}

                          label={`Цена: ${p.name}`}

                          value={p.unit_price}

                          disabled={busy}

                          onSave={(value) => saveCatalogCell("product", p.id, value, p.supplier_id)}

                        />

                        <SupplierDropdown

                          value={p.supplier_id}

                          suppliers={catalog.suppliers}

                          productName={p.name}

                          disabled={busy}

                          onChange={(id) => saveCatalogCell("product", p.id, p.unit_price, id)}

                        />

                      </View>

                    ))}

            </View>

          </ScrollView>

        </>

      )}

    </ScrollView>

  );

}
