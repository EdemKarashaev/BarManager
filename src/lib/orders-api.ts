import { supabase } from "./supabase";
export type Location = { id: string; name: string; address: string };
export type OrderContext = {
  isAdmin: boolean;
  locationId: string | null;
  locations: Location[];
};
export type CatalogProduct = {
  id: string;
  name: string;
  category: string | null;
  supplier_id: string | null;
  unit: string;
  unit_price: string | null;
  is_active: boolean;
};
export type CatalogSupplier = {
  id: string;
  name: string;
  minimum_order_amount: string | null;
  minimum_is_shared: boolean;
  is_active: boolean;
};
export type Catalog = {
  products: CatalogProduct[];
  suppliers: CatalogSupplier[];
};
export type OrderItem = {
  product_id: string;
  quantity: string;
  unit_price_snapshot: string | null;
  product_name_snapshot: string;
  supplier_id_snapshot: string | null;
  supplier_name_snapshot: string | null;
  category_snapshot: string | null;
  unit_snapshot: string | null;
  minimum_snapshot: string | number | null;
};
export type Order = {
  id: string;
  week_start: string;
  cycle_id?: string | null;
  location_id: string;
  revision: number;
  status: string;
  manager_comment: string | null;
  items?: OrderItem[];
  supplement_history?: {
    at: string;
    added: {
      name: string;
      quantity: string;
      price: string;
      supplier: string;
    }[];
  }[];
};
export async function ordersRpc<T>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}
export function monday(date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function shiftWeek(value: string, days: number): string {
  const [y, m, d] = value.split("-").map(Number);
  return monday(new Date(y, m - 1, d + days));
}
export function orderError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : "Не удалось выполнить действие.";
  if (/function .* does not exist|schema cache/i.test(message))
    return "Сначала выполните SQL обновления заказов в Supabase.";
  if (/network|fetch/i.test(message))
    return "Нет связи с сервером. Введённые количества остаются на экране. Повторите сохранение.";
  return message;
}
export const orderStatus: Record<string, string> = {
  draft: "Черновик",
  submitted: "Отправлен",
  revision_requested: "На доработке",
  approved: "Подтверждён",
  cancelled: "Отменён",
};


// Независимые периоды заказов — Bar Manager 1.1.0

export type OrderCycle = {
  id: string;
  name: string;
  week_start: string;
  cycle_type: "regular" | "additional";
  status: "planned" | "open" | "closed" | "cancelled";
  check_at: string;
  checked_at: string | null;
  auto_check_enabled: boolean;
  orders_count: number;
  submitted_count: number;
  approved_count: number;
  my_order: {
    id: string;
    status: string;
    revision: number;
    manager_comment: string | null;
  } | null;
};

export const cycleStatus: Record<OrderCycle["status"], string> = {
  planned: "Запланирован",
  open: "Открыт",
  closed: "Закрыт",
  cancelled: "Отменён",
};

export function fetchOrderCycles() {
  return ordersRpc<OrderCycle[]>("bm_orders_cycles_list");
}

export function fetchCycleDashboard(cycleId: string) {
  return ordersRpc<Order[]>("bm_orders_dashboard_cycle", {
    p_cycle_id: cycleId,
  });
}

export function fetchMyCycleOrder(cycleId: string) {
  return ordersRpc<{
    order: Order;
    items: OrderItem[];
  } | null>("bm_orders_get_cycle", {
    p_cycle_id: cycleId,
  });
}

export function createOrderCycle(
  name: string,
  date: string,
  time: string,
) {
  return ordersRpc<string>("bm_orders_cycle_create", {
    p_name: name,
    p_date: date,
    p_time: time,
  });
}

export function rescheduleOrderCycle(
  cycleId: string,
  date: string,
  time: string,
) {
  return ordersRpc("bm_orders_cycle_reschedule", {
    p_cycle_id: cycleId,
    p_date: date,
    p_time: time,
  });
}

export function formatCycleDate(value: string): string {
  return new Date(value).toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }) + " МСК";
}
