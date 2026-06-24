import type { NextConfig } from "next";

// Security + anti-indexing headers applied to every response. These harden
// the admin against framing/MIME/referrer leakage and tell every crawler not
// to index or archive anything (belt-and-suspenders with `app/robots.ts`).
//
// CSP is intentionally limited to directives that don't restrict scripts or
// styles — Next.js injects inline hydration scripts, so a `script-src` policy
// would need per-request nonces (a separate, larger change). The directives
// below (frame-ancestors / base-uri / object-src / form-action) close the
// high-value gaps without breaking the app.
const securityHeaders = [
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet, noimageindex" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  experimental: {
    serverActions: {
      // Video uploads run through a server action (browser → Next → R2),
      // and the RAW source is now sent for server-side transcode — a 30 s
      // 4K/60 phone clip is ~150-350 MB. The user-facing source cap is
      // 400 MB (VIDEO_SOURCE_MAX_MB in `src/lib/products/media-limits.ts`);
      // 420 MB here gives ~20 MB of headroom for the multipart envelope.
      // A client-side pre-check at 400 MB is the primary user-facing
      // guard — this is the framework safety net.
      bodySizeLimit: "420mb",
    },
    // Next 16 buffers every request body so proxy.ts and the route
    // handler can both read it. Default is 10 MB; we need it ≥ the
    // server-action cap, otherwise the proxy clips the body and the
    // action parses a torn multipart payload (the "Unexpected end of
    // form" failure). Kept identical to bodySizeLimit so the two
    // guards agree.
    proxyClientMaxBodySize: "420mb",
  },
};

export default nextConfig;
