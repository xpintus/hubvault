import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Calendar, Clock, ArrowRight, Tag } from 'lucide-react';
import { clsx } from 'clsx';
import SEO from '@/components/SEO';
import { blogPosts, BLOG_CATEGORIES } from '@/lib/blogData';
import AdSlot from '@/components/ui/AdSlot';
import { formatDate } from '@/lib/format';

export default function Blog() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered = useMemo(() => {
    return blogPosts.filter((post) => {
      const matchesSearch =
        post.title.toLowerCase().includes(search.toLowerCase()) ||
        post.excerpt.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeCategory === 'All' || post.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [search, activeCategory]);

  const categories = ['All', ...BLOG_CATEGORIES];

  return (
    <>
      <SEO
        title="Blog — Insights on Collection Reconciliation & Logistics Finance"
        description="Articles on collection management, reconciliation, cash handling, dues tracking, and digital tools for logistics and delivery businesses. Learn best practices and strategies."
        path="/blog"
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-neutral-50 dark:from-neutral-950">
        <div className="absolute top-20 -right-20 w-96 h-96 rounded-full bg-brand-200/20 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-sm font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-wide">Blog</span>
            <h1 className="mt-3 text-4xl lg:text-5xl font-bold tracking-tight text-neutral-800 dark:text-neutral-200 leading-[1.15]">
              Insights on collection reconciliation
            </h1>
            <p className="mt-6 text-lg text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Practical articles on collection management, cash handling, reconciliation, and digital tools
              for logistics and delivery businesses.
            </p>
          </div>
        </div>
      </section>

      {/* Blog content */}
      <section className="py-16 lg:py-20 bg-neutral-50 dark:bg-neutral-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Search & filters */}
          <div className="mb-10 space-y-4">
            <div className="relative max-w-md mx-auto">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search articles..."
                className="input-base pl-10 py-2.5 text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={clsx(
                    'rounded-xl px-3.5 py-1.5 text-sm font-medium transition-all active:scale-95',
                    activeCategory === cat
                      ? 'bg-gradient-to-r from-brand-600 to-brand-400 text-white shadow-glow'
                      : 'bg-neutral-50 dark:bg-neutral-950 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Results count */}
          <p className="mb-6 text-sm text-neutral-500">
            {filtered.length} {filtered.length === 1 ? 'article' : 'articles'}
            {activeCategory !== 'All' && ` in ${activeCategory}`}
          </p>

          {/* Posts grid */}
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((post, i) => (
                <div key={post.slug} className="contents">
                  {(i === 3) && (
                    <div className="card overflow-hidden flex flex-col bg-[var(--card-bg)]">
                      <div className="p-5 flex flex-col flex-1">
                        <AdSlot slot="2222222222" className="min-h-[280px]" />
                      </div>
                    </div>
                  )}
                  <Link
                    to={`/blog/${post.slug}`}
                    className="card-hover overflow-hidden group flex flex-col"
                  >
                  {/* Featured image */}
                  <div className="relative aspect-[16/9] overflow-hidden bg-neutral-100 dark:bg-neutral-900">
                    <img
                      src={post.image}
                      alt={post.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-lg bg-[var(--card-bg)]/95 backdrop-blur px-2.5 py-1 text-xs font-semibold text-brand-600 shadow-soft">
                      <Tag className="h-3 w-3" />
                      {post.category}
                    </span>
                  </div>
                  {/* Content */}
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 leading-snug group-hover:text-brand-600 transition">
                      {post.title}
                    </h3>
                    <p className="mt-2 text-sm text-neutral-400 leading-relaxed line-clamp-2">{post.excerpt}</p>
                    <div className="mt-4 flex items-center gap-3 text-xs text-neutral-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(post.publishedAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {post.readingTime} min read
                      </span>
                    </div>
                    <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center gap-1.5 text-sm font-semibold text-brand-600 group-hover:text-brand-600 transition">
                      Read More
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Search className="h-12 w-12 text-neutral-400 mx-auto" />
              <p className="mt-4 text-sm font-semibold text-neutral-700 dark:text-neutral-300">No articles found</p>
              <p className="mt-1.5 text-sm text-neutral-400">Try a different search or category filter.</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
