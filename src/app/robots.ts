import type { MetadataRoute } from "next";

/**
 * Everything here is private client data behind a login, so nothing should be
 * crawled or indexed. Served alongside the `noindex` robots directive in the
 * root layout — a crawler that ignores one may still honour the other.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
