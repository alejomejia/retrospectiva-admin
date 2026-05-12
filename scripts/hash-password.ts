#!/usr/bin/env tsx

/**
 * Generates a base64-wrapped bcrypt hash for a plaintext password so it
 * can be added to the ALLOW_USERS env var. The plaintext NEVER reaches
 * disk or logs.
 *
 * The bcrypt hash itself contains `$` characters, which Next.js's
 * dotenv loader interpolates as `$VAR` references and silently
 * mangles. We base64-encode the hash on the way out so the env value
 * has no characters dotenv treats specially.
 *
 * Usage:
 *   pnpm hash-password 'my secret password'
 *   pnpm hash-password # prompts interactively (hidden input)
 */
import { hashPassword } from "@/lib/auth/password";
import { Buffer } from "node:buffer";
import readline from "node:readline";

async function readSecret(prompt: string): Promise<string> {
  // Hide echo on the TTY so the password doesn't appear in scrollback.
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  // @ts-expect-error _writeToOutput is a documented readline private hook.
  rl._writeToOutput = (s: string) => {
    if (s.includes(prompt)) {
      process.stdout.write(s);
    } else {
      process.stdout.write("*");
    }
  };
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function main() {
  const arg = process.argv.slice(2).join(" ").trim();
  const password = arg || (await readSecret("password: "));
  if (!password) {
    console.error("Empty password — aborting.");
    process.exit(1);
  }
  const hash = await hashPassword(password);
  const encoded = Buffer.from(hash, "utf8").toString("base64");
  // Encoded value goes to stdout so callers piping the output still work.
  process.stdout.write(`${encoded}\n`);
  // Hint goes to stderr — informational, doesn't pollute scripted use.
  process.stderr.write(
    "\n" +
      "Paste into .env.local. No quoting or escaping needed — the hash\n" +
      "is base64-encoded so dotenv won't try to interpolate it:\n\n" +
      `  ALLOW_USERS=username:${encoded}\n` +
      "\n" +
      "To add a second user, comma-separate the pairs:\n\n" +
      `  ALLOW_USERS=alice:BASE64_A,bob:BASE64_B\n\n`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
