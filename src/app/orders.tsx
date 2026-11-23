/* eslint-disable react-hooks/set-state-in-effect -- Reset remote data immediately when account or reporting period changes; stale data must not remain editable. */
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
  ordersRpc,
  orderStatus,
  shiftWeek,
  type Catalog,
  type Order,
  type OrderContext,
  type OrderItem,
} from "@/lib/orders-api";
import { useAuth } from "@/providers/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
// Исходная последовательность из листа «ЗаказОбщий».
const SOURCE_CATEGORIES: string[] = ["Вино белое", "Вино Красное", "Вино Розовое", "Вино Игристое", "Биттеры и Ликеры", "Виски", "Текила", "Водка", "Джин", "Ром", "Коньяк", "Разливное пиво и сидр", "Бутылочное пиво", "Кофе", "Чай", "Вода,Соки", "СИРОП", "Пюре АгороБар", "Б/А продукция"];
const SOURCE_PRODUCTS: string[] = ["Вино б/а Пино гриджио", "Адагум Шардоне", "Пино гриджио \"Тре Фили\"", "Рислинг \"Петер Мертес\"", "Эль Крусеро сух.бел. 2л (хаус)", "Вино Фиорентино хаус белое 3л", "Arco Bay, New Zeland", "Совиньон блан \"Тарапака\"(только большие рестораны)", "Виньо Верде (продаем остатки Север и Фьюче))", "Адагум Мерло", "Эль Крусеро сух.кр. 2л (хаус)", "Вино красное хаус Фиорентино 3л", "Киндзмараули Асканели", "Пинотаж \"КВВ\"", "Санта Моника, каберне совиньон", "Адагум розе (Коменда, Остров, Литейный) - распродадим", "Розе д\"Анжу - распродаем", "Мартини Асти", "Мартини Брют", "Просекко \"Патинни\"", "Cava Nuviana Rose", "игристое хаус", "игристое хаус Буржуа", "Вермут", "Вермут Сарти", "MARTINI Fiero 1,0", "Мартини Bianco 1,0", "Мартини Rosso 1,0", "Мартини Dry 1,0", "Ликер Чинар", "Амаретто 0,7", "Ликер адвокат 0,5", "APEROL 1,0", "CAMPARI 1,0", "Ягерь 0,7", "Бейлис ликер 0,7", "Ликер Нива Дистиллери Трипл Сек 0,75", "Лимончелло \"Джароолла\"", "Лимончелло Хаус 0,5", "Ликер Мелонад Дыня 0.7", "Ликер Мараскино", "Ликер Йогурт", "Ликер смородина(Восход)", "ПОРТВЕЙН руби 0,7 - сезонка", "Виски Тилинг 0,7", "Синглтон 12 лет 0,7", "Баллантайнс 0,7", "JACK DANIEL'S  TENNESSEE №7 1l", "JOHNNIE WALKER RED LABEL 0.7", "Bushmills 1л", "Darrow 1л (хаус)", "Jim Beam 0,7", "Dewar's white label 1,0", "Dewar's 8y japanis smooth 0,7", "Jameson 0,7", "Текила хаус(Ла повеса) 0.7л", "Ольмека Сильвер 1,0", "Ольмека Голд 1,0", "Текила Эсполон 0,7", "Лаб 50 0,7", "Лаб Ваниль 0,7", "Лаб 40 0,7", "Лаб Груша-айва 0,7", "Russian Standard ORIGINAL  1,0", "Russian Standard PLATINUM 1,0", "Grey Goose 0,7", "Бикенс джин", "Джин босфорт", "Bombay Sapphire 0,7", "Barister 47 1,0", "Flor de Cana  Anejo Clasico 0,75 ( рапродаем остатки)", "Bacardi Oakheart 1,0", "Пунтакана Сильвер клаб", "Пунтакана муй вьехо 7 лет", "Ром хаус, Caribien Sunset 0,5", "Арарат 5* 0,7", "Арарат Ани 7лет 0,7", "Арарат медовый 0,5", "Roullet VS (Фьюче, Север) 0,5", "Roullet VSOP (Фьюче, Север,  Победа) 0,5", "Stiegl Weissbier (кроме Севера)", "Rouge de Bruxelles (Север, Фьюче)", "Pubst blue ribbon 20л (кроме Севера)", "Schlitz Dunkel 20l ( Север, Фьюче, ЮЗ, Победа)", "Blanche de Bruxelles (Север) 30l", "Stiegl Goldbrau (Север) 25l", "ВП IPA 20л кега  20l", "ВП Вит 20л кега (Фьюче) 20л", "Хамовники Нитро лагер 20л кега", "Бокалы 0.4 Волковская", "Бокалы 0.25", "Газ+костеры", "Углекислота 10-15л", "АЗОТ 10л", "Газ баллон 20л", "Костеры (хамовники)", "Костеры", "Лагер КетчАП", "Nimpha, сидр безалко 0,33", "Silk Road, стаут безалко 0,5", "Moto Druf, пилснер безалко 0,5", "Electrobus 22, пилснер безалко 0,33", "Gletcher Brainstorm, безалко 0,5", "Gletcher Ausweis", "Ригель herren Pills 0,5", "Ригель urHell 0,5", "Кармелитер хель", "Ригель Dunkel 0,5", "Ригель hefe weissbeir 0,5", "Берлинер вайсбир", "Ригель hefe AlcoFree", "Gletcher Milk of Amnesia Tropic 0,5", "Jaws Oatmeal Stout 0,5", "Кикимора 0,5", "Крылья доблести 0,5", "Solanum Salt, gose 0,5", "Рисовый лагер Rise and shine", "Kriek Boone 0,25", "Rodenbach frutage 0,25", "Атомная прачечная 0,5", "Мичелада", "Грейпфрут Ипа Bitter joy", "Шато Руж", "Брюдаз бланш", "Nutty nut 0,5", "Мозаик Ипа 0,5", "Руби Нуби 0,33", "Vasilisa 0,5", "Сидр Бюльви 0,5", "DADA #2 0,5", "Double Tree (Пуаре) Полусладкий 0,45", "Абанамат 0,5", "Banamed 0,5( банановый)", "Валь де Ранс 0,75 ( п/сл) Brut 0,75", "Фейхоа Сауэр", "Какао ( горячий шоколад) упак по 0,5 кг", "КОФЕ  Голд 1,0", "КОФЕ без кофеина", "КОФЕ дрип набор 6 штук Африка", "Средство для чистки кофемашин (от кофейных масел)", "Ассам 0,5кг", "Эрл грей 0,5кг", "Сенча 0,5кг", "Жасмин 0,5кг", "Молочный улун 0,5кг", "Ромашковый 0,5кг", "Наглый Фрукт 0,5кг", "Пуэр (сезон) 0,5кг", "Матча 0,5кг", "Розовая Матча", "МИНЕРАЛЬНАЯ ВОДА Tassay 0,25 б\\г", "МИНЕРАЛЬНАЯ ВОДА Tassay  0,25 газ", "МИНЕРАЛЬНАЯ ВОДА Tassay  0,5 б\\г", "МИНЕРАЛЬНАЯ ВОДА Tassay  0,5 газ", "Rich 0,2 Апельсин стекло", "Rich 0,2 Яблоко стекло", "Rich 0,2 Вишня стекло", "Rich 0,2 Томат стекло", "Добрый кола 0,25 стекло 12шт.", "Добрый кола без сахара 0,25 12шт.", "Добрый Лимон-Лайм 0,25  12шт.", "Добрый Апельсин 0,25 12шт.", "Тоник Рич 0,33 стекло", "Биб Добрый кола 10 л", "Добрый Кола 0,5л ПЭТ 24шт.", "Тоник Рич 1л ПЭТ по 12 шт/уп", "БонАква 1,0 газированная пластик", "Забрать баллон", "Углекислота 20л", "Яблоко сок пак 1л", "Грейпфрут сок пак 1л", "Вишневый сок пак1л", "Томатный сок 0.3 л", "Ананасовый сок пак 1л", "Апельсиновый сок пак 1л", "Энергетик Burn 0.25", "Др. Пеппер 0,33 (фас. 24уп.) - ЗАКАЗ через КУХНЮ(метро)", "Имбирный Эль", "Сироп дыня", "Сироп фалернум 1,0", "сироп лимонный тарт 1,0", "Сироп маракуя 1,0", "Сироп маракуйа Эско 1,0", "Сироп ваниль 1,0", "Сироп ваниль 1,0 Pinch", "Сироп клубника 1,0", "Сироп черника", "Сироп арбуз", "Сироп  малина 1,0", "Сироп   красный апельсин 1,0", "Сироп манго 1,0", "Сироп  кокос 1,0", "Сироп  кокос 1,0 Pinch", "Сироп лесной орех 1,0", "Сироп  карамель 1,0", "Сироп  соленая карамель 1,0", "Сироп  соленая карамель 1,0", "Сироп Бабл Гам 0,7", "Сироп имбирь 0,7", "Сироп земляника 1,0 Pinch", "Сироп белый шоколад 1,0", "Кордиал клубник 0,75", "Кордиал персик 0,75", "Кордиал земляника-шисо(Север)", "Кордиал Яблоко-Матча", "Сироп бузина 1,0", "Сироп бузина 1,0 Pinch", "Сироп энергетик(Остров)", "Сироп черная смородина(Восход)", "Сироп клубничный пломбир", "Сироп Фейхоа", "Сироп крем-брюле", "Сироп пряная тыква", "Пюре Брусника", "Пюре лимон 1,0", "Пюре маракуйя 1,0", "Пюре манго 1,0", "Пюре личи 1,0", "Пюре лайм(кухня) 1,0", "Пюре щавель(Фьюче)", "Пюре Фейхоа", "Пюре тыква", "Бабл дропс 0,05 ( банка)", "Бумага вафельная шт. - Палп фикшн", "Бумага вафельная шт. - сочная дорога", "Бумага вафельная шт. - виски маракуйа", "Глиттер, он же шиммер розовый", "Клубника сублимированная 50 гр", "Вафли ( через кухню)", "Карамель барбарис (через кухню)", "Сахарная вата(площадь)"];
const normalizeOrderName = (value: string) => value.trim().toLocaleLowerCase('ru').replace(/\s+/g, ' ');
const sourceCategoryIndex = new Map(SOURCE_CATEGORIES.map((name, index) => [normalizeOrderName(name), index]));
const sourceProductIndex = new Map(SOURCE_PRODUCTS.map((name, index) => [normalizeOrderName(name), index]));

type ProductRowProps = {
  product: { id: string; name: string; price: string | null; supplierId: string | null };
  supplierName: string;
  quantity: string;
  editable: boolean;
  busy: boolean;
  onChange: (id: string, value: string) => void;
  onStep: (id: string, direction: -1 | 1) => void;
};

const ProductRow = memo(function ProductRow({ product: p, supplierName, quantity, editable, busy, onChange, onStep }: ProductRowProps) {
  return (
    <View style={[os.card, { padding: 9, marginBottom: 5, gap: 3 }]}>
      <Text style={[os.heading, { fontSize: 14 }]}>{p.name}</Text>
      <Text style={[os.muted, { fontSize: 11 }]}>{supplierName}</Text>
      <View style={[os.row, { gap: 8 }]}>
        <Text style={[os.text, { flex: 1, fontSize: 13 }]}>{p.price === null ? 'Цена не задана' : `${p.price} ₽`}</Text>
        <Text style={[os.muted, { fontSize: 12 }]}>{lineAmount(p.price, quantity || '0') ?? '—'} ₽</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#5d5358', borderRadius: 7, overflow: 'hidden' }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Уменьшить количество: ${p.name}`}
            disabled={!editable || busy} onPress={() => onStep(p.id, -1)}
            style={{ width: 32, height: 34, justifyContent: 'center', alignItems: 'center', backgroundColor: '#303035' }}>
            <Text style={{ color: '#fff', fontSize: 21 }}>−</Text>
          </Pressable>
          <TextInput accessibilityLabel={`Количество: ${p.name}`} editable={editable && !busy}
            keyboardType="decimal-pad" maxLength={12} selectTextOnFocus placeholder="0"
            placeholderTextColor="#aaa" value={quantity} onChangeText={(q) => onChange(p.id, q)}
            style={{ width: 43, height: 34, padding: 0, color: '#fff', textAlign: 'center', fontSize: 14 }} />
          <Pressable accessibilityRole="button" accessibilityLabel={`Увеличить количество: ${p.name}`}
            disabled={!editable || busy} onPress={() => onStep(p.id, 1)}
            style={{ width: 32, height: 34, justifyContent: 'center', alignItems: 'center', backgroundColor: '#75444f' }}>
            <Text style={{ color: '#fff', fontSize: 21 }}>+</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
});

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
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [reload, setReload] = useState(0);
  const live = useRef(0);
  const working = useRef(false);
  const localWrites = useRef(Promise.resolve());
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quantitiesRef = useRef<Record<string, string>>({});
  const draftKey = `bm:order-draft:${session?.user.id}:${week}`;
  // Clear the previous account/week before fetching so stale orders cannot be edited.
  useEffect(() => {
    let active = true;
    const generation = ++live.current;
    setLoading(true);
    setBusy(false);
    setContext(null);
    setOrder(null);
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = null;
    quantitiesRef.current = {};
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
        quantitiesRef.current = q;
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
              quantitiesRef.current = local.quantities;
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
      if (draftTimer.current) clearTimeout(draftTimer.current);
      draftTimer.current = null;
      live.current = generation + 1;
    };
  }, [week, session?.user.id, reload, draftKey]);
  const editable =
    !!order && ["draft", "revision_requested"].includes(order.status);
  const currentProducts = useMemo(() => catalog.products
    .filter((p) => p.is_active)
    .map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category || "Без раздела",
      supplierId: p.supplier_id,
      price: p.unit_price,
    })), [catalog.products]);
  const currentVendors = useMemo(() => catalog.suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    minimum: s.minimum_order_amount,
  })), [catalog.suppliers]);
  const products = useMemo(() => editable
    ? currentProducts
    : orderItems.map((i) => ({
        id: i.product_id,
        name: i.product_name_snapshot,
        category: i.category_snapshot || "Без раздела",
        supplierId: i.supplier_id_snapshot,
        price: i.unit_price_snapshot,
      })), [editable, currentProducts, orderItems]);
  const vendors = useMemo(() => editable
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
      ], [editable, currentVendors, orderItems]);
  const supplierNames = useMemo(() => new Map(vendors.map(v => [v.id, v.name])), [vendors]);
  const categories = useMemo(() => [...new Set(products.map(p => p.category))].sort((a, b) =>
    (sourceCategoryIndex.get(normalizeOrderName(a)) ?? 9999) - (sourceCategoryIndex.get(normalizeOrderName(b)) ?? 9999)
  ), [products]);
  const check = useMemo(() => evaluateOrder(products, vendors, quantities), [products, vendors, quantities]);
  const unavailable = Object.entries(quantities).some(
    ([id, q]) =>
      Number(q.replace(",", ".")) > 0 &&
      (!catalog.products.find((p) => p.id === id)?.is_active ||
        !catalog.suppliers.find(
          (s) =>
            s.id === catalog.products.find((p) => p.id === id)?.supplier_id,
        )?.is_active),
  );
  // Keep the catalog list stable when quantities change and neither dynamic filter is enabled.
  const dynamicSupplierTotals = filters.insufficientOnly ? check.supplierTotals : null;
  const selectedQuantities = selectedOnly ? quantities : null;
  const shown = useMemo(() => filterProducts(products, dynamicSupplierTotals ?? [], filters).filter(
    (p) =>
      p.name.toLocaleLowerCase("ru").includes(filters.query.toLocaleLowerCase("ru")) &&
      (!selectedOnly || Number((selectedQuantities?.[p.id] || "0").replace(",", ".")) > 0),
  ), [products, filters, dynamicSupplierTotals, selectedOnly, selectedQuantities]);
  const sortedShown = useMemo(() => [...shown].sort((a, b) => {
    const catA = sourceCategoryIndex.get(normalizeOrderName(a.category)) ?? 9999;
    const catB = sourceCategoryIndex.get(normalizeOrderName(b.category)) ?? 9999;
    if (catA !== catB) return catA - catB;
    if (a.category !== b.category && catA === 9999) return a.category.localeCompare(b.category, 'ru');
    const posA = sourceProductIndex.get(normalizeOrderName(a.name)) ?? 9999;
    const posB = sourceProductIndex.get(normalizeOrderName(b.name)) ?? 9999;
    return posA !== posB ? posA - posB : a.name.localeCompare(b.name, 'ru');
  }), [shown]);
  const listEntries = useMemo((): Array<
    | { kind: 'section'; id: string; title: string; count: number }
    | { kind: 'product'; id: string; product: (typeof sortedShown)[number] }
  > => { const entries: Array<
    | { kind: 'section'; id: string; title: string; count: number }
    | { kind: 'product'; id: string; product: (typeof sortedShown)[number] }
  > = [];
  let lastSection = '';
  for (const product of sortedShown) {
    if (product.category !== lastSection) {
      lastSection = product.category;
      entries.push({
        kind: 'section', id: `section:${lastSection}`, title: lastSection,
        count: sortedShown.filter(p => p.category === lastSection).length,
      });
    }
    entries.push({ kind: 'product', id: `product:${product.id}`, product });
  }
  return entries;
  }, [sortedShown]);

  const missing = Object.keys(quantities).filter(
    (id) =>
      !products.some((p) => p.id === id) &&
      Number(quantities[id].replace(",", ".")) > 0,
  );
  const change = useCallback((id: string, q: string) => {
    const next = { ...quantitiesRef.current, [id]: q };
    quantitiesRef.current = next;
    setQuantities(next);
    setDirty(true);
    setNotice('Есть изменения, не сохранённые на сервере.');
    if (draftTimer.current) clearTimeout(draftTimer.current);
    // Данные записываются после короткой паузы, а кнопки реагируют сразу.
    draftTimer.current = setTimeout(() => {
      draftTimer.current = null;
      const data = JSON.stringify({ orderId: order?.id, revision: order?.revision, quantities: quantitiesRef.current });
      localWrites.current = localWrites.current
        .then(() => AsyncStorage.setItem(draftKey, data))
        .catch(() => setNotice('Не удалось сохранить локальную копию. Сохраните черновик на сервер.'));
    }, 450);
  }, [order?.id, order?.revision, draftKey]);

  const stepQuantity = useCallback((id: string, direction: -1 | 1) => {
    if (!editable || busy) return;
    const raw = (quantitiesRef.current[id] || '0').replace(',', '.');
    const current = Number(raw);
    const safe = Number.isFinite(current) && current >= 0 ? current : 0;
    change(id, String(Math.max(0, Math.round((safe + direction) * 1000) / 1000)));
  }, [editable, busy, change]);

  async function flushDraft() {
    if (draftTimer.current) {
      clearTimeout(draftTimer.current);
      draftTimer.current = null;
      const data = JSON.stringify({ orderId: order?.id, revision: order?.revision, quantities: quantitiesRef.current });
      localWrites.current = localWrites.current.then(() => AsyncStorage.setItem(draftKey, data));
    }
    await localWrites.current;
  }

  async function save(submit = false, replacement?: Record<string, string>) {
    if (!order || working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    const generation = live.current;
    try {
      await flushDraft();
      const items = [];
      for (const [id, input] of Object.entries(replacement ?? quantitiesRef.current)) {
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
      if (replacement) {
        quantitiesRef.current = replacement;
        setQuantities(replacement);
      }
      await flushDraft();
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
        setNotice(replacement ? "Заказ очищен и сохранён на сервере." : "Черновик сохранён на сервере.");
      }
    } catch (e) {
      if (generation === live.current) setError(orderError(e));
    } finally {
      working.current = false;
      if (generation === live.current) setBusy(false);
    }
  }
  async function reopenForEditing() {
    if (!order || !["submitted", "approved"].includes(order.status) || working.current || dirty) return;
    working.current = true;
    setBusy(true);
    setError("");
    const generation = live.current;
    try {
      await ordersRpc<number>("bm_orders_reopen", {
        p_order: order.id,
        p_revision: order.revision,
      });
      await flushDraft();
      await AsyncStorage.removeItem(draftKey);
      if (generation === live.current) setReload((n) => n + 1);
    } catch (e) {
      if (generation === live.current) setError(orderError(e));
    } finally {
      working.current = false;
      if (generation === live.current) setBusy(false);
    }
  }

  async function clearOrder() {
    setConfirmClear(false);
    if (!editable || busy || !order) return;
    // Save an empty item set atomically; do not erase the UI before the server confirms.
    await save(false, {});
  }

  return (
    <SafeAreaView style={os.screen}>
       <View style={{ paddingHorizontal: 10, paddingTop: 4, paddingBottom: 5, gap: 5 }}>
         <View style={[os.row, { justifyContent: "space-between" }]}>
           <Pressable onPress={() => router.back()} disabled={busy} style={{ paddingVertical: 5, paddingHorizontal: 8, borderRadius: 7, backgroundColor: "#75444f" }}>
             <Text style={{ color: "#fff", fontSize: 13 }}>‹ Главная</Text>
           </Pressable>
           <Text style={[os.title, { fontSize: 20 }]}>Заказы</Text>
           <View style={{ width: 65 }} />
         </View>
         <View style={[os.row, { justifyContent: "space-between" }]}>
           <Pressable disabled={loading || busy || dirty} onPress={() => setWeek(shiftWeek(week, -7))} style={{ padding: 5 }}>
             <Text style={[os.text, { fontSize: 13 }]}>‹ Неделя</Text>
           </Pressable>
           <Text style={[os.text, { fontSize: 13 }]}>{week}</Text>
           <Pressable disabled={loading || busy || dirty} onPress={() => setWeek(shiftWeek(week, 7))} style={{ padding: 5 }}>
             <Text style={[os.text, { fontSize: 13 }]}>Неделя ›</Text>
           </Pressable>
         </View>
         {!!error && (
           <View>
             <Text accessibilityRole="alert" style={os.error}>{error}</Text>
             <OButton title="Загрузить серверную версию вместо текущих изменений" disabled={busy}
               onPress={() => {
                 void localWrites.current.then(() => AsyncStorage.removeItem(draftKey))
                   .then(() => setReload((n) => n + 1))
                   .catch((e) => setError(orderError(e)));
               }} />
           </View>
         )}
         {!!notice && <Text style={[os.muted, { fontSize: 11 }]}>{notice}</Text>}
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
            data={listEntries}
            keyExtractor={(entry) => entry.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 9, paddingBottom: 8 }}
            ListHeaderComponent={
               <View style={{ gap: 5, paddingBottom: 5 }}>
                 <View style={[os.row, { justifyContent: "space-between", alignItems: "center" }]}>
                   <Text style={[os.heading, { fontSize: 14, flexShrink: 1 }]} numberOfLines={1}>
                     {context.locations[0]?.name} · {orderStatus[order.status]}
                   </Text>
                   <Pressable disabled={!editable || busy} onPress={() => setConfirmClear(true)} style={{ padding: 5, opacity: editable && !busy ? 1 : 0.45 }}>
                     <Text style={{ color: "#EE9EA4", fontSize: 12 }}>Очистить заказ</Text>
                   </Pressable>
                 </View>
                 {confirmClear && editable && (
                   <View style={[os.card, { padding: 12, gap: 9, borderWidth: 1, borderColor: "#75444f" }]}>
                     <Text style={os.heading}>Очистить заказ?</Text>
                     <Text style={os.muted}>Все количества товаров в заказе этого ресторана за выбранную неделю будут удалены. Действие нельзя отменить автоматически.</Text>
                     <View style={{ flexDirection: "row", gap: 8 }}>
                       <Pressable onPress={() => setConfirmClear(false)} disabled={busy} style={{ flex: 1, padding: 10, backgroundColor: "#303035", borderRadius: 8, alignItems: "center" }}>
                         <Text style={os.text}>Отмена</Text>
                       </Pressable>
                       <Pressable onPress={() => void clearOrder()} disabled={busy} style={{ flex: 1, padding: 10, backgroundColor: "#75444f", borderRadius: 8, alignItems: "center" }}>
                         <Text style={os.text}>Да, очистить</Text>
                       </Pressable>
                     </View>
                   </View>
                 )}
                 {!!order.manager_comment && (
                   <Pressable onPress={() => setCommentOpen(!commentOpen)}>
                     <Text style={[os.error, { fontSize: 12 }]} numberOfLines={commentOpen ? undefined : 1}>
                       Комментарий: {order.manager_comment} {commentOpen ? "⌃" : "⌄"}
                     </Text>
                   </Pressable>
                 )}
                 <OrderFilters
                   filters={filters}
                   onChange={setFilters}
                   suppliers={vendors}
                   categories={categories}
                 />
                 {missing.map((id) => (
                   <View key={id} style={os.card}>
                     <Text style={os.error}>Недоступный товар в черновике: {id}</Text>
                     <OButton title="Убрать из заказа" disabled={!editable || busy} onPress={() => change(id, "0")} />
                   </View>
                 ))}
                 <Text style={[os.muted, { fontSize: 10 }]}>Товаров: {shown.length} · Цена за единицу</Text>
               </View>
             }
            ListEmptyComponent={
              <Text style={os.muted}>Товары не найдены. Измените фильтры.</Text>
            }
                         renderItem={({ item: entry }) => {
               if (entry.kind === 'section') {
                 return (
                   <View style={{ backgroundColor: '#292B2E', borderLeftWidth: 3,
                     borderLeftColor: '#C7A56B', paddingHorizontal: 12,
                     paddingVertical: 8, marginTop: 10, marginBottom: 4 }}>
                     <Text style={{ color: '#C7A56B', fontWeight: '700', fontSize: 13 }}>
                       {entry.title.toUpperCase()} · {entry.count} поз.
                     </Text>
                   </View>
                 );
               }
               const p = entry.product;
               return <ProductRow product={p} supplierName={supplierNames.get(p.supplierId || '') || 'Поставщик не указан'}
                 quantity={quantities[p.id] || ''} editable={editable} busy={busy} onChange={change} onStep={stepQuantity} />;
             }}
          />
                     <View style={[os.footer, { paddingHorizontal: 10, paddingVertical: 7, gap: 5 }]}>
             <Pressable onPress={() => setDetailsOpen(!detailsOpen)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
               <Text style={[os.heading, { fontSize: 16 }]}>
                 Итого: {sumMoney(check.supplierTotals.map((t) => t.amount))} ₽
                 {check.supplierTotals.some((t) => t.incomplete) ? " *" : ""}
               </Text>
               <Text style={[os.muted, { fontSize: 12 }]}>Поставщики {detailsOpen ? "⌃" : "⌄"}</Text>
             </Pressable>
             {detailsOpen && (
               <ScrollView style={{ maxHeight: 115 }} nestedScrollEnabled>
                 {check.supplierTotals.map((t) => (
                   <Text key={t.id} style={[t.shortfall && Number(t.shortfall) > 0 ? os.error : os.muted, { fontSize: 12 }]}>
                     {t.name}: {t.amount} / {t.minimum ?? "минимум не задан"} ₽
                     {t.shortfall && Number(t.shortfall) > 0 ? ` · не хватает ${t.shortfall} ₽` : ""}
                   </Text>
                 ))}
                 {editable && unavailable && <Text style={os.error}>В заказе есть недоступный товар или поставщик.</Text>}
               </ScrollView>
             )}
             {editable ? (
               <View style={{ flexDirection: "row", gap: 7 }}>
                 <Pressable disabled={busy} onPress={() => void save()}
                   style={{ flex: 1, backgroundColor: "#75444f", paddingVertical: 10, borderRadius: 8, alignItems: "center" }}>
                   <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>{busy ? "Сохраняем…" : "Сохранить"}</Text>
                 </Pressable>
                 <Pressable disabled={busy || !check.canSubmit || unavailable} onPress={() => void save(true)}
                   style={{ flex: 1.5, backgroundColor: busy || !check.canSubmit || unavailable ? "#51494d" : "#75444f", paddingVertical: 10, borderRadius: 8, alignItems: "center" }}>
                   <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>Отправить администратору</Text>
                 </Pressable>
               </View>
             ) : (
               <View style={{ gap: 5 }}>
                 <Text style={[os.success, { fontSize: 12 }]}>Заказ доступен администратору.</Text>
                 {["submitted", "approved"].includes(order.status) && (
                   <OButton title={order.status === "approved" ? "Вернуть на доработку" : "Редактировать заказ"} disabled={busy || dirty} onPress={() => void reopenForEditing()} />
                 )}
               </View>
             )}
           </View>
        </>
      )}
    </SafeAreaView>
  );
}
