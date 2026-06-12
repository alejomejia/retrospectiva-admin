import "server-only";
import { z } from "zod";

/**
 * Server-side configuration. Application code reads env via this object —
 * nothing else under `src/` should touch `process.env` directly. The
 * zod schema parses once at module import, so if a required variable is
 * missing or malformed the process fails to boot with a single readable
 * error listing everything that's wrong.
 *
 * Two intentional exceptions live OUTSIDE `src/`:
 *   - `drizzle.config.ts` reads DATABASE_URL directly
 *   - `playwright.config.ts` reads CI / PLAYWRIGHT_BASE_URL directly
 * Both are build-tool CLI configs that run outside the Next.js runtime;
 * routing them through this file would force the full app env to be set
 * just to generate a migration or run a browser test.
 *
 * NEXT_PUBLIC_* variables go in `public-config.ts` (no `server-only`
 * marker) so they can be safely imported from client components.
 */

const Schema = z.object({
  // ----- core -----
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // ----- auth -----
  // Comma-separated `username:bcrypt-hash` pairs. The auth layer parses
  // this into a Map on first read; the format is validated there.
  ALLOW_USERS: z.string().min(3),
  // 32+ bytes (base64) used to sign the session JWT.
  SESSION_SECRET: z.string().min(32),

  // ----- database -----
  DATABASE_URL: z.url(),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),

  // ----- redis (BullMQ) -----
  REDIS_URL: z.url(),

  // ----- openai -----
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_TEXT_MODEL: z.string().default("gpt-4.1-mini"),
  OPENAI_TRANSLATE_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_IMAGE_MODEL: z.string().default("gpt-image-2"),
  BRAND_VOICE_PROMPT: z.string().optional(),

  // ----- etsy -----
  ETSY_CLIENT_ID: z.string().min(1),
  ETSY_CLIENT_SECRET: z.string().min(1),
  ETSY_REDIRECT_URI: z.url(),
  // Populated after the initial OAuth connect; not required at boot.
  ETSY_SHOP_ID: z.string().optional(),
  ETSY_WEBHOOK_SECRET: z.string().optional(),

  // ----- cloudflare r2 -----
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  R2_PUBLIC_BASE_URL: z.url(),

  // ----- retrospectiva website webhook -----
  WEBSITE_WEBHOOK_URL: z.url(),
  WEBSITE_WEBHOOK_SECRET: z.string().min(16),

  // ----- optional notifiers -----
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
});

const parsed = Schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  // NOTE: fail fast — a misconfigured env should never start the app.
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

const env = parsed.data;

export const config = {
  env: env.NODE_ENV,
  // AUTH
  allowUsers: env.ALLOW_USERS,
  sessionSecret: env.SESSION_SECRET,
  // DB
  databaseUrl: env.DATABASE_URL,
  databasePoolMax: env.DATABASE_POOL_MAX,
  // REDIS
  redisUrl: env.REDIS_URL,
  // OPENAI
  openaiApiKey: env.OPENAI_API_KEY,
  openaiTextModel: env.OPENAI_TEXT_MODEL,
  openaiTranslateModel: env.OPENAI_TRANSLATE_MODEL,
  openaiImageModel: env.OPENAI_IMAGE_MODEL,
  brandVoicePrompt: env.BRAND_VOICE_PROMPT,
  // ETSY
  etsyClientId: env.ETSY_CLIENT_ID,
  etsyClientSecret: env.ETSY_CLIENT_SECRET,
  etsyRedirectUri: env.ETSY_REDIRECT_URI,
  etsyShopId: env.ETSY_SHOP_ID,
  etsyWebhookSecret: env.ETSY_WEBHOOK_SECRET,
  // R2
  r2AccountId: env.R2_ACCOUNT_ID,
  r2AccessKeyId: env.R2_ACCESS_KEY_ID,
  r2SecretAccessKey: env.R2_SECRET_ACCESS_KEY,
  r2Bucket: env.R2_BUCKET,
  r2PublicBaseUrl: env.R2_PUBLIC_BASE_URL,
  // WEBSITE WEBHOOK
  websiteWebhookUrl: env.WEBSITE_WEBHOOK_URL,
  websiteWebhookSecret: env.WEBSITE_WEBHOOK_SECRET,
  // OPTIONAL
  telegramBotToken: env.TELEGRAM_BOT_TOKEN,
  telegramChatId: env.TELEGRAM_CHAT_ID,
} as const;

export const isDev = config.env === "development";
export const isProd = config.env === "production";
export const isTest = config.env === "test";
