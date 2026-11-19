-- Bar Manager: orders v1, after existing steps 1 and 2. Transactional, no orders deleted.
BEGIN;
DO $preflight$ BEGIN
 IF to_regclass('public.order_user_access') IS NULL OR to_regclass('public.weekly_order_items') IS NULL THEN
  RAISE EXCEPTION 'Run the existing orders steps 1 and 2 first'; END IF;
 IF EXISTS(SELECT 1 FROM public.weekly_orders WHERE location_id IS NOT NULL GROUP BY location_id,week_start HAVING count(*)>1) THEN
  RAISE EXCEPTION 'Duplicate restaurant/week orders found; reconcile them before migration'; END IF;
END $preflight$;
ALTER TABLE public.order_suppliers ALTER COLUMN minimum_order_amount DROP NOT NULL, ALTER COLUMN minimum_order_amount DROP DEFAULT;
ALTER TABLE public.order_products ALTER COLUMN unit_price DROP NOT NULL, ALTER COLUMN unit_price DROP DEFAULT, ALTER COLUMN supplier_id DROP NOT NULL;
ALTER TABLE public.order_products ADD COLUMN IF NOT EXISTS source_key text;
CREATE UNIQUE INDEX IF NOT EXISTS order_products_source_unique ON public.order_products(source_key);
ALTER TABLE public.weekly_orders ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS orders_location_week_unique ON public.weekly_orders(location_id,week_start) WHERE location_id IS NOT NULL;
ALTER TABLE public.weekly_order_items ALTER COLUMN unit_price_snapshot DROP NOT NULL, ALTER COLUMN supplier_id_snapshot DROP NOT NULL, ALTER COLUMN supplier_name_snapshot DROP NOT NULL;
ALTER TABLE public.weekly_order_items ADD COLUMN IF NOT EXISTS category_snapshot text;
ALTER TABLE public.weekly_order_items ADD COLUMN IF NOT EXISTS unit_snapshot text;
ALTER TABLE public.weekly_order_items ADD COLUMN IF NOT EXISTS minimum_snapshot numeric(12,2);
-- All application writes now go through authenticated RPCs below.
DROP TRIGGER IF EXISTS order_guard_order_changes_trg ON public.weekly_orders;
DROP TRIGGER IF EXISTS order_guard_item_changes_trg ON public.weekly_order_items;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.weekly_orders,public.weekly_order_items,public.order_suppliers,public.order_products FROM PUBLIC,anon,authenticated;
DO $revoke$ DECLARE t text; cols text; BEGIN
 FOREACH t IN ARRAY ARRAY['weekly_orders','weekly_order_items','order_suppliers','order_products'] LOOP
 SELECT string_agg(format('%I',column_name),',') INTO cols FROM information_schema.columns WHERE table_schema='public' AND table_name=t;
 EXECUTE format('REVOKE INSERT (%s),UPDATE (%s),REFERENCES (%s) ON public.%I FROM PUBLIC,anon,authenticated',cols,cols,cols,t);
 END LOOP;
END $revoke$;
CREATE SCHEMA IF NOT EXISTS bar_manager_orders_private;
REVOKE ALL ON SCHEMA bar_manager_orders_private FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION bar_manager_orders_private.assert_actor() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT (public.order_is_admin() OR EXISTS(SELECT 1 FROM public.order_user_access a JOIN public.order_locations l ON l.id=a.location_id WHERE a.user_id=auth.uid() AND l.is_active)) THEN
 RAISE EXCEPTION 'Нет доступа к заказам. Администратор должен привязать аккаунт к ресторану.'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.bm_orders_context() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM bar_manager_orders_private.assert_actor();
 RETURN jsonb_build_object('isAdmin',public.order_is_admin(),'locationId',public.order_my_location(),
 'locations',(SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.name),'[]'::jsonb) FROM public.order_locations l WHERE l.is_active AND (public.order_is_admin() OR l.id=public.order_my_location())));
END $$;
CREATE OR REPLACE FUNCTION public.bm_orders_catalog() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM bar_manager_orders_private.assert_actor();
 RETURN jsonb_build_object('products',(SELECT coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('unit_price',p.unit_price::text) ORDER BY p.category,p.name),'[]'::jsonb) FROM public.order_products p WHERE p.is_active OR public.order_is_admin()),
 'suppliers',(SELECT coalesce(jsonb_agg(to_jsonb(s)||jsonb_build_object('minimum_order_amount',s.minimum_order_amount::text) ORDER BY s.name),'[]'::jsonb) FROM public.order_suppliers s));
END $$;
CREATE OR REPLACE FUNCTION public.bm_orders_open(p_week date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE loc uuid; o public.weekly_orders; BEGIN
 PERFORM bar_manager_orders_private.assert_actor();
 loc:=public.order_my_location();
 IF loc IS NULL THEN RAISE EXCEPTION 'Аккаунт не привязан к ресторану'; END IF;
 IF p_week IS NULL OR extract(isodow from p_week)<>1 THEN RAISE EXCEPTION 'Укажите понедельник недели заказа'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(loc::text||p_week::text,0));
 SELECT * INTO o FROM public.weekly_orders WHERE location_id=loc AND week_start=p_week FOR UPDATE;
 IF NOT FOUND THEN
 INSERT INTO public.weekly_orders(week_start,created_by,location_id) VALUES(p_week,auth.uid(),loc) RETURNING * INTO o;
 ELSIF o.created_by<>auth.uid() THEN RAISE EXCEPTION 'Заказ этой недели создан другим сотрудником. Обратитесь к администратору.'; END IF;
 RETURN jsonb_build_object('order',to_jsonb(o),'items',(SELECT coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('quantity',i.quantity::text,'unit_price_snapshot',i.unit_price_snapshot::text)),'[]'::jsonb) FROM public.weekly_order_items i WHERE order_id=o.id));
END $$;
CREATE OR REPLACE FUNCTION public.bm_orders_save(p_order uuid,p_revision integer,p_items jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.weekly_orders; x jsonb; q numeric; pid uuid; catalog_changed boolean; BEGIN
 PERFORM bar_manager_orders_private.assert_actor();
 SELECT * INTO o FROM public.weekly_orders WHERE id=p_order FOR UPDATE;
 IF NOT FOUND OR o.created_by<>auth.uid() OR o.location_id IS DISTINCT FROM public.order_my_location() THEN RAISE EXCEPTION 'Нет доступа к этому заказу'; END IF;
 IF o.status NOT IN ('draft','revision_requested') THEN RAISE EXCEPTION 'Отправленный заказ нельзя редактировать'; END IF;
 IF p_revision IS DISTINCT FROM o.revision THEN RAISE EXCEPTION 'Заказ изменён в другой сессии. Обновите экран.'; END IF;
 IF p_items IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)>1000 THEN RAISE EXCEPTION 'Неверный состав заказа'; END IF;
 IF EXISTS(SELECT value->>'product_id' FROM jsonb_array_elements(p_items) GROUP BY value->>'product_id' HAVING count(*)>1) THEN RAISE EXCEPTION 'Повторяющиеся товары'; END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  pid:=(x->>'product_id')::uuid;
  IF coalesce(x->>'quantity','') !~ '^[0-9]+([.][0-9]{1,3})?$' THEN RAISE EXCEPTION 'Некорректное количество'; END IF;
  q:=(x->>'quantity')::numeric;
  IF q<=0 OR q>999999999 THEN RAISE EXCEPTION 'Количество должно быть положительным'; END IF;
  PERFORM 1 FROM public.order_products WHERE id=pid AND is_active FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Товар недоступен. Обновите каталог.'; END IF;
 END LOOP;
 PERFORM 1 FROM public.order_suppliers s WHERE s.id IN(SELECT p.supplier_id FROM public.order_products p JOIN jsonb_array_elements(p_items) AS j(value) ON p.id=(j.value->>'product_id')::uuid) ORDER BY s.id FOR SHARE;
 SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) AS j(value)
 JOIN public.order_products p ON p.id=(j.value->>'product_id')::uuid
 LEFT JOIN public.order_suppliers s ON s.id=p.supplier_id
 WHERE (j.value->>'expected_price')::numeric IS DISTINCT FROM p.unit_price
 OR (j.value->>'expected_minimum')::numeric IS DISTINCT FROM s.minimum_order_amount
 OR (j.value->>'expected_supplier')::uuid IS DISTINCT FROM p.supplier_id) INTO catalog_changed;
 DELETE FROM public.weekly_order_items WHERE order_id=o.id;
 INSERT INTO public.weekly_order_items(order_id,product_id,quantity,unit_price_snapshot,product_name_snapshot,supplier_id_snapshot,supplier_name_snapshot,category_snapshot,unit_snapshot,minimum_snapshot)
 SELECT o.id,p.id,(j.value->>'quantity')::numeric,p.unit_price,p.name,p.supplier_id,s.name,p.category,p.unit,s.minimum_order_amount
 FROM jsonb_array_elements(p_items) AS j(value) JOIN public.order_products p ON p.id=(j.value->>'product_id')::uuid LEFT JOIN public.order_suppliers s ON s.id=p.supplier_id;
 UPDATE public.weekly_orders SET revision=revision+1,updated_at=now() WHERE id=o.id RETURNING * INTO o;
 RETURN jsonb_build_object('revision',o.revision,'catalogChanged',catalog_changed);
END $$;
CREATE OR REPLACE FUNCTION public.bm_orders_submit(p_order uuid,p_revision integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.weekly_orders; errors jsonb:='[]'; v record; changed boolean; BEGIN
 PERFORM bar_manager_orders_private.assert_actor();
 SELECT * INTO o FROM public.weekly_orders WHERE id=p_order FOR UPDATE;
 IF NOT FOUND OR o.created_by<>auth.uid() OR o.location_id IS DISTINCT FROM public.order_my_location() THEN RAISE EXCEPTION 'Нет доступа к этому заказу'; END IF;
 IF o.status IN ('submitted','approved') THEN RETURN jsonb_build_object('ok',true,'alreadySubmitted',true); END IF;
 IF o.status NOT IN ('draft','revision_requested') THEN RAISE EXCEPTION 'Заказ нельзя отправить'; END IF;
 IF p_revision IS DISTINCT FROM o.revision THEN RAISE EXCEPTION 'Заказ изменён. Обновите экран.'; END IF;
 PERFORM 1 FROM public.order_products p JOIN public.weekly_order_items i ON p.id=i.product_id WHERE i.order_id=o.id ORDER BY p.id FOR SHARE OF p;
 PERFORM 1 FROM public.order_suppliers s WHERE s.id IN(SELECT p.supplier_id FROM public.order_products p JOIN public.weekly_order_items i ON i.product_id=p.id WHERE i.order_id=o.id) ORDER BY s.id FOR SHARE;
 IF NOT EXISTS(SELECT 1 FROM public.weekly_order_items WHERE order_id=o.id) THEN errors:=errors||jsonb_build_array('Добавьте товары в заказ.'); END IF;
 SELECT EXISTS(SELECT 1 FROM public.weekly_order_items i JOIN public.order_products p ON p.id=i.product_id LEFT JOIN public.order_suppliers s ON s.id=p.supplier_id WHERE i.order_id=o.id AND (i.unit_price_snapshot IS DISTINCT FROM p.unit_price OR i.supplier_id_snapshot IS DISTINCT FROM p.supplier_id OR i.minimum_snapshot IS DISTINCT FROM s.minimum_order_amount)) INTO changed;
 FOR v IN SELECT p.*,s.is_active AS supplier_active,s.minimum_order_amount FROM public.weekly_order_items i JOIN public.order_products p ON p.id=i.product_id LEFT JOIN public.order_suppliers s ON s.id=p.supplier_id WHERE i.order_id=o.id LOOP
  IF NOT v.is_active OR v.supplier_active IS NOT TRUE THEN errors:=errors||jsonb_build_array(v.name||': поставщик или товар недоступен'); END IF;
  IF v.unit_price IS NULL THEN errors:=errors||jsonb_build_array(v.name||': не указана цена'); END IF;
  IF v.minimum_order_amount IS NULL THEN errors:=errors||jsonb_build_array(v.name||': не указан минимум поставщика'); END IF;
 END LOOP;
 FOR v IN SELECT s.id,s.name,s.minimum_order_amount,sum(round(i.quantity*p.unit_price,2)) AS amount FROM public.weekly_order_items i JOIN public.order_products p ON p.id=i.product_id JOIN public.order_suppliers s ON s.id=p.supplier_id WHERE i.order_id=o.id GROUP BY s.id,s.name,s.minimum_order_amount LOOP
  IF v.amount<v.minimum_order_amount THEN errors:=errors||jsonb_build_array(v.name||': не хватает '||(v.minimum_order_amount-v.amount)::text||' ₽'); END IF;
 END LOOP;
 IF changed THEN errors:=errors||jsonb_build_array('Цены или условия поставщиков изменились. Обновите каталог, проверьте итог и сохраните заказ повторно.'); END IF;
 IF jsonb_array_length(errors)>0 THEN RETURN jsonb_build_object('ok',false,'issues',errors); END IF;
 UPDATE public.weekly_orders SET status='submitted',submitted_at=now(),reviewed_at=NULL,manager_id=NULL,manager_comment=NULL,revision=revision+1,updated_at=now() WHERE id=o.id;
 RETURN jsonb_build_object('ok',true);
END $$;
CREATE OR REPLACE FUNCTION public.bm_orders_dashboard(p_week date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.order_is_admin() THEN RAISE EXCEPTION 'Только для администратора'; END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(o)||jsonb_build_object('items',(SELECT coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('quantity',i.quantity::text,'unit_price_snapshot',i.unit_price_snapshot::text)),'[]'::jsonb) FROM public.weekly_order_items i WHERE i.order_id=o.id)) ORDER BY o.created_at) FROM public.weekly_orders o WHERE o.week_start=p_week),'[]'::jsonb);
END $$;
CREATE OR REPLACE FUNCTION public.bm_orders_review(p_order uuid,p_revision integer,p_action text,p_comment text DEFAULT '') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.weekly_orders; BEGIN
 IF auth.uid() IS NULL OR NOT public.order_is_admin() THEN RAISE EXCEPTION 'Только для администратора'; END IF;
 SELECT * INTO o FROM public.weekly_orders WHERE id=p_order FOR UPDATE;
 IF NOT FOUND OR o.status<>'submitted' OR o.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'Заказ уже изменён. Обновите список.'; END IF;
 IF p_action NOT IN ('approved','revision_requested') THEN RAISE EXCEPTION 'Неверное действие'; END IF;
 IF p_action='revision_requested' AND coalesce(trim(p_comment),'')='' THEN RAISE EXCEPTION 'Укажите причину возврата'; END IF;
 UPDATE public.weekly_orders SET status=p_action,manager_comment=left(p_comment,2000),manager_id=auth.uid(),reviewed_at=now(),revision=revision+1,updated_at=now() WHERE id=o.id;
END $$;
CREATE OR REPLACE FUNCTION public.bm_orders_catalog_edit(p_kind text,p_id uuid,p_amount numeric,p_supplier uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.order_is_admin() THEN RAISE EXCEPTION 'Только для администратора'; END IF;
 IF p_amount IS NOT NULL AND (p_amount<0 OR p_amount>9999999999.99 OR p_amount<>round(p_amount,2) OR p_amount::text IN ('NaN','Infinity','-Infinity')) THEN RAISE EXCEPTION 'Неверная сумма'; END IF;
 IF p_kind='supplier' THEN UPDATE public.order_suppliers SET minimum_order_amount=p_amount,updated_at=now() WHERE id=p_id;
 ELSIF p_kind='product' THEN UPDATE public.order_products SET unit_price=p_amount,supplier_id=p_supplier,updated_at=now() WHERE id=p_id;
 ELSE RAISE EXCEPTION 'Неверная операция'; END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'Запись не найдена'; END IF;
END $$;
-- Explicit grants: no anonymous access and no public execution of mutation functions.
DO $grants$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'bm_orders_%' LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature);
 END LOOP;
END $grants$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA bar_manager_orders_private FROM PUBLIC,anon,authenticated;
COMMIT;
