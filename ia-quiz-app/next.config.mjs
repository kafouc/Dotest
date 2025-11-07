/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
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
