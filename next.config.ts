import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    serverActions: {
      // Video uploads run through a server action (browser → Next → R2).
      // The user-facing cap is 100 MB (see `src/lib/products/media-limits.ts`,
      // matches Etsy's hard cap); 110 MB here gives ~10 MB of headroom
      // for the multipart envelope so a legitimate 99.5 MB file with a
      // few KB of form-data overhead still parses cleanly. A client-
      // side pre-check at 100 MB is the primary user-facing guard —
      // this is the framework safety net.
      bodySizeLimit: "110mb",
    },
    // Next 16 buffers every request body so proxy.ts and the route
    // handler can both read it. Default is 10 MB; we need it ≥ the
    // server-action cap, otherwise the proxy clips the body and the
    // action parses a torn multipart payload (the "Unexpected end of
    // form" failure). Kept identical to bodySizeLimit so the two
    // guards agree.
    proxyClientMaxBodySize: "110mb",
  },
};

export default nextConfig;
