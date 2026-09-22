/** @type {import('next').NextConfig} */
const backendUrl = process.env.BACKEND_API_URL || "http://127.0.0.1:3000";

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
