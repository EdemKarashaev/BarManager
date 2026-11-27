import { supabase } from "./supabase";
import { ordersRpc } from "./orders-api";

export type OrderNotification = {
  id: string;
  user_id: string;
  cycle_id: string;
  supplier_id: string | null;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  response_status:
    | "pending"
    | "accepted"
    | "declined"
    | "auto_returned"
    | "resolved";
  responded_at: string | null;
  resolved_at: string | null;
};

export async function fetchOrderNotifications(
  userId: string,
  signal?: AbortSignal,
): Promise<OrderNotification[]> {
  let query = supabase
    .from("order_notifications")
    .select("*")
    .eq("user_id", userId)
    .is("resolved_at", null)
    .order("created_at", { ascending: false });

  if (signal) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  return (data ?? []) as OrderNotification[];
}

export async function respondOrderNotification(
  id: string,
  action: "accepted" | "declined",
): Promise<void> {
  await ordersRpc(
    "bm_orders_notification_respond",
    {
      p_id: id,
      p_action: action,
    },
  );
}

export async function readOrderNotification(
  id: string,
): Promise<void> {
  await ordersRpc(
    "bm_orders_notification_read",
    { p_id: id },
  );
}
