import type { Prisma } from "@prisma/client";

/**
 * Case-insensitive "contains" filter for the search boxes.
 *
 * Prisma's plain `contains` compiles to `LIKE`, which Postgres evaluates
 * case-sensitively — searching "acme" would miss a client named "Acme". Every
 * text search goes through this helper so the mode is set in exactly one place.
 */
export function like(query: string): Prisma.StringFilter<never> {
  return { contains: query, mode: "insensitive" };
}
