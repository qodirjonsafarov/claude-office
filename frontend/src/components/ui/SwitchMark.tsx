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
    <span className="ml-auto flex items-center gap-2.5 flex-shrink-0">
      <span
        className={`text-[12.5px] font-extrabold ${on ? "text-accent" : "text-ink-faint"}`}
      >
        {on ? onLabel : offLabel}
      </span>
      <span aria-hidden="true" className="qo-switch" data-on={on} />
    </span>
  );
}
