/**
 * Politique de sécurité du contenu, en mode RAPPORT SEUL : rien n'est bloqué, les violations sont signalées à /api/csp-report
 * (visibles dans les journaux Vercel, message « [csp] violation signalée »). Après quelques jours sans violation légitime,
 * remplacer l'en-tête par `Content-Security-Policy` pour appliquer la politique.
 * 'unsafe-inline' est nécessaire tant que les scripts et styles injectés par Next.js n'utilisent pas de nonce.
 */
const isDev = process.env.NODE_ENV !== 'production';
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://i.ibb.co https://s10.aconvert.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com https://va.vercel-scripts.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
  "frame-ancestors 'self'",
  'report-uri /api/csp-report',
].join('; ');

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  
  // Configuration expérimentale pour Server Actions et fichiers volumineux
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 's10.aconvert.com',
        port: '',
        pathname: '/convert/p3r68-cdx67/**'
      }
    ]
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy-Report-Only', value: contentSecurityPolicy },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, must-revalidate',
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
      {
        source: '/icons/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  webpack: (config) => {
    config.externals.push(
      // On garde celui-ci pour @xenova/transformers
      { 'onnxruntime-node': 'commonjs onnxruntime-node' }
      // On a RETIRÉ la ligne pour 'pdfjs-dist'
    );

    return config;
  },
};

export default config;
