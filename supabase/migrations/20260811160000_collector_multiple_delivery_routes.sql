alter table public.collectors
  add column if not exists delivery_routes text[] not null default '{}';

update public.collectors
set delivery_routes = array[delivery_route]
where coalesce(array_length(delivery_routes,1),0)=0
  and nullif(trim(delivery_route),'') is not null;

create index if not exists collectors_delivery_routes_idx
  on public.collectors using gin(delivery_routes);
