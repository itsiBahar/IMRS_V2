import type { NextConfig } from "next";

// Check if we are in a Codespace environment
const CODESPACE_URL = process.env.NEXT_PUBLIC_CODESPACE_NAME 
  ? `https://${process.env.NEXT_PUBLIC_CODESPACE_NAME}-8000.app.github.dev`
  : "http://127.0.0.1:8000";

// If API_URL is manually set (e.g., for HF), use it. Otherwise, use Codespace URL.
const API_URL = process.env.API_URL || CODESPACE_URL;

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_URL}/:path*`, 
      },
    ];
  },
};

export default nextConfig;