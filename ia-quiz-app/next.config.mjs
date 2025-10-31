/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  
  webpack: (config) => {
    // La fonction doit maintenant retourner la configuration sans le bloc config.externals
    // puisque nous supprimons les correctifs qui n'affectent que l'API /embed
    return config;
  }
}

export default config