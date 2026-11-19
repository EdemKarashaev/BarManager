import { OrderSupplement } from "@/components/order-supplement";
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
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
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
  const sortedShown = [...shown].sort((a, b) => {
    const catA = sourceCategoryIndex.get(normalizeOrderName(a.category)) ?? 9999;
    const catB = sourceCategoryIndex.get(normalizeOrderName(b.category)) ?? 9999;
    if (catA !== catB) return catA - catB;
    if (a.category !== b.category && catA === 9999) return a.category.localeCompare(b.category, 'ru');
    const posA = sourceProductIndex.get(normalizeOrderName(a.name)) ?? 9999;
    const posB = sourceProductIndex.get(normalizeOrderName(b.name)) ?? 9999;
    return posA !== posB ? posA - posB : a.name.localeCompare(b.name, 'ru');
  });
  const listEntries: Array<
    | { kind: 'section'; id: string; title: string; count: number }
    | { kind: 'product'; id: string; product: (typeof sortedShown)[number] }
  > = [];
  let lastSection = '';
  for (const product of sortedShown) {
    if (product.category !== lastSection) {
      lastSection = product.category;
      listEntries.push({
        kind: 'section', id: `section:${lastSection}`, title: lastSection,
        count: sortedShown.filter(p => p.category === lastSection).length,
      });
    }
    listEntries.push({ kind: 'product', id: `product:${product.id}`, product });
  }

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
  async function clearWholeOrder() {
    if (!order || !editable || working.current || dirty) return;
    working.current = true;
    setBusy(true);
    setError('');
    const generation = live.current;
    try {
      await ordersRpc('bm_orders_clear', {
        p_order: order.id,
        p_revision: order.revision,
      });
      await localWrites.current;
      await AsyncStorage.removeItem(draftKey);
      if (generation === live.current) {
        setQuantities({});
        setDirty(false);
        setReload(n => n + 1);
      }
    } catch (e) {
      if (generation === live.current) setError(orderError(e));
    } finally {
      working.current = false;
      if (generation === live.current) setBusy(false);
    }
  }

  function confirmClearOrder() {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Удалить все позиции заказа за выбранную неделю? Это действие нельзя отменить.')) {
        void clearWholeOrder();
      }
      return;
    }
    Alert.alert('Удалить весь заказ?', 'Все позиции заказа за выбранную неделю будут удалены. Отменить действие нельзя.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => void clearWholeOrder() },
    ]);
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
            data={listEntries}
            keyExtractor={(entry) => entry.id}
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
                  categories={[...new Set(products.map((p) => p.category))].sort((a, b) =>
                    (sourceCategoryIndex.get(normalizeOrderName(a)) ?? 9999) -
                    (sourceCategoryIndex.get(normalizeOrderName(b)) ?? 9999)
                  )}
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
               return (
                 <View style={[os.card, { padding: 9, marginBottom: 5, gap: 3 }]}>
                   <Text style={[os.heading, { fontSize: 14 }]}>{p.name}</Text>
                   <Text style={[os.muted, { fontSize: 11 }]}>
                     {vendors.find((s) => s.id === p.supplierId)?.name || 'Поставщик не указан'}
                   </Text>
                   <View style={[os.row, { gap: 8 }]}>
                     <Text style={[os.text, { flex: 1, fontSize: 13 }]}>
                       {p.price === null ? 'Цена не задана' : `${p.price} ₽`}
                     </Text>
                     <Text style={[os.muted, { fontSize: 12 }]}>
                       {lineAmount(p.price, quantities[p.id] || '0') ?? '—'} ₽
                     </Text>
                     <TextInput
                       accessibilityLabel={`Количество: ${p.name}`}
                       editable={editable && !busy}
                       keyboardType="decimal-pad"
                       maxLength={12}
                       placeholder="0"
                       placeholderTextColor="#aaa"
                       value={quantities[p.id] || ''}
                       onChangeText={(q) => change(p.id, q)}
                       style={[os.input, os.qty, { height: 34, minHeight: 34,
                         paddingVertical: 3, paddingHorizontal: 6, fontSize: 14 }]}
                     />
                   </View>
                 </View>
               );
             }}
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
              <View style={{ gap: 8 }}>
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
                <OButton
                  title="Удалить весь заказ"
                  disabled={busy || dirty}
                  onPress={confirmClearOrder}
                />
                {dirty && <Text style={os.muted}>
                  Перед удалением сохраните черновик или загрузите серверную версию.
                </Text>}
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                <Text style={os.success}>Заказ доступен администратору.</Text>
                {order.status === "submitted" ? (
                  <OrderSupplement
                    order={order}
                    items={orderItems}
                    onDone={() => setReload((n) => n + 1)}
                  />
                ) : (
                  <Text style={os.muted}>Дополнение закрыто.</Text>
                )}
              </View>
            )}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
