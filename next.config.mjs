/** @type {import('next').NextConfig} */
const nextConfig = {
  // Strict mode catches double-invoke bugs in development.
  reactStrictMode: true,

  // Allow server components to fetch from Google Sheets.
  // No image domains needed yet (no next/image from external hosts).
};

export default nextConfig;
