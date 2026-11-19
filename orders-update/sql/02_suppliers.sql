BEGIN;
DO $seed$ DECLARE s jsonb; BEGIN
 FOR s IN SELECT value FROM jsonb_array_elements($data$[{"name": "Парадокс", "minimum": "10000.00"}, {"name": "Неско", "minimum": "10000.00"}, {"name": "Лудинг", "minimum": "8000.00"}, {"name": "Невский синдикат", "minimum": "5000.00"}, {"name": "Алефтрейд", "minimum": "5000.00"}, {"name": "ЦБ", "minimum": "6500.00"}, {"name": "Ладога", "minimum": "12000.00"}, {"name": "Аквилон", "minimum": "5000.00"}, {"name": "Партнер", "minimum": "6000.00"}, {"name": "AF brew", "minimum": "10000.00"}, {"name": "БирИнсайдерс", "minimum": "7500.00"}, {"name": "Кола", "minimum": "4000.00"}, {"name": "АгроБар", "minimum": "6000.00"}, {"name": "Кошелева", "minimum": "2800.00"}, {"name": "Фест", "minimum": "6000.00"}, {"name": "Комплекс бар", "minimum": null}, {"name": "Чайный мир", "minimum": "5000.00"}, {"name": "Руст", "minimum": "7000.00"}, {"name": "АСТ", "minimum": "10000.00"}, {"name": "Бакунин", "minimum": "10000.00"}, {"name": "озон", "minimum": null}, {"name": "БирРитейл", "minimum": null}, {"name": "Кока Кола", "minimum": null}, {"name": "метро", "minimum": null}, {"name": "ип Кошелева", "minimum": null}, {"name": "РестИнтернешнл", "minimum": null}, {"name": "Гербариста", "minimum": null}, {"name": "Кондитерская", "minimum": null}]$data$::jsonb) LOOP
  IF NOT EXISTS(SELECT 1 FROM public.order_suppliers WHERE lower(btrim(name))=lower(btrim(s->>'name'))) THEN
   INSERT INTO public.order_suppliers(name,minimum_order_amount) VALUES(s->>'name',(s->>'minimum')::numeric);
  END IF;
 END LOOP;
END $seed$;
COMMIT;
