import SEO from '@/components/SEO';
import { BlogPostRecord, getPublishedPosts, getReadingTime } from '@/lib/blogService';
import { ArrowRight, BookOpenText, Calendar, Clock, Loader2, Search, Tag } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const displayDate = (value: string | null) => value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '';

export default function BlogList() {
  const [posts, setPosts] = useState<BlogPostRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  useEffect(() => { getPublishedPosts().then(setPosts).catch(() => setFailed(true)).finally(() => setLoading(false)); }, []);
  const categories = useMemo(() => ['All', ...Array.from(new Set(posts.map(post => post.category)))], [posts]);
  const visible = useMemo(() => posts.filter(post => (category === 'All' || post.category === category) && `${post.title} ${post.excerpt}`.toLowerCase().includes(search.toLowerCase())), [posts, search, category]);

  return <>
    <SEO title="HubVault Blog — Logistics & Collection Operations" description="Practical insights from HubVault on logistics, delivery operations, COD collection and reconciliation." path="/blog" />
    <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 text-white">
      <div className="absolute -right-24 top-0 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" /><div className="relative mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:py-24"><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[.18em] text-cyan-200"><BookOpenText className="h-4 w-4" />HubVault Insights</span><h1 className="mx-auto mt-5 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">Ideas that make operations run better</h1><p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-indigo-100">Original, practical guidance for logistics teams managing deliveries, COD and daily reconciliation.</p></div>
    </section>
    <section className="min-h-[420px] bg-neutral-50 py-12 dark:bg-neutral-900 lg:py-16"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mb-9 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="relative w-full lg:max-w-md"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" /><input value={search} onChange={e => setSearch(e.target.value)} className="input-base py-3 pl-11" placeholder="Search articles…" /></div><div className="flex gap-2 overflow-x-auto pb-1">{categories.map(item => <button key={item} onClick={() => setCategory(item)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold ${category === item ? 'bg-brand-600 text-white' : 'bg-white text-neutral-600 shadow-sm dark:bg-neutral-950 dark:text-neutral-300'}`}>{item}</button>)}</div></div>
      {loading ? <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-brand-600" /></div> : failed ? <div className="rounded-3xl border border-red-200 bg-red-50 py-16 text-center dark:border-red-900/50 dark:bg-red-950/20"><p className="font-bold text-red-700 dark:text-red-300">Articles could not be loaded.</p><button onClick={() => window.location.reload()} className="mt-3 text-sm font-bold text-brand-600">Try again</button></div> : visible.length === 0 ? <div className="rounded-3xl border border-dashed border-neutral-300 py-20 text-center dark:border-neutral-700"><BookOpenText className="mx-auto h-12 w-12 text-neutral-300" /><h2 className="mt-4 text-lg font-black">{posts.length ? 'No matching articles' : 'New articles are coming soon'}</h2><p className="mt-2 text-sm text-neutral-500">{posts.length ? 'Try another search or category.' : 'Our editorial team is preparing original HubVault guides.'}</p></div> : <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{visible.map(post => <Link key={post.id} to={`/blog/${post.slug}`} className="group overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-neutral-800 dark:bg-neutral-950"><div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-indigo-950 to-violet-700">{post.cover_image_url ? <img src={post.cover_image_url} alt={post.title} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center"><BookOpenText className="h-12 w-12 text-white/50" /></div>}<span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-indigo-700 backdrop-blur"><Tag className="h-3 w-3" />{post.category}</span></div><div className="p-5"><h2 className="text-lg font-black leading-snug text-neutral-900 transition group-hover:text-brand-600 dark:text-white">{post.title}</h2><p className="mt-2 line-clamp-3 text-sm leading-6 text-neutral-500">{post.excerpt}</p><div className="mt-5 flex items-center gap-4 border-t border-neutral-100 pt-4 text-xs text-neutral-400 dark:border-neutral-800"><span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{displayDate(post.published_at)}</span><span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{getReadingTime(post.content)} min</span><ArrowRight className="ml-auto h-4 w-4 text-brand-600 transition group-hover:translate-x-1" /></div></div></Link>)}</div>}
    </div></section>
  </>;
}
