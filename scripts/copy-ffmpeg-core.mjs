/**
 * Copies the single-threaded ffmpeg.wasm core (`@ffmpeg/core`) into
 * `public/ffmpeg/` so the browser can fetch it same-origin instead of
 * from a CDN. This keeps the app fully self-hosted (no third-party
 * runtime dependency, works offline / behind a firewall) and avoids the
 * cross-origin-isolation (COOP/COEP) headers the multi-threaded core
 * would require.
 *
 * The core is ~31 MB and is NOT committed (see .gitignore). This script
 * runs on `postinstall` and again before `build`, so the files are
 * always present after a fresh `pnpm install`.
 *
 * Loaded lazily by `src/lib/utils/trim-video.ts` — the wasm only ships
 * to a user who actually uploads an oversize video.
 */
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "node_modules", "@ffmpeg", "core", "dist", "umd");
const destDir = join(root, "public", "ffmpeg");

const files = ["ffmpeg-core.js", "ffmpeg-core.wasm"];

await mkdir(destDir, { recursive: true });
for (const f of files) {
  await copyFile(join(srcDir, f), join(destDir, f));
}
console.log(`Copied ffmpeg core (${files.join(", ")}) → public/ffmpeg/`);
