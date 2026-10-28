"use client";

import { useState } from "react";

const THEME_COOKIE = "kc_theme";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Light/dark switch. Flips the class on <html> immediately and remembers the
 * choice in a cookie, which the root layout reads so the next page load
 * renders in the same theme without a flash.
 */
export function ThemeToggle({
  initial,
  labels = { toDark: "Dark mode", toLight: "Light mode" },
  className,
}: {
  initial: "light" | "dark";
  labels?: { toDark: string; toLight: string };
  className?: string;
}) {
  const [theme, setTheme] = useState(initial);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
    setTheme(next);
  }

  return (
    <button type="button" onClick={toggle} className={className}>
      {theme === "dark" ? labels.toLight : labels.toDark}
    </button>
  );
}
