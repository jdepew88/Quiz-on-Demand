import { useEffect, useRef, useState } from "react";
import {
  applyThemePreference,
  readThemePreference,
  storeThemePreference,
  withThemeTransition,
  type ThemePreference,
} from "./theme";

/**
 * The visitor's theme preference, kept in sync with <html data-theme> and localStorage.
 *
 * On mount the stored choice is re-applied without animation (theme-init.js has usually
 * applied it already, before first paint). Every later change is remembered and cross-faded.
 */
export function useThemePreference(): [ThemePreference, (next: ThemePreference) => void] {
  const [preference, setPreference] = useState<ThemePreference>(readThemePreference);
  const hasMounted = useRef(false);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      applyThemePreference(preference);
      return;
    }

    storeThemePreference(preference);
    withThemeTransition(() => applyThemePreference(preference));
  }, [preference]);

  return [preference, setPreference];
}
