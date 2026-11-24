begin;
create table if not exists public.bm_update_devices (
 token text primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 updated_at timestamptz not null default now()
);
alter table public.bm_update_devices enable row level security;
revoke all on public.bm_update_devices from public, anon, authenticated;
grant select, delete on public.bm_update_devices to service_role;
create or replace function public.bm_register_update_device(p_token text) returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'Нет доступа'; end if;
 if p_token is null or length(p_token)>250 or p_token !~ '^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$' then raise exception 'Некорректный токен'; end if;
 insert into public.bm_update_devices(token,user_id) values(p_token,auth.uid()) on conflict(token) do update set user_id=excluded.user_id,updated_at=now();
end; $$;
create or replace function public.bm_unregister_update_device(p_token text) returns void language sql security definer set search_path = '' as $$
 delete from public.bm_update_devices where token=p_token and user_id=auth.uid();
$$;
revoke all on function public.bm_register_update_device(text), public.bm_unregister_update_device(text) from public, anon;
grant execute on function public.bm_register_update_device(text), public.bm_unregister_update_device(text) to authenticated;
commit;
