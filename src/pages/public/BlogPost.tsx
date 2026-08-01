import SEO from '@/components/SEO';
import AdSlot from '@/components/ui/AdSlot';
import { getPostBySlug,getRelatedPosts } from '@/lib/blogData';
import { formatDate } from '@/lib/format';
import {
ArrowLeft,ArrowRight,
Calendar,Clock,
Facebook,
Linkedin,
Share2,
Tag,
Twitter,
User,
} from 'lucide-react';
import { Link,Navigate,useParams } from 'react-router-dom';

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPostBySlug(slug) : undefined;

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  const related = getRelatedPosts(post.slug, 3);
  const shareUrl = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, '')}/${post.slug}`;

  return (
    <>
      <SEO
        title={post.title}
        description={post.excerpt}
        path={`/blog/${post.slug}`}
        image={post.image}
        type="article"
        publishedTime={post.publishedAt}
        modifiedTime={post.updatedAt}
        author={post.author}
      />

      {/* Hero with image */}
      <section className="relative">
        <div className="relative aspect-[2/1] sm:aspect-[3/1] lg:aspect-[4/1] max-h-[420px] overflow-hidden" style={{ background: "var(--neutral-900)" }}>
          <img src={post.image} alt={post.title} className="h-full w-full object-cover opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/90 via-slate-900/40 to-transparent" />
          <div className="absolute inset-0 flex items-end">
            <div className="mx-auto max-w-4xl w-full px-4 sm:px-6 lg:px-8 pb-8 lg:pb-12">
              <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm font-medium text-white/80 hover:text-white transition mb-4">
                <ArrowLeft className="h-4 w-4" />
                Back to Blog
              </Link>
              <span className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white">
                <Tag className="h-3 w-3" />
                {post.category}
              </span>
              <h1 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white leading-[1.2] max-w-3xl">
                {post.title}
              </h1>
            </div>
          </div>
        </div>
      </section>

      {/* Article content */}
      <section className="py-12 lg:py-16 bg-neutral-50 dark:bg-neutral-900">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-500 dark:text-neutral-500 pb-8 border-b border-neutral-200 dark:border-neutral-800">
            <span className="flex items-center gap-1.5">
              <User className="h-4 w-4 text-neutral-400" />
              <span className="font-medium text-neutral-700 dark:text-neutral-300">{post.author}</span>
              <span className="text-neutral-400">·</span>
              <span>{post.authorRole}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-neutral-400" />
              {formatDate(post.publishedAt)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-neutral-400" />
              {post.readingTime} min read
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-8 lg:gap-12 mt-8">
            {/* Main article */}
            <article className="min-w-0">
              {/* Excerpt */}
              <p className="text-lg text-neutral-700 dark:text-neutral-300 leading-relaxed font-medium mb-8">{post.excerpt}</p>

              {/* Content sections */}
              <div className="space-y-8">
                {post.content.map((section, idx) => (
                  <div key={idx}>
                    <h2 id={`section-${idx}`} className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-3 scroll-mt-24">{section.heading}</h2>
                    {section.body.map((para, i) => (
                      <p key={i} className="text-[15px] text-neutral-400 leading-[1.75] mb-4">{para}</p>
                    ))}
                    {idx === 1 && (
                      <div className="my-6">
                        <AdSlot slot="3333333333" className="rounded-xl overflow-hidden" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Social sharing */}
              <div className="mt-12 pt-8 border-t border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Share this article:</span>
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(shareUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 hover:bg-brand-50 dark:hover:bg-brand-600/15 hover:text-brand-600 transition"
                      aria-label="Share on Twitter/X"
                    >
                      <Twitter className="h-4 w-4" />
                    </a>
                    <a
                      href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 hover:bg-brand-50 dark:hover:bg-brand-600/15 hover:text-brand-600 transition"
                      aria-label="Share on LinkedIn"
                    >
                      <Linkedin className="h-4 w-4" />
                    </a>
                    <a
                      href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 hover:bg-brand-50 dark:hover:bg-brand-600/15 hover:text-brand-600 transition"
                      aria-label="Share on Facebook"
                    >
                      <Facebook className="h-4 w-4" />
                    </a>
                    <button
                      onClick={() => navigator.clipboard?.writeText(shareUrl)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 hover:bg-brand-50 dark:hover:bg-brand-600/15 hover:text-brand-600 transition"
                      aria-label="Copy link"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </article>

            {/* Table of contents (sidebar) */}
            <aside className="hidden lg:block">
              <div className="sticky top-24">
                <div className="card p-5 bg-neutral-50 dark:bg-neutral-900/60">
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">Table of Contents</h3>
                  <ul className="space-y-2">
                    {post.content.map((section, idx) => (
                      <li key={idx}>
                        <a
                          href={`#section-${idx}`}
                          className="text-sm text-neutral-400 hover:text-brand-600 transition leading-relaxed"
                        >
                          {section.heading}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-6">
                  <AdSlot slot="4444444444" className="rounded-xl overflow-hidden" />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Related posts */}
      {related.length > 0 && (
        <section className="py-16 lg:py-20 bg-neutral-100 dark:bg-neutral-950">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight mb-8">Related articles</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {related.map((rp) => (
                <Link
                  key={rp.slug}
                  to={`/blog/${rp.slug}`}
                  className="card-hover overflow-hidden group flex flex-col"
                >
                  <div className="relative aspect-[16/9] overflow-hidden bg-neutral-100 dark:bg-neutral-900">
                    <img
                      src={rp.image}
                      alt={rp.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <span className="text-xs font-semibold text-brand-600">{rp.category}</span>
                    <h3 className="mt-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100 leading-snug group-hover:text-brand-600 transition">
                      {rp.title}
                    </h3>
                    <div className="mt-3 flex items-center gap-3 text-xs text-neutral-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(rp.publishedAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {rp.readingTime} min
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-1 text-sm font-semibold text-brand-600 group-hover:text-brand-600 transition">
                      Read More
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
