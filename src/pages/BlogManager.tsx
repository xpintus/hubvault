import { useAuth } from '@/lib/auth';
import { BlogPostInput, BlogPostRecord, deleteBlogPost, getAllBlogPosts, getReadingTime, makeBlogSlug, saveBlogPost } from '@/lib/blogService';
import { confirm } from '@/lib/confirm';
import { useToast } from '@/components/ui/Toast';
import { ArrowLeft, BookOpenText, CheckCircle2, Clock3, Eye, FilePenLine, Globe2, Loader2, Plus, Save, Search, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';

const emptyPost: BlogPostInput = {
  title: '', slug: '', excerpt: '', content: '', category: 'Operations', cover_image_url: '',
  author_name: 'HubVault Editorial Team', author_role: 'HubVault', status: 'draft',
};

function niceDate(value: string | null) {
  if (!value) return 'Not published';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

export default function BlogManager() {
  const { profile } = useAuth();
  const toast = useToast();
  const [posts, setPosts] = useState<BlogPostRecord[]>([]);
  const [form, setForm] = useState<BlogPostInput>(emptyPost);
  const [editingId, setEditingId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setPosts(await getAllBlogPosts()); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Blog posts could not be loaded.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (profile?.role === 'super_admin') void load(); }, [profile?.role]);

  const filtered = useMemo(() => posts.filter(post => `${post.title} ${post.category} ${post.status}`.toLowerCase().includes(query.toLowerCase())), [posts, query]);
  const published = posts.filter(post => post.status === 'published').length;

  if (profile?.role !== 'super_admin') return <Navigate to="/dashboard" replace />;

  const update = <K extends keyof BlogPostInput>(key: K, value: BlogPostInput[K]) => setForm(current => ({ ...current, [key]: value }));
  const changeTitle = (title: string) => setForm(current => ({ ...current, title, slug: slugTouched ? current.slug : makeBlogSlug(title) }));
  const startNew = () => { setEditingId(undefined); setForm(emptyPost); setSlugTouched(false); setEditorOpen(true); };
  const edit = (post: BlogPostRecord) => {
    setEditingId(post.id);
    setSlugTouched(true);
    setForm({ title: post.title, slug: post.slug, excerpt: post.excerpt, content: post.content, category: post.category, cover_image_url: post.cover_image_url ?? '', author_name: post.author_name, author_role: post.author_role, status: post.status });
    setEditorOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.slug || !form.excerpt.trim() || form.content.trim().length < 30) {
      toast.error('Title, excerpt and at least 30 characters of article content are required.'); return;
    }
    setSaving(true);
    try {
      await saveBlogPost({ ...form, title: form.title.trim(), slug: makeBlogSlug(form.slug), excerpt: form.excerpt.trim(), content: form.content.trim(), category: form.category.trim() || 'Operations', cover_image_url: form.cover_image_url?.trim() || null, author_name: form.author_name.trim() || 'HubVault Editorial Team' }, editingId);
      toast.success(form.status === 'published' ? 'Article published successfully.' : 'Draft saved successfully.');
      setEditorOpen(false); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Article could not be saved.'); }
    finally { setSaving(false); }
  };

  const remove = async (post: BlogPostRecord) => {
    if (!await confirm({ title: 'Delete article?', message: `“${post.title}” will be permanently removed.`, confirmLabel: 'Delete', danger: true })) return;
    try { await deleteBlogPost(post.id); toast.success('Article deleted.'); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Article could not be deleted.'); }
  };

  return <div className="mx-auto max-w-7xl space-y-6 pb-10">
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-800 p-6 text-white shadow-xl sm:p-8">
      <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-cyan-300"><BookOpenText className="h-4 w-4" /> Publishing studio</div><h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">HubVault Blog CMS</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-indigo-100">Write, review and publish useful articles directly from HubVault—no third-party publishing tool required.</p></div>
        <div className="flex flex-wrap gap-3"><a href="/blog" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold backdrop-blur hover:bg-white/20"><Globe2 className="h-4 w-4" />View public blog</a><button onClick={startNew} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-indigo-700 shadow-lg hover:bg-indigo-50"><Plus className="h-4 w-4" />New article</button></div>
      </div>
      <div className="relative mt-7 grid grid-cols-2 gap-3 sm:max-w-lg"><div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur"><p className="text-2xl font-black">{posts.length}</p><p className="text-xs text-indigo-100">Total articles</p></div><div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur"><p className="text-2xl font-black">{published}</p><p className="text-xs text-indigo-100">Published</p></div></div>
    </section>

    {editorOpen ? <form onSubmit={submit} className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-5 py-4 dark:border-neutral-800"><div className="flex items-center gap-3"><button type="button" onClick={() => setEditorOpen(false)} className="rounded-xl p-2 hover:bg-neutral-100 dark:hover:bg-neutral-900"><ArrowLeft className="h-5 w-5" /></button><div><h2 className="font-black text-neutral-900 dark:text-white">{editingId ? 'Edit article' : 'Create article'}</h2><p className="text-xs text-neutral-500">{getReadingTime(form.content)} min estimated read</p></div></div><div className="flex gap-2"><button type="button" onClick={() => update('status', 'draft')} className={`rounded-xl px-3 py-2 text-sm font-bold ${form.status === 'draft' ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-900'}`}>Draft</button><button type="button" onClick={() => update('status', 'published')} className={`rounded-xl px-3 py-2 text-sm font-bold ${form.status === 'published' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-900'}`}>Publish</button></div></div>
      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-7"><div className="space-y-5">
        <label className="block"><span className="mb-2 block text-sm font-bold">Article title *</span><input value={form.title} onChange={e => changeTitle(e.target.value)} maxLength={180} className="input-base text-lg font-bold" placeholder="Write a clear, useful title" /></label>
        <label className="block"><span className="mb-2 block text-sm font-bold">Short excerpt *</span><textarea value={form.excerpt} onChange={e => update('excerpt', e.target.value)} rows={3} maxLength={350} className="input-base resize-y" placeholder="A short summary shown on the blog listing…" /></label>
        <label className="block"><span className="mb-2 block text-sm font-bold">Full article *</span><p className="mb-2 text-xs text-neutral-500">Use blank lines for paragraphs. Start a line with <b>##</b> for a section heading and <b>-</b> for bullet points.</p><textarea value={form.content} onChange={e => update('content', e.target.value)} rows={20} className="input-base resize-y font-mono text-sm leading-7" placeholder={'## Introduction\n\nWrite your article here…\n\n## Key points\n\n- First useful point'} /></label>
      </div><aside className="space-y-5">
        <div className="rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-900"><h3 className="mb-4 text-sm font-black">Publishing details</h3><div className="space-y-4"><label className="block"><span className="mb-1.5 block text-xs font-bold">URL slug</span><input value={form.slug} onChange={e => { setSlugTouched(true); update('slug', makeBlogSlug(e.target.value)); }} className="input-base" placeholder="article-url" /></label><label className="block"><span className="mb-1.5 block text-xs font-bold">Category</span><input value={form.category} onChange={e => update('category', e.target.value)} className="input-base" placeholder="Operations" /></label><label className="block"><span className="mb-1.5 block text-xs font-bold">Cover image URL</span><input type="url" value={form.cover_image_url ?? ''} onChange={e => update('cover_image_url', e.target.value)} className="input-base" placeholder="https://…" /></label><label className="block"><span className="mb-1.5 block text-xs font-bold">Author name</span><input value={form.author_name} onChange={e => update('author_name', e.target.value)} className="input-base" /></label><label className="block"><span className="mb-1.5 block text-xs font-bold">Author role</span><input value={form.author_role} onChange={e => update('author_role', e.target.value)} className="input-base" /></label></div></div>
        {form.cover_image_url && <img src={form.cover_image_url} alt="Cover preview" className="aspect-video w-full rounded-2xl object-cover" />}
        <button disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-black text-white shadow-lg hover:bg-brand-700 disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{form.status === 'published' ? 'Save & publish' : 'Save draft'}</button>
      </aside></div>
    </form> : <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-black text-neutral-900 dark:text-white">Content library</h2><p className="text-sm text-neutral-500">Draft and published articles in one place.</p></div><div className="relative sm:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" /><input value={query} onChange={e => setQuery(e.target.value)} className="input-base pl-9" placeholder="Search articles…" /></div></div>
      {loading ? <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-brand-600" /></div> : filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-neutral-300 py-16 text-center dark:border-neutral-700"><BookOpenText className="mx-auto h-10 w-10 text-neutral-300" /><p className="mt-3 font-bold">No articles yet</p><p className="mt-1 text-sm text-neutral-500">Create the first original HubVault article.</p><button onClick={startNew} className="mt-5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white">Create article</button></div> : <div className="space-y-3">{filtered.map(post => <article key={post.id} className="flex flex-col gap-4 rounded-2xl border border-neutral-200 p-4 transition hover:border-brand-300 dark:border-neutral-800 sm:flex-row sm:items-center"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10">{post.status === 'published' ? <CheckCircle2 className="h-5 w-5" /> : <FilePenLine className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-black text-neutral-900 dark:text-white">{post.title}</h3><span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${post.status === 'published' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'}`}>{post.status}</span></div><p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-neutral-500"><span>{post.category}</span><span className="flex items-center gap-1"><Clock3 className="h-3 w-3" />{niceDate(post.published_at ?? post.updated_at)}</span><span>{getReadingTime(post.content)} min read</span></p></div><div className="flex items-center gap-2">{post.status === 'published' && <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer" className="rounded-xl p-2.5 text-neutral-500 hover:bg-neutral-100 hover:text-brand-600 dark:hover:bg-neutral-900" title="View"><Eye className="h-4 w-4" /></a>}<button onClick={() => edit(post)} className="rounded-xl p-2.5 text-neutral-500 hover:bg-neutral-100 hover:text-brand-600 dark:hover:bg-neutral-900" title="Edit"><FilePenLine className="h-4 w-4" /></button><button onClick={() => void remove(post)} className="rounded-xl p-2.5 text-neutral-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10" title="Delete"><Trash2 className="h-4 w-4" /></button></div></article>)}</div>}
    </section>}
  </div>;
}
