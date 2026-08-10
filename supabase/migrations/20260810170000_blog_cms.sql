-- First-party blog CMS. Public visitors can only read published posts;
-- all content management is restricted to super admins.
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 180),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  excerpt text not null default '',
  content text not null default '',
  category text not null default 'Operations',
  cover_image_url text,
  author_name text not null default 'HubVault Editorial Team',
  author_role text not null default 'HubVault',
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blog_posts_public_idx
  on public.blog_posts (status, published_at desc);

alter table public.blog_posts enable row level security;

drop policy if exists "Public can read published blog posts" on public.blog_posts;
create policy "Public can read published blog posts"
  on public.blog_posts for select
  using (status = 'published' and published_at is not null and published_at <= now());

drop policy if exists "Super admins can read all blog posts" on public.blog_posts;
create policy "Super admins can read all blog posts"
  on public.blog_posts for select to authenticated
  using (public.user_role() = 'super_admin');

drop policy if exists "Super admins can create blog posts" on public.blog_posts;
create policy "Super admins can create blog posts"
  on public.blog_posts for insert to authenticated
  with check (public.user_role() = 'super_admin' and created_by = auth.uid());

drop policy if exists "Super admins can update blog posts" on public.blog_posts;
create policy "Super admins can update blog posts"
  on public.blog_posts for update to authenticated
  using (public.user_role() = 'super_admin')
  with check (public.user_role() = 'super_admin');

drop policy if exists "Super admins can delete blog posts" on public.blog_posts;
create policy "Super admins can delete blog posts"
  on public.blog_posts for delete to authenticated
  using (public.user_role() = 'super_admin');

create or replace function public.set_blog_post_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  if new.status = 'published' and new.published_at is null then
    new.published_at = now();
  elsif new.status = 'draft' then
    new.published_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists set_blog_post_updated_at on public.blog_posts;
create trigger set_blog_post_updated_at
before update on public.blog_posts
for each row execute function public.set_blog_post_updated_at();

