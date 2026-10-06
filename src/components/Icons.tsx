import type { ReactNode } from "react";

/**
 * The app's small icon set, as inline SVG.
 *
 * Inline rather than an icon library or image files: a handful of glyphs does not justify a
 * dependency, and the production CSP (img-src 'self') forbids data: URIs anyway. Every icon
 * is decorative — aria-hidden, never focusable — and always sits beside text that carries
 * the meaning, so nothing is conveyed by an icon alone.
 */

interface IconProps {
  size?: number;
  className?: string;
}

function Svg({ size = 20, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconCheck = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4.5 10.5l3.5 3.5 7.5-8" />
  </Svg>
);

export const IconX = (props: IconProps) => (
  <Svg {...props}>
    <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
  </Svg>
);

export const IconMinus = (props: IconProps) => (
  <Svg {...props}>
    <path d="M5 10h10" />
  </Svg>
);

export const IconArrowLeft = (props: IconProps) => (
  <Svg {...props}>
    <path d="M16 10H4.5M9 5l-5 5 5 5" />
  </Svg>
);

export const IconArrowRight = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 10h11.5M11 5l5 5-5 5" />
  </Svg>
);

export const IconUpload = (props: IconProps) => (
  <Svg {...props}>
    <path d="M10 12.5V3.5M6 7.5l4-4 4 4" />
    <path d="M3.5 12.5v2.25c0 .97.78 1.75 1.75 1.75h9.5c.97 0 1.75-.78 1.75-1.75V12.5" />
  </Svg>
);

export const IconFile = (props: IconProps) => (
  <Svg {...props}>
    <path d="M11.5 2.75H6A1.75 1.75 0 0 0 4.25 4.5v11A1.75 1.75 0 0 0 6 17.25h8a1.75 1.75 0 0 0 1.75-1.75V7l-4.25-4.25z" />
    <path d="M11.5 2.75V7h4.25" />
  </Svg>
);

export const IconDownload = (props: IconProps) => (
  <Svg {...props}>
    <path d="M10 3v9.5M6 8.5l4 4 4-4" />
    <path d="M4 16.5h12" />
  </Svg>
);

export const IconLock = (props: IconProps) => (
  <Svg {...props}>
    <rect x="4.25" y="8.75" width="11.5" height="8.5" rx="1.75" />
    <path d="M6.75 8.75V6.5a3.25 3.25 0 0 1 6.5 0v2.25" />
  </Svg>
);

export const IconAlert = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="10" cy="10" r="7.25" />
    <path d="M10 6.25v4.5M10 13.5v.01" />
  </Svg>
);

export const IconRefresh = (props: IconProps) => (
  <Svg {...props}>
    <path d="M15.5 8A6 6 0 0 0 4.7 6.2M4.5 12a6 6 0 0 0 10.8 1.8" />
    <path d="M15.75 3.75V8H11.5M4.25 16.25V12H8.5" />
  </Svg>
);

export const IconSun = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="10" cy="10" r="3.25" />
    <path d="M10 2.5v1.5M10 16v1.5M2.5 10H4M16 10h1.5M4.7 4.7l1.06 1.06M14.24 14.24l1.06 1.06M4.7 15.3l1.06-1.06M14.24 5.76l1.06-1.06" />
  </Svg>
);

export const IconMoon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M15.75 12.3A6.25 6.25 0 0 1 7.7 4.25a6.25 6.25 0 1 0 8.05 8.05z" />
  </Svg>
);

export const IconMonitor = (props: IconProps) => (
  <Svg {...props}>
    <rect x="2.75" y="3.75" width="14.5" height="10" rx="1.5" />
    <path d="M7 16.75h6M10 13.75v3" />
  </Svg>
);

export const IconShuffle = (props: IconProps) => (
  <Svg {...props}>
    <path d="M3 5.5h2.4c1.4 0 2.4.6 3.2 1.8l2.8 4.4c.8 1.2 1.8 1.8 3.2 1.8H17" />
    <path d="M3 14.5h2.4c1.4 0 2.4-.6 3.2-1.8M11.4 7.3c.8-1.2 1.8-1.8 3.2-1.8H17" />
    <path d="M15 3.5l2 2-2 2M15 11.5l2 2-2 2" />
  </Svg>
);

export const IconTrophy = (props: IconProps) => (
  <Svg {...props}>
    <path d="M6 3.25h8v4.5a4 4 0 0 1-8 0z" />
    <path d="M6 4.75H3.9a.4.4 0 0 0-.4.4c0 2.1 1.3 3.5 3 3.75M14 4.75h2.1a.4.4 0 0 1 .4.4c0 2.1-1.3 3.5-3 3.75" />
    <path d="M10 11.75v2.5M7.25 16.75h5.5M8.5 14.25h3" />
  </Svg>
);

export const IconPencil = (props: IconProps) => (
  <Svg {...props}>
    <path d="M13.2 3.6l3.2 3.2L7.2 16H4v-3.2z" />
    <path d="M11.4 5.4l3.2 3.2" />
  </Svg>
);

export const IconPlay = (props: IconProps) => (
  <Svg {...props}>
    <path d="M6.75 4.25v11.5l9-5.75z" />
  </Svg>
);

export const IconBook = (props: IconProps) => (
  <Svg {...props}>
    <path d="M3.25 4.25h5.25a1.5 1.5 0 0 1 1.5 1.5v10.5a1.25 1.25 0 0 0-1.25-1.25h-5.5z" />
    <path d="M16.75 4.25H11.5a1.5 1.5 0 0 0-1.5 1.5v10.5a1.25 1.25 0 0 1 1.25-1.25h5.5z" />
  </Svg>
);

/** The Quiz on Demand mark: a "Q" on a deep green tile, with a gold spark. */
export function LogoMark() {
  return (
    <svg className="logo-mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect className="logo-mark__tile" width="32" height="32" rx="8" />
      <circle className="logo-mark__glyph" cx="15" cy="15" r="6.75" fill="none" strokeWidth="3" />
      <path
        className="logo-mark__glyph"
        d="M18.6 18.6 23.5 23.5"
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle className="logo-mark__dot" cx="24.5" cy="8.5" r="2.25" />
    </svg>
  );
}
