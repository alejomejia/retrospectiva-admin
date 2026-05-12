#!/usr/bin/env tsx
/**
 * Generates a bcrypt hash for a plaintext password so it can be added to
 * the ALLOW_USERS env var. The plaintext NEVER reaches disk or logs.
 *
 * Usage:
 *   pnpm hash-password 'my secret password'
 *   pnpm hash-password # prompts interactively (hidden input)
 */
import bcrypt from "bcryptjs";
import readline from "node:readline";

const ROUNDS = 12;

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
  const hash = await bcrypt.hash(password, ROUNDS);
  process.stdout.write(`${hash}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
