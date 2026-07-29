/*
# Auth trigger: auto-create profile on signup

When a new user signs up via Supabase auth, a matching row is inserted into
`public.profiles` automatically. The profile is seeded with the email from
auth.users and a default role of 'collector'. The frontend's signup flow sets
the user's display name + role + hub via raw_user_meta_data, which this
trigger copies through.

## Changes
- Creates function `public.handle_new_user()` that inserts a profile row
  from the new auth.users record, pulling name/role/hub_id from
  raw_user_meta_data (sent during signUp).
- Attaches it as an AFTER INSERT trigger on auth.users.
- SECURITY DEFINER so it can write to profiles regardless of caller role.
*/

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role, hub_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'collector'),
    nullif(new.raw_user_meta_data->>'hub_id', '')::uuid
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
