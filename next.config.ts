import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack (default in Next.js 16): alias canvas to an empty stub.
  // pdfjs-dist requires canvas in its Node.js build for rendering;
  // we only need text extraction so canvas is never called.
  turbopack: {
    resolveAlias: {
      canvas: "./stubs/canvas.js",
    },
  },
  // Keep the webpack alias for non-Turbopack builds (e.g. `next build`).
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    // @mlc-ai/web-llm uses WebGPU and is browser-only — never bundle for Node.
    config.externals = [
      ...(Array.isArray(config.externals) ? config.externals : []),
      ({ request }: { request?: string }, callback: (err?: null, result?: string) => void) => {
        if (request?.startsWith("@mlc-ai/web-llm")) {
          return callback(null, `commonjs ${request}`);
        }
        callback();
      },
    ];
    return config;
  },
};

export default nextConfig;
