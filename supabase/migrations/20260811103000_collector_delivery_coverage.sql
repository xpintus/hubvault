alter table public.collectors
  add column if not exists delivery_pincodes text[] not null default '{}',
  add column if not exists delivery_route text,
  add column if not exists delivery_area text,
  add column if not exists delivery_capacity integer not null default 40 check (delivery_capacity >= 0),
  add column if not exists current_pending_load integer not null default 0 check (current_pending_load >= 0),
  add column if not exists vehicle_type text not null default 'Bike' check (vehicle_type in ('Bike','Cycle','EV','Van','Walking','Other')),
  add column if not exists max_cod_amount numeric(14,2) check (max_cod_amount is null or max_cod_amount >= 0),
  add column if not exists max_delivery_weight numeric(12,2) check (max_delivery_weight is null or max_delivery_weight >= 0);

create index if not exists collectors_delivery_pincodes_idx on public.collectors using gin (delivery_pincodes);
