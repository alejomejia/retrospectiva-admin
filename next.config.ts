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
      // Raw video clips NO LONGER transit the app server — the browser
      // uploads them directly to R2 via a presigned PUT (see
      // `createVideoUpload` + `r2/presign.ts`), and the worker transcodes
      // them. So server-action bodies are now only small payloads
      // (compressed images, the tiny WebP video poster). 8 MB is ample
      // headroom; keeping it low means a large body can't buffer in — and
      // OOM — the Next.js process, which is the failure this pipeline
      // exists to prevent.
      bodySizeLimit: "8mb",
    },
    // Next 16 buffers every request body so proxy.ts and the route handler
    // can both read it. Kept in lockstep with `bodySizeLimit` so the two
    // guards agree; both are small now that the big upload bypasses the app.
    proxyClientMaxBodySize: "8mb",
  },
};

export default nextConfig;
