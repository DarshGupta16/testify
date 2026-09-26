-- ==============================================================================
-- Migration: 20260926000000_delete_user_account_rpc.sql
-- Description:
-- 1. Sets REPLICA IDENTITY FULL on synced tables for realtime DELETE streaming
-- 2. Hardens storage update policy with WITH CHECK
-- 3. Creates public.delete_user_account() SECURITY DEFINER RPC function
-- ==============================================================================

-- 1. REPLICA IDENTITY FULL FOR REALTIME DELETION STREAMING
alter table public.tests replica identity full;
alter table public.folders replica identity full;
alter table public.subjects replica identity full;
alter table public.attempts replica identity full;
alter table public.settings replica identity full;
alter table public.synced_api_keys replica identity full;

-- 2. HARDEN STORAGE UPDATE POLICY WITH WITH CHECK
drop policy if exists "User Diagram Update Access" on storage.objects;
create policy "User Diagram Update Access"
    on storage.objects for update
    using (
        bucket_id = 'assessment-diagrams'
        and auth.uid()::text = (storage.foldername(name))[1]
    )
    with check (
        bucket_id = 'assessment-diagrams'
        and auth.uid()::text = (storage.foldername(name))[1]
    );

-- 3. ATOMIC USER ACCOUNT DELETION FUNCTION (SECURITY DEFINER)
create or replace function public.delete_user_account()
returns void
language plpgsql
security definer
set search_path = public, auth, storage
as $$
declare
    v_user_id uuid;
begin
    -- Verify authenticated user identity from cryptographically signed JWT
    v_user_id := auth.uid();
    if v_user_id is null then
        raise exception 'Unauthorized: Must be logged in to delete your account';
    end if;

    -- Purge user diagram files from Supabase Storage bucket
    delete from storage.objects 
    where bucket_id = 'assessment-diagrams' 
      and (storage.foldername(name))[1] = v_user_id::text;

    -- Delete user data across public tables (also cascades from auth.users foreign key)
    delete from public.tests where user_id = v_user_id;
    delete from public.folders where user_id = v_user_id;
    delete from public.subjects where user_id = v_user_id;
    delete from public.attempts where user_id = v_user_id;
    delete from public.settings where user_id = v_user_id;
    delete from public.synced_api_keys where user_id = v_user_id;

    -- Delete the user from auth.users (permanently purges identity & login credentials)
    delete from auth.users where id = v_user_id;
end;
$$;

-- Grant execution permissions only to authenticated users
revoke all on function public.delete_user_account() from public;
grant execute on function public.delete_user_account() to authenticated;
