/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  
  webpack: (config) => {
    config.externals.push(
      // On garde celui-ci pour @xenova/transformers
      { 'onnxruntime-node': 'commonjs onnxruntime-node' }
      // On a RETIRÉ la ligne pour 'pdfjs-dist'
    );
    
    return config;
  }
}

export default config