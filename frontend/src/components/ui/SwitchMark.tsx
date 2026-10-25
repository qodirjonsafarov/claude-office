"use client";

/**
 * The look of an on/off switch (a track and a knob) with its state in words,
 * for a menu row that toggles something. The row itself is the button.
 */
export function SwitchMark({
  on,
  onLabel,
  offLabel,
}: {
  on: boolean;
  onLabel: string;
  offLabel: string;
}): React.ReactNode {
  return (
    <span className="ml-auto flex items-center gap-2 flex-shrink-0">
      <span
        className={`text-[12px] font-extrabold ${on ? "text-accent" : "text-ink-faint"}`}
      >
        {on ? onLabel : offLabel}
      </span>
      <span
        aria-hidden="true"
        className={`relative w-9 h-5 rounded-full transition-colors ${
          on ? "bg-accent" : "bg-panel-3 border border-line-strong"
        }`}
      >
        <span
          className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full transition-[left] ${
            on ? "left-[18px] bg-on-accent" : "left-[3px] bg-ink-faint"
          }`}
        />
      </span>
    </span>
  );
}
