BEGIN;
ALTER TABLE public.weekly_orders ADD COLUMN IF NOT EXISTS supplement_history jsonb NOT NULL DEFAULT '[]';
CREATE OR REPLACE FUNCTION public.bm_orders_supplement(p_order uuid,p_revision integer,p_items jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.weekly_orders; p public.order_products; s public.order_suppliers; old public.weekly_order_items; x jsonb; q numeric; price numeric; sid uuid; before_items jsonb; added jsonb:='[]'; v record;
BEGIN
 PERFORM bar_manager_orders_private.assert_actor();
 SELECT * INTO o FROM public.weekly_orders WHERE id=p_order FOR UPDATE;
 IF NOT FOUND OR o.created_by<>auth.uid() OR o.location_id IS DISTINCT FROM public.order_my_location() THEN RAISE EXCEPTION 'Нет доступа к этому заказу'; END IF;
 IF o.status<>'submitted' THEN RAISE EXCEPTION 'Дополнение доступно только до подтверждения администратором. Обновите заказ.'; END IF;
 IF o.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'Заказ уже изменён. Обновите его перед повторной отправкой: дополнение могло сохраниться.'; END IF;
 IF p_items IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Добавьте товары'; END IF;
 IF EXISTS(SELECT value->>'product_id' FROM jsonb_array_elements(p_items) GROUP BY value->>'product_id' HAVING count(*)>1) THEN RAISE EXCEPTION 'Повторяющиеся товары'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(i)),'[]') INTO before_items FROM public.weekly_order_items i WHERE order_id=o.id;
 PERFORM 1 FROM public.order_products WHERE id IN(SELECT (value->>'product_id')::uuid FROM jsonb_array_elements(p_items)) ORDER BY id FOR SHARE;
 PERFORM 1 FROM public.order_suppliers ORDER BY id FOR SHARE;
 FOR x IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  IF coalesce(x->>'quantity','') !~ '^[0-9]+([.][0-9]{1,3})?$' THEN RAISE EXCEPTION 'Некорректное количество'; END IF;
  q:=(x->>'quantity')::numeric;
  IF q<=0 OR q>999999999 THEN RAISE EXCEPTION 'Некорректное количество'; END IF;
  SELECT * INTO p FROM public.order_products WHERE id=(x->>'product_id')::uuid AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Товар недоступен'; END IF;
  SELECT * INTO old FROM public.weekly_order_items WHERE order_id=o.id AND product_id=p.id;
  IF FOUND THEN price:=old.unit_price_snapshot; sid:=old.supplier_id_snapshot;
  ELSE price:=p.unit_price; sid:=p.supplier_id; END IF;
  SELECT * INTO s FROM public.order_suppliers WHERE id=sid;
  IF NOT FOUND OR NOT s.is_active OR s.minimum_order_amount IS NULL OR price IS NULL THEN RAISE EXCEPTION 'Не заданы цена, поставщик или минимум'; END IF;
  IF price IS DISTINCT FROM (x->>'expected_price')::numeric OR sid IS DISTINCT FROM (x->>'expected_supplier')::uuid OR s.minimum_order_amount IS DISTINCT FROM (x->>'expected_minimum')::numeric THEN RAISE EXCEPTION 'Условия изменились. Обновите заказ и проверьте суммы.'; END IF;
  IF coalesce(old.quantity,0)+q>999999999 THEN RAISE EXCEPTION 'Слишком большое количество'; END IF;
  INSERT INTO public.weekly_order_items(order_id,product_id,quantity,unit_price_snapshot,product_name_snapshot,supplier_id_snapshot,supplier_name_snapshot,category_snapshot,unit_snapshot,minimum_snapshot)
  VALUES(o.id,p.id,q,price,p.name,sid,s.name,p.category,p.unit,s.minimum_order_amount)
  ON CONFLICT(order_id,product_id) DO UPDATE SET quantity=public.weekly_order_items.quantity+excluded.quantity;
  added:=added||jsonb_build_array(jsonb_build_object('name',coalesce(old.product_name_snapshot,p.name),'quantity',q::text,'price',price::text,'supplier',s.name));
 END LOOP;
 FOR v IN SELECT vendor.name,vendor.minimum_order_amount,vendor.is_active,sum(round(i.quantity*i.unit_price_snapshot,2)) amount FROM public.weekly_order_items i LEFT JOIN public.order_suppliers vendor ON vendor.id=i.supplier_id_snapshot WHERE i.order_id=o.id GROUP BY vendor.id,vendor.name,vendor.minimum_order_amount,vendor.is_active LOOP
  IF v.minimum_order_amount IS NULL OR v.is_active IS NOT TRUE THEN RAISE EXCEPTION 'Минимум поставщика не задан или поставщик недоступен'; END IF;
  IF v.amount<v.minimum_order_amount THEN RAISE EXCEPTION '%: не хватает % ₽',v.name,v.minimum_order_amount-v.amount; END IF;
 END LOOP;
 UPDATE public.weekly_orders SET revision=revision+1,updated_at=now(),supplement_history=supplement_history||jsonb_build_array(jsonb_build_object('at',now(),'before',before_items,'added',added)) WHERE id=o.id;
 RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.bm_orders_supplement(uuid,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bm_orders_supplement(uuid,integer,jsonb) TO authenticated;
COMMIT;
