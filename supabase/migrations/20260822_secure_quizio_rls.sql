-- Remove the public SECURITY DEFINER helper and express owner checks directly
-- in each row-level policy using the authenticated user JWT email.

drop policy if exists "admins can read owner allow-list" on public.quizio_admins;
create policy "owners can read their own allow-list entry"
on public.quizio_admins for select to authenticated
using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists "published categories are readable" on public.quiz_categories;
create policy "published categories are readable"
on public.quiz_categories for select to anon, authenticated
using (
  is_active
  or exists (
    select 1 from public.quizio_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

drop policy if exists "admins manage categories" on public.quiz_categories;
create policy "owners manage categories"
on public.quiz_categories for all to authenticated
using (
  exists (
    select 1 from public.quizio_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
)
with check (
  exists (
    select 1 from public.quizio_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

drop policy if exists "published questions are readable" on public.quiz_questions;
create policy "published questions are readable"
on public.quiz_questions for select to anon, authenticated
using (
  status = 'published'
  or exists (
    select 1 from public.quizio_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

drop policy if exists "admins manage questions" on public.quiz_questions;
create policy "owners manage questions"
on public.quiz_questions for all to authenticated
using (
  exists (
    select 1 from public.quizio_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
)
with check (
  exists (
    select 1 from public.quizio_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

drop function if exists public.is_quizio_admin();
