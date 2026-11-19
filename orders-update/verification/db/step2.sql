-- BAR MANAGER / STEP 2: 7 locations, one assigned bartender each, admin-only consolidated view.
-- Run AFTER bar_manager_orders_step1.sql. No existing order rows are deleted.
-- IMPORTANT: submission/approval RPCs and minimum-supplier validation are NOT implemented here.
BEGIN;

CREATE TABLE IF NOT EXISTS public.order_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL UNIQUE,
  address text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.order_locations (code,name,address) VALUES
 ('future','Фьюче','ул. Льва Толстого, 1'),
 ('voskhod','Восход','Литейный пр., 59'),
 ('ploshchad','Площадь','Комендантская пл., 8'),
 ('ostrov','Остров','6-я линия В.О., 29'),
 ('sever','Север','пр. Энгельса, 124'),
 ('yuz','ЮЗ','Героев, 33к1'),
 ('pobeda','Победа','Московский')
ON CONFLICT (code) DO NOTHING;

-- A location may have only one assigned bartender; a bartender only one location.
CREATE TABLE IF NOT EXISTS public.order_user_access (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id uuid NOT NULL UNIQUE REFERENCES public.order_locations(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Explicit admin registry, independent of any unknown existing profiles/roles schema.
-- Populate only from SQL Editor with verified auth.users IDs (never from the client).
CREATE TABLE IF NOT EXISTS public.order_admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_orders ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.order_locations(id);
CREATE INDEX IF NOT EXISTS weekly_orders_location_week_idx ON public.weekly_orders(location_id,week_start);
-- Existing orders may have NULL location_id. Assign them manually before making it NOT NULL.

CREATE OR REPLACE FUNCTION public.order_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.order_admin_users WHERE user_id = (SELECT auth.uid()));
$$;
REVOKE ALL ON FUNCTION public.order_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.order_is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.order_my_location()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT location_id FROM public.order_user_access WHERE user_id = (SELECT auth.uid());
$$;
REVOKE ALL ON FUNCTION public.order_my_location() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.order_my_location() TO authenticated;

-- Prevent impersonation and editing review fields through direct table updates.
CREATE OR REPLACE FUNCTION public.order_guard_order_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE admin_mode boolean;
BEGIN
  admin_mode := public.order_is_admin();
  IF TG_OP = 'INSERT' THEN
    IF NOT admin_mode THEN
      IF NEW.created_by IS DISTINCT FROM auth.uid() OR NEW.location_id IS DISTINCT FROM public.order_my_location()
         OR NEW.status <> 'draft' OR NEW.manager_id IS NOT NULL OR NEW.manager_comment IS NOT NULL
         OR NEW.submitted_at IS NOT NULL OR NEW.reviewed_at IS NOT NULL THEN
        RAISE EXCEPTION 'Invalid bartender order creation';
      END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NOT admin_mode THEN
      IF OLD.status NOT IN ('draft','revision_requested') OR NEW.status IS DISTINCT FROM OLD.status
        OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.location_id IS DISTINCT FROM OLD.location_id
        OR NEW.week_start IS DISTINCT FROM OLD.week_start OR NEW.manager_id IS DISTINCT FROM OLD.manager_id
        OR NEW.manager_comment IS DISTINCT FROM OLD.manager_comment
        OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at THEN
        RAISE EXCEPTION 'Only administrator can change review fields or status';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS order_guard_order_changes_trg ON public.weekly_orders;
CREATE TRIGGER order_guard_order_changes_trg BEFORE INSERT OR UPDATE ON public.weekly_orders
FOR EACH ROW EXECUTE FUNCTION public.order_guard_order_changes();

-- Item snapshots must come from product catalog; no client-side price spoofing.
CREATE OR REPLACE FUNCTION public.order_guard_item_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE order_status text; p record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT status INTO order_status FROM public.weekly_orders WHERE id=OLD.order_id;
    IF NOT public.order_is_admin() AND order_status NOT IN ('draft','revision_requested') THEN
      RAISE EXCEPTION 'Cannot edit submitted order';
    END IF;
    RETURN OLD;
  END IF;
  SELECT status INTO order_status FROM public.weekly_orders WHERE id=NEW.order_id;
  IF NOT public.order_is_admin() AND order_status NOT IN ('draft','revision_requested') THEN
    RAISE EXCEPTION 'Cannot edit submitted order';
  END IF;
  IF TG_OP='UPDATE' AND NEW.order_id IS DISTINCT FROM OLD.order_id THEN
    RAISE EXCEPTION 'Cannot move an item between orders';
  END IF;
  SELECT p.name,p.unit_price,p.supplier_id,s.name AS supplier_name
    INTO p FROM public.order_products p JOIN public.order_suppliers s ON s.id=p.supplier_id
    WHERE p.id=NEW.product_id AND p.is_active AND s.is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not available'; END IF;
  NEW.unit_price_snapshot := p.unit_price;
  NEW.product_name_snapshot := p.name;
  NEW.supplier_id_snapshot := p.supplier_id;
  NEW.supplier_name_snapshot := p.supplier_name;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS order_guard_item_changes_trg ON public.weekly_order_items;
CREATE TRIGGER order_guard_item_changes_trg BEFORE INSERT OR UPDATE OR DELETE ON public.weekly_order_items
FOR EACH ROW EXECUTE FUNCTION public.order_guard_item_changes();

ALTER TABLE public.order_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_user_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_order_items ENABLE ROW LEVEL SECURITY;

-- No direct client policies for assignment/admin tables: SQL Editor / service role only.
DROP POLICY IF EXISTS order_locations_read ON public.order_locations;
CREATE POLICY order_locations_read ON public.order_locations FOR SELECT TO authenticated
 USING (public.order_is_admin() OR id=public.order_my_location());
DROP POLICY IF EXISTS order_suppliers_read ON public.order_suppliers;
CREATE POLICY order_suppliers_read ON public.order_suppliers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS order_suppliers_admin_write ON public.order_suppliers;
CREATE POLICY order_suppliers_admin_write ON public.order_suppliers FOR ALL TO authenticated
 USING (public.order_is_admin()) WITH CHECK (public.order_is_admin());
DROP POLICY IF EXISTS order_products_read ON public.order_products;
CREATE POLICY order_products_read ON public.order_products FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS order_products_admin_write ON public.order_products;
CREATE POLICY order_products_admin_write ON public.order_products FOR ALL TO authenticated
 USING (public.order_is_admin()) WITH CHECK (public.order_is_admin());
DROP POLICY IF EXISTS weekly_orders_read ON public.weekly_orders;
CREATE POLICY weekly_orders_read ON public.weekly_orders FOR SELECT TO authenticated
 USING (public.order_is_admin() OR (location_id=public.order_my_location() AND created_by=auth.uid()));
DROP POLICY IF EXISTS weekly_orders_insert ON public.weekly_orders;
CREATE POLICY weekly_orders_insert ON public.weekly_orders FOR INSERT TO authenticated
 WITH CHECK (public.order_is_admin() OR (location_id=public.order_my_location() AND created_by=auth.uid() AND status='draft'));
DROP POLICY IF EXISTS weekly_orders_update ON public.weekly_orders;
CREATE POLICY weekly_orders_update ON public.weekly_orders FOR UPDATE TO authenticated
 USING (public.order_is_admin() OR (location_id=public.order_my_location() AND created_by=auth.uid() AND status IN ('draft','revision_requested')))
 WITH CHECK (public.order_is_admin() OR (location_id=public.order_my_location() AND created_by=auth.uid() AND status IN ('draft','revision_requested')));
DROP POLICY IF EXISTS weekly_order_items_read ON public.weekly_order_items;
CREATE POLICY weekly_order_items_read ON public.weekly_order_items FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.weekly_orders o WHERE o.id=order_id));
DROP POLICY IF EXISTS weekly_order_items_insert ON public.weekly_order_items;
CREATE POLICY weekly_order_items_insert ON public.weekly_order_items FOR INSERT TO authenticated
 WITH CHECK (EXISTS (SELECT 1 FROM public.weekly_orders o WHERE o.id=order_id AND (public.order_is_admin() OR (o.created_by=auth.uid() AND o.location_id=public.order_my_location() AND o.status IN ('draft','revision_requested')))));
DROP POLICY IF EXISTS weekly_order_items_update ON public.weekly_order_items;
CREATE POLICY weekly_order_items_update ON public.weekly_order_items FOR UPDATE TO authenticated
 USING (EXISTS (SELECT 1 FROM public.weekly_orders o WHERE o.id=order_id AND (public.order_is_admin() OR (o.created_by=auth.uid() AND o.location_id=public.order_my_location() AND o.status IN ('draft','revision_requested')))))
 WITH CHECK (EXISTS (SELECT 1 FROM public.weekly_orders o WHERE o.id=order_id AND (public.order_is_admin() OR (o.created_by=auth.uid() AND o.location_id=public.order_my_location() AND o.status IN ('draft','revision_requested')))));
DROP POLICY IF EXISTS weekly_order_items_delete ON public.weekly_order_items;
CREATE POLICY weekly_order_items_delete ON public.weekly_order_items FOR DELETE TO authenticated
 USING (EXISTS (SELECT 1 FROM public.weekly_orders o WHERE o.id=order_id AND (public.order_is_admin() OR (o.created_by=auth.uid() AND o.location_id=public.order_my_location() AND o.status IN ('draft','revision_requested')))));

-- Restrict table privileges as an additional guard.
REVOKE ALL ON public.order_user_access, public.order_admin_users FROM anon, authenticated;
GRANT SELECT ON public.order_locations, public.order_suppliers, public.order_products, public.weekly_orders, public.weekly_order_items TO authenticated;
GRANT INSERT, UPDATE ON public.weekly_orders TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.weekly_order_items TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.order_suppliers, public.order_products TO authenticated;
COMMIT;

-- NEXT: manually register 7 user UUIDs and 1 admin UUID using SQL Editor.
-- NEXT: add secure RPC for submit/review with per-supplier minimum checks and snapshots.
