import { IconMonitor, IconMoon, IconSun } from "./Icons";
import { useThemePreference } from "../lib/useThemePreference";
import type { ThemePreference } from "../lib/theme";

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof IconSun }[] = [
  { value: "light", label: "Light theme", Icon: IconSun },
  { value: "system", label: "Match system theme", Icon: IconMonitor },
  { value: "dark", label: "Dark theme", Icon: IconMoon },
];

/**
 * A three-way segmented control: Light, Match system, Dark.
 *
 * Built from toggle buttons (aria-pressed) inside a labelled group. Radio inputs would be
 * the textbook alternative, but the quiz screen is a radio group of answer choices, and a
 * second set of radios on the same page would be noise for screen-reader users scanning for
 * the answers. The choice is stored on this device only.
 */
export function ThemeToggle() {
  const [preference, setPreference] = useThemePreference();

  return (
    <div className="theme-toggle" role="group" aria-label="Color theme">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          className="theme-toggle__option"
          aria-pressed={preference === value}
          title={label}
          onClick={() => setPreference(value)}
        >
          <Icon size={16} />
          <span className="visually-hidden">{label}</span>
        </button>
      ))}
    </div>
  );
}
