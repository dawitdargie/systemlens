"use client";

interface AudiencePickerProps {
  audiences: string[];
  selected: string | null;
  onSelect: (audience: string) => void;
}

export default function AudiencePicker({
  audiences,
  selected,
  onSelect,
}: AudiencePickerProps) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide">
        Choose Your Perspective
      </label>
      <p className="text-xs text-surface-400 dark:text-surface-500">
        Select how you want to explore this project:
      </p>
      <div className="flex flex-wrap gap-2">
        {audiences.map((audience) => (
          <button
            key={audience}
            onClick={() => onSelect(audience)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
              selected === audience
                ? "bg-accent-500/20 border border-accent-500/50 text-foreground"
                : "bg-[var(--input-bg)] border border-[var(--input-border)] text-foreground hover:border-accent-500/50"
            }`}
          >
            {audience}
          </button>
        ))}
      </div>
    </div>
  );
}