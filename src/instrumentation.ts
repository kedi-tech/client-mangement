/**
 * Runs once when the server process starts, before it accepts any request.
 *
 * Configuration is validated here so a bad deployment fails at boot with a clear
 * message, rather than serving traffic and throwing on the first login attempt.
 */
export async function register(): Promise<void> {
  // Only the Node.js server runtime boots the app; the Edge runtime re-runs this
  // module per invocation and has no access to the full environment.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { assertEnv } = await import("@/lib/env");

  try {
    assertEnv();
  } catch (error) {
    console.error(`\n${(error as Error).message}`);
    throw error;
  }
}
