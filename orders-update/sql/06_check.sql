SELECT count(*) AS imported_products, count(*) FILTER(WHERE unit_price IS NULL) AS missing_prices,count(*) FILTER(WHERE supplier_id IS NULL) AS missing_suppliers FROM public.order_products WHERE source_key LIKE 'ketch:order-product:%';
SELECT name,minimum_order_amount FROM public.order_suppliers ORDER BY name;
