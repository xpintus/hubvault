-- Update auth trigger to reject 'guest' role assignments.
-- Self-signup is no longer supported; only admins create users via the manage-user edge function.
-- Any direct API call that tries to set role='guest' will be blocked.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_hub_id uuid;
  new_role text;
begin
  new_role := new.raw_user_meta_data->>'role';
  new_hub_id := nullif(new.raw_user_meta_data->>'hub_id', '')::uuid;

  -- Block self-signup: reject any new user that isn't created by the manage-user flow
  -- The manage-user function sets role to super_admin/hub_admin/supervisor/collector
  -- and includes 'created_by_admin: true' in metadata
  if coalesce(new.raw_user_meta_data->>'created_by_admin', 'false')::boolean is false then
    raise exception 'Self-registration is disabled. Please contact your administrator to create an account.'
      using errcode = 'check_violation';
  end if;

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
