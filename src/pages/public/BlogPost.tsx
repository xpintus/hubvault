import SEO from '@/components/SEO';
import { BlogPostRecord, getPublishedPost, getReadingTime } from '@/lib/blogService';
import { ArrowLeft, Calendar, Clock, Facebook, Linkedin, Loader2, Share2, Tag, Twitter, User } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

type Block = { type: 'heading' | 'paragraph' | 'list'; text?: string; items?: string[] };
function parseContent(content: string): Block[] {
  const blocks: Block[] = []; let list: string[] = [];
  const flush = () => { if (list.length) { blocks.push({ type: 'list', items: list }); list = []; } };
  content.split(/\r?\n/).forEach(raw => { const line = raw.trim(); if (!line) { flush(); return; } if (line.startsWith('## ')) { flush(); blocks.push({ type: 'heading', text: line.slice(3) }); } else if (line.startsWith('- ')) list.push(line.slice(2)); else { flush(); blocks.push({ type: 'paragraph', text: line }); } }); flush(); return blocks;
}
const displayDate = (value: string | null) => value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value)) : '';

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>(); const [post, setPost] = useState<BlogPostRecord | null>();
  useEffect(() => { if (!slug) { setPost(null); return; } getPublishedPost(slug).then(setPost).catch(() => setPost(null)); }, [slug]);
  const blocks = useMemo(() => parseContent(post?.content ?? ''), [post?.content]);
  if (post === undefined) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-brand-600" /></div>;
  if (!post) return <Navigate to="/blog" replace />;
  const shareUrl = window.location.href;
  return <>
    <SEO title={post.title} description={post.excerpt} path={`/blog/${post.slug}`} image={post.cover_image_url ?? undefined} type="article" publishedTime={post.published_at ?? undefined} modifiedTime={post.updated_at} author={post.author_name} />
    <header className="relative overflow-hidden bg-slate-950 text-white"><div className="absolute inset-0">{post.cover_image_url && <img src={post.cover_image_url} alt="" className="h-full w-full object-cover opacity-30" />}<div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-indigo-950/60" /></div><div className="relative mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:py-20"><Link to="/blog" className="inline-flex items-center gap-2 text-sm font-bold text-indigo-200 hover:text-white"><ArrowLeft className="h-4 w-4" />Back to Blog</Link><span className="mt-8 flex w-fit items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-black"><Tag className="h-3.5 w-3.5" />{post.category}</span><h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight tracking-tight sm:text-5xl">{post.title}</h1><p className="mt-5 max-w-3xl text-base leading-7 text-slate-200 sm:text-lg">{post.excerpt}</p><div className="mt-7 flex flex-wrap gap-5 text-sm text-slate-300"><span className="flex items-center gap-2"><User className="h-4 w-4" />{post.author_name} · {post.author_role}</span><span className="flex items-center gap-2"><Calendar className="h-4 w-4" />{displayDate(post.published_at)}</span><span className="flex items-center gap-2"><Clock className="h-4 w-4" />{getReadingTime(post.content)} min read</span></div></div></header>
    <main className="bg-white py-12 dark:bg-neutral-950 lg:py-16"><article className="mx-auto max-w-3xl px-4 sm:px-6">{blocks.map((block, index) => block.type === 'heading' ? <h2 key={index} className="mb-4 mt-10 text-2xl font-black tracking-tight text-neutral-900 first:mt-0 dark:text-white">{block.text}</h2> : block.type === 'list' ? <ul key={index} className="mb-6 list-disc space-y-2 pl-6 text-[16px] leading-8 text-neutral-600 dark:text-neutral-300">{block.items?.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p key={index} className="mb-6 text-[16px] leading-8 text-neutral-600 dark:text-neutral-300">{block.text}</p>)}<div className="mt-12 flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-7 dark:border-neutral-800"><span className="mr-2 text-sm font-black">Share article</span><a aria-label="Share on X" target="_blank" rel="noreferrer" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(shareUrl)}`} className="rounded-xl bg-neutral-100 p-2.5 hover:text-brand-600 dark:bg-neutral-900"><Twitter className="h-4 w-4" /></a><a aria-label="Share on LinkedIn" target="_blank" rel="noreferrer" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`} className="rounded-xl bg-neutral-100 p-2.5 hover:text-brand-600 dark:bg-neutral-900"><Linkedin className="h-4 w-4" /></a><a aria-label="Share on Facebook" target="_blank" rel="noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`} className="rounded-xl bg-neutral-100 p-2.5 hover:text-brand-600 dark:bg-neutral-900"><Facebook className="h-4 w-4" /></a><button aria-label="Copy article link" onClick={() => void navigator.clipboard.writeText(shareUrl)} className="rounded-xl bg-neutral-100 p-2.5 hover:text-brand-600 dark:bg-neutral-900"><Share2 className="h-4 w-4" /></button></div></article></main>
  </>;
}
