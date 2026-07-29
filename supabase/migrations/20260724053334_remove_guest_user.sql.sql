-- Remove the guest user account from auth.users
-- The profile row was already deleted via execute_sql
DELETE FROM auth.users WHERE id = 'e32c75d4-ed3e-4989-bf62-bd0d79ee3307';
