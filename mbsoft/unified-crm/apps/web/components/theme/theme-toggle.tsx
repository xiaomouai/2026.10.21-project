"use client";

import { Sun, FileText, Moon } from "lucide-react";
import { cn } from "../../lib/cn";
import { useTheme, type Theme } from "./theme-provider";

const OPTIONS: { key: Theme; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "light", label: "白色", icon: Sun },
  { key: "parchment", label: "羊皮纸", icon: FileText },
  { key: "dark", label: "深色", icon: Moon },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className="flex items-center gap-0.5 rounded-lg border border-border bg-surface-2 p-0.5"
      title="切换背景主题"
      role="group"
      aria-label="背景主题"
    >
      {OPTIONS.map((o) => {
        const Icon = o.icon;
        const active = theme === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => setTheme(o.key)}
            title={o.label}
            aria-pressed={active}
            className={cn(
              "flex size-7 items-center justify-center rounded-md transition-colors",
              active
                ? "bg-surface text-fg shadow-sm ring-1 ring-border"
                : "text-fg-subtle hover:text-fg"
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
