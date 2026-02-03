import type { ReactNode } from "react";

type SectionTab = {
  id: string;
  label: string;
  content: ReactNode;
};

type SectionTabsProps = {
  tabs: SectionTab[];
  activeId: string;
  onChange: (id: string) => void;
};

export function SectionTabs({ tabs, activeId, onChange }: SectionTabsProps) {
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="hidden flex-wrap gap-2 sm:flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`nav-pill ${tab.id === active.id ? "nav-pill-active" : "nav-pill-inactive"}`}
              onClick={() => onChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <select
          className="input-glam sm:hidden"
          value={active.id}
          onChange={(event) => onChange(event.target.value)}
        >
          {tabs.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.label}
            </option>
          ))}
        </select>
      </div>
      <div>{active.content}</div>
    </div>
  );
}
