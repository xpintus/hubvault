import { supabase } from './supabase';

export type BlogStatus = 'draft' | 'published';

export interface BlogPostRecord {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  cover_image_url: string | null;
  author_name: string;
  author_role: string;
  status: BlogStatus;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type BlogPostInput = Pick<BlogPostRecord, 'title' | 'slug' | 'excerpt' | 'content' | 'category' | 'cover_image_url' | 'author_name' | 'author_role' | 'status'>;

const TABLE = 'blog_posts';

export function makeBlogSlug(value: string) {
  return value.toLowerCase().trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);
}

export function getReadingTime(content: string) {
  return Math.max(1, Math.ceil(content.trim().split(/\s+/).filter(Boolean).length / 200));
}

export async function getPublishedPosts() {
  const { data, error } = await supabase.from(TABLE).select('*').eq('status', 'published').lte('published_at', new Date().toISOString()).order('published_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BlogPostRecord[];
}

export async function getPublishedPost(slug: string) {
  const { data, error } = await supabase.from(TABLE).select('*').eq('slug', slug).eq('status', 'published').lte('published_at', new Date().toISOString()).maybeSingle();
  if (error) throw error;
  return data as BlogPostRecord | null;
}

export async function getAllBlogPosts() {
  const { data, error } = await supabase.from(TABLE).select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BlogPostRecord[];
}

export async function saveBlogPost(input: BlogPostInput, id?: string) {
  if (id) {
    const { data, error } = await supabase.from(TABLE).update(input).eq('id', id).select().single();
    if (error) throw error;
    return data as BlogPostRecord;
  }
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Session expired. Please log in again.');
  const { data, error } = await supabase.from(TABLE).insert({ ...input, created_by: user.id, published_at: input.status === 'published' ? new Date().toISOString() : null }).select().single();
  if (error) throw error;
  return data as BlogPostRecord;
}

export async function deleteBlogPost(id: string) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
