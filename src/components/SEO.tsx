import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title: string;
  description: string;
  path?: string;
  image?: string;
  type?: string;
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  noindex?: boolean;
  structuredData?: object[];
}

export const SITE_NAME = 'HubVault';
const SITE_URL = 'https://www.hubvault.in';
const INDEXABLE_PATHS = new Set(['/tools/cash-calculator','/tools/cod-reconciliation-calculator','/collection-reconciliation-software','/cod-reconciliation-software','/daily-closing-software','/logistics-cash-collection-software']);
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image-v2.jpg`;

export default function SEO({
  title,
  description,
  path = '',
  image,
  type = 'website',
  publishedTime,
  modifiedTime,
  author,
  noindex = false,
  structuredData = [],
}: SEOProps) {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const canonicalUrl = `${SITE_URL}${path}`;
  const ogImage = image || DEFAULT_OG_IMAGE;
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
  const isIndexablePublicPage = !noindex && INDEXABLE_PATHS.has(path) && currentPath === path;

  return (
    <Helmet>
      {/* Standard meta */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      <meta name="robots" content={isIndexablePublicPage ? 'index, follow' : 'noindex, nofollow'} />
      <meta name="googlebot" content={isIndexablePublicPage ? 'index, follow, max-image-preview:large' : 'noindex, nofollow'} />

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      {publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}
      {author && <meta property="article:author" content={author} />}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      {structuredData.map((data,index)=><script key={index} type="application/ld+json">{JSON.stringify(data)}</script>)}
    </Helmet>
  );
}
