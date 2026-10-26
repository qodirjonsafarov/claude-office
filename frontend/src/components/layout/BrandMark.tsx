"use client";

import { useId } from "react";

/** The mark's drawing on a 256 grid, shared with public/icon.svg (the favicon). */
const MARK = {
  /** The two rising rocks of the Olymp mark, behind the desk. */
  hills: "-24,200 60,92 136,144 196,52 280,200 256,256 0,256",
};

/**
 * The office mark, drawn like the Olymp Fit mark: a dark rounded square
 * (rx 61/256), the two dim lime rocks of Olymp, and in front of them a lime
 * monitor with a prompt on a desk; a thin lime edge so the dark square does not
 * melt into the dark page. Colours come from the --qo-logo-* tokens.
 */
export function OfficeMark({ size = 40 }: { size?: number }): React.ReactNode {
  const clip = useId();
  return (
    <svg
      viewBox="0 0 256 256"
      width={size}
      height={size}
      aria-hidden="true"
      className="flex-shrink-0"
    >
      <clipPath id={clip}>
        <rect width="256" height="256" rx="61" />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <rect width="256" height="256" fill="var(--qo-logo-bg)" />
        <polygon points={MARK.hills} fill="var(--qo-logo-hill)" />
        <rect
          x="52"
          y="54"
          width="152"
          height="108"
          rx="20"
          fill="var(--qo-logo-figure)"
        />
        <rect
          x="68"
          y="70"
          width="120"
          height="76"
          rx="9"
          fill="var(--qo-logo-bg)"
        />
        <path
          d="M90 92l22 16-22 16"
          fill="none"
          stroke="var(--qo-logo-figure)"
          strokeWidth="13"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="122"
          y="116"
          width="34"
          height="12"
          rx="6"
          fill="var(--qo-logo-figure)"
        />
        <rect
          x="116"
          y="160"
          width="24"
          height="34"
          fill="var(--qo-logo-figure)"
        />
        <rect
          x="36"
          y="190"
          width="184"
          height="20"
          rx="10"
          fill="var(--qo-logo-figure)"
        />
      </g>
      <rect
        x="1.5"
        y="1.5"
        width="253"
        height="253"
        rx="59.5"
        fill="none"
        stroke="var(--qo-logo-ring)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** The mark and the name of the office: the name in extrabold beside the mark. */
export function BrandMark({
  size = 40,
  title,
  subtitle,
}: {
  size?: number;
  /** The name next to the mark; omitted, only the mark is drawn. */
  title?: string;
  subtitle?: string;
}): React.ReactNode {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <OfficeMark size={size} />
      {title && (
        <div className="flex flex-col leading-tight min-w-0">
          <span className="text-ink font-extrabold tracking-tight truncate text-[16.5px] lg:text-[17.5px]">
            {title}
          </span>
          {subtitle && (
            <span className="mt-0.5 text-ink-faint text-[12.5px] font-bold truncate">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
