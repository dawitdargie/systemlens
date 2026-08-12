"use client";

interface AudiencePickerProps {
  audiences: string[];
  selected: string | null;
  onSelect: (audience: string) => void;
}

interface AudienceAccent {
  dot: string;
  text: string;
  border: string;
  glow: string;
}

const AUDIENCE_ACCENTS: Record<string, AudienceAccent> = {
  CEO: {
    dot: "bg-purple-500",
    text: "text-purple-400",
    border: "border-purple-500/50",
    glow: "0 4px 20px rgba(168, 85, 247, 0.25)",
  },
  PM: {
    dot: "bg-blue-500",
    text: "text-blue-400",
    border: "border-blue-500/50",
    glow: "0 4px 20px rgba(59, 130, 246, 0.25)",
  },
  Developer: {
    dot: "bg-accent-500",
    text: "text-accent-400",
    border: "border-accent-500/50",
    glow: "0 4px 20px rgba(0, 212, 255, 0.25)",
  },
  QA: {
    dot: "bg-yellow-500",
    text: "text-yellow-400",
    border: "border-yellow-500/50",
    glow: "0 4px 20px rgba(234, 179, 8, 0.25)",
  },
  Customer: {
    dot: "bg-green-500",
    text: "text-green-400",
    border: "border-green-500/50",
    glow: "0 4px 20px rgba(34, 197, 94, 0.25)",
  },
};

export default function AudiencePicker({
  audiences,
  selected,
  onSelect,
}: AudiencePickerProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-500" />
        <label className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide">
          Choose Your Perspective
        </label>
      </div>
      <p className="text-xs text-surface-400 dark:text-surface-500">
        Select how you want to explore this project:
      </p>
      <div className="flex flex-wrap gap-2.5">
        {audiences.map((audience) => {
          const accent = AUDIENCE_ACCENTS[audience] || AUDIENCE_ACCENTS.Developer;
          const isActive = selected === audience;
          return (
            <button
              key={audience}
              onClick={() => onSelect(audience)}
              className={`audience-chip px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                isActive
                  ? `${accent.border} text-foreground`
                  : "bg-[var(--input-bg)] border border-[var(--input-border)] text-foreground hover:border-accent-500/50"
              }`}
              style={isActive ? { boxShadow: accent.glow, backgroundColor: "rgba(0,0,0,0.03)" } : undefined}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${accent.dot} ${isActive ? "" : "opacity-60"}`} />
              {audience}
            </button>
          );
        })}
      </div>
    </div>
  );
}
