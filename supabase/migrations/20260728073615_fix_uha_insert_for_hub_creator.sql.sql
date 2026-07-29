-- Allow a hub_admin to insert user_hub_access for a hub they just created
-- (before they have any access rows). The current policy requires user_can_manage_hub
-- which is a chicken-and-egg problem for the first hub.
CREATE OR REPLACE FUNCTION public.user_can_manage_hub(p_hub_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
select
public.user_role() = 'super_admin'
or (
  public.user_role() in ('hub_admin', 'supervisor')
  and (
    public.user_can_access_hub(p_hub_id)
    -- Allow if the user created this hub (fixes first-hub chicken-and-egg)
    or exists (
      select 1 from public.hubs h
      where h.id = p_hub_id and h.created_by = auth.uid()
    )
  )
)
$function$;