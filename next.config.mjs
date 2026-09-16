const repoName = 'mac-tahmin';
const isProd = process.env.NODE_ENV === 'production';
const basePath = isProd ? `/${repoName}` : '';

const nextConfig = {
  output: 'export',
  basePath,
  assetPrefix: basePath,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_GEMINI_API_KEY:
      process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '',
    NEXT_PUBLIC_API_FOOTBALL_KEY:
      process.env.NEXT_PUBLIC_API_FOOTBALL_KEY || process.env.API_FOOTBALL_KEY || '',
  },
};

export default nextConfig;
