alter table public.hubs
  add column if not exists logistics_company text;

-- Preserve access for existing Valmo-labelled hubs during rollout.
update public.hubs
set logistics_company = 'Valmo'
where logistics_company is null
  and (name ilike '%valmo%' or code ilike '%valmo%');

comment on column public.hubs.logistics_company is
  'Logistics company operating this hub. Hub Operations is enabled only for Valmo hubs.';
