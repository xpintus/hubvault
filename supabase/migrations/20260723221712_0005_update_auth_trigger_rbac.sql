/*
# Update auth trigger for can_create_hub default
*/
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_hub_id uuid;
begin
  new_hub_id := nullif(new.raw_user_meta_data->>'hub_id', '')::uuid;

  insert into public.profiles (id, name, email, role, hub_id, can_create_hub)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'collector'),
    new_hub_id,
    coalesce((new.raw_user_meta_data->>'can_create_hub')::boolean, false)
  )
  on conflict (id) do nothing;

  -- auto-grant access to the assigned hub
  if new_hub_id is not null then
    insert into public.user_hub_access (user_id, hub_id)
    values (new.id, new_hub_id)
    on conflict (user_id, hub_id) do nothing;
  end if;

  return new;
end;
$$;
