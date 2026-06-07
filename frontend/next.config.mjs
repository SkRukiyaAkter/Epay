/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.API_BASE_URL || "http://localhost:5000"}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
