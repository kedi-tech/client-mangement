import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Response headers applied to every route.
 *
 * The Content-Security-Policy is *not* here — it carries a per-request nonce and
 * is set in `src/middleware.ts` instead. These are the static ones.
 */
const securityHeaders = [
  // Never let a browser second-guess a declared Content-Type. Matters most for
  // the file download route, where the bytes are user supplied.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Belt and braces alongside the CSP `frame-ancestors` directive, for older
  // browsers that do not implement it.
  { key: "X-Frame-Options", value: "DENY" },
  // Client names and record ids live in URLs; do not leak them to other origins.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app asks for none of these, so switch them off.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  ...(isProduction
    ? [
        // Two years, subdomains included. Browsers ignore this over plain HTTP,
        // so it is harmless if TLS terminates at a proxy in front of the app.
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image — see Dockerfile.
  output: "standalone",

  serverExternalPackages: ["@prisma/client", "bcryptjs"],

  // Do not advertise the framework and version to anyone scanning for targets.
  poweredByHeader: false,

  // A wrong Content-Length or a stale proxy cache is worse than a slow response;
  // keep responses honest and let the reverse proxy handle compression.
  compress: true,

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
