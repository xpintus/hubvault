create table if not exists public.delivery_routes (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references public.hubs(id) on delete cascade,
  code text not null,
  name text not null,
  areas text[] not null default '{}',
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(hub_id, code)
);

alter table public.delivery_routes enable row level security;
create policy "delivery_routes_select" on public.delivery_routes for select to authenticated using (public.user_can_access_hub(hub_id));
create policy "delivery_routes_insert" on public.delivery_routes for insert to authenticated with check (public.user_role()='super_admin' or (public.user_role() in ('hub_admin','supervisor') and public.user_can_access_hub(hub_id)));
create policy "delivery_routes_update" on public.delivery_routes for update to authenticated using (public.user_role()='super_admin' or (public.user_role() in ('hub_admin','supervisor') and public.user_can_access_hub(hub_id))) with check (public.user_role()='super_admin' or (public.user_role() in ('hub_admin','supervisor') and public.user_can_access_hub(hub_id)));
create policy "delivery_routes_delete" on public.delivery_routes for delete to authenticated using (public.user_role()='super_admin' or (public.user_role() in ('hub_admin','supervisor') and public.user_can_access_hub(hub_id)));
create index if not exists delivery_routes_hub_idx on public.delivery_routes(hub_id);
create index if not exists delivery_routes_areas_idx on public.delivery_routes using gin(areas);
