import { prisma } from "@/lib/db";

/**
 * Liveness and readiness probe for the container healthcheck and any load
 * balancer in front of it.
 *
 * Reachable without a session (see `UNAUTHENTICATED_PATHS` in the middleware),
 * so it deliberately reports nothing beyond up/down — no version, no connection
 * string, no error text.
 */

// Never prerendered or cached: a cached "ok" would be worse than useless.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(): Promise<Response> {
  const startedAt = Date.now();

  try {
    // A trivial round trip proves the pool is alive and migrations can be read.
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    console.error("Health check failed: database unreachable", error);
    return Response.json(
      { status: "error", database: "unreachable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return Response.json(
    { status: "ok", database: "ok", latencyMs: Date.now() - startedAt },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
