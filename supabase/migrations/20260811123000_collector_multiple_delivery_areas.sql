alter table public.collectors
  add column if not exists delivery_areas text[] not null default '{}';

update public.collectors
set delivery_areas = array[delivery_area]
where coalesce(array_length(delivery_areas, 1), 0) = 0
  and nullif(trim(delivery_area), '') is not null;

create index if not exists collectors_delivery_areas_idx
  on public.collectors using gin (delivery_areas);
