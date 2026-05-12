import { NextResponse } from "next/server";

/**
 * Healthcheck endpoint. Always returns 200 with a small JSON body — used
 * by the Docker Compose healthcheck and any external probes.
 *
 * Whitelisted in proxy.ts so it's reachable without a session.
 */
export async function GET() {
  return NextResponse.json({ ok: true, ts: new Date().toISOString() });
}
