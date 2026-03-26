/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ensure that the output is standalone for Cloud Run if needed
  output: 'standalone',
  // Disable image optimization if it's causing issues in the sandbox
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
