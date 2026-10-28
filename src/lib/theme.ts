import { cookies } from "next/headers";

export type Theme = "light" | "dark";

/** Cookie the theme toggle writes. Read on the server so the first paint is right. */
export const THEME_COOKIE = "kc_theme";

/** Dark is the default; only an explicit choice of light switches it off. */
export async function readTheme(): Promise<Theme> {
  const store = await cookies();
  return store.get(THEME_COOKIE)?.value === "light" ? "light" : "dark";
}
