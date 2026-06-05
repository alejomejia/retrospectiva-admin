import type { MetadataRoute } from "next";

/**
 * robots.txt — this is a private internal admin panel. Nothing here should
 * ever be crawled or indexed. We disallow every well-behaved crawler with a
 * wildcard rule, and additionally name the known AI / LLM scrapers explicitly
 * so there's no ambiguity (some honor a named rule but ignore `*`).
 *
 * Note: robots.txt is advisory — it only stops crawlers that choose to obey
 * it. The real access control is the auth gate in `proxy.ts` plus the
 * network-level lockdown (reverse-proxy IP allowlist / Cloudflare Access)
 * described in `docs/deployment/dokploy.md`.
 */

// Named scrapers that ignore `User-Agent: *` or that we want on record.
const BLOCKED_AGENTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "anthropic-ai",
  "Claude-Web",
  "ClaudeBot",
  "CCBot",
  "Google-Extended",
  "PerplexityBot",
  "Perplexity-User",
  "Amazonbot",
  "Applebot-Extended",
  "Bytespider",
  "Meta-ExternalAgent",
  "FacebookBot",
  "Diffbot",
  "ImagesiftBot",
  "Omgilibot",
  "cohere-ai",
  "YouBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", disallow: "/" },
      ...BLOCKED_AGENTS.map((userAgent) => ({ userAgent, disallow: "/" })),
    ],
  };
}
