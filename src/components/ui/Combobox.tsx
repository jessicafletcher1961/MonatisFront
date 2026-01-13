import * as React from "react";
import { Combobox as HCombobox } from "@headlessui/react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/utils/cn";

export type ComboOption = { value: string; label: string; meta?: string };

type Props = {
  label?: string;
  hint?: string;
  error?: string;
  value: string | null;
  onChange: (v: string) => void;
  options: ComboOption[];
  placeholder?: string;
  disabled?: boolean;
};

export function Combobox({ label, hint, error, value, onChange, options, placeholder, disabled }: Props) {
  const selected = options.find(o => o.value === value) ?? null;
  const [query, setQuery] = React.useState("");

  const filtered = query.trim().length === 0
    ? options
    : options.filter(o =>
        (o.label + " " + o.value + " " + (o.meta ?? ""))
          .toLowerCase()
          .includes(query.toLowerCase())
      );

  return (
    <div className="block">
      {label ? <div className="mb-1 text-xs font-medium text-white/75">{label}</div> : null}
      <HCombobox value={selected} onChange={(v: ComboOption) => onChange(v.value)} disabled={disabled}>
        <div className="relative">
          <div className={cn(
            "flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-[#0f081a] px-3 text-sm outline-none transition focus-within:border-ink-500/40 focus-within:ring-2 focus-within:ring-ink-500/20",
            error && "border-blush-500/40 focus-within:border-blush-500/60 focus-within:ring-blush-500/20",
            disabled && "opacity-60"
          )}>
            <Search className="h-4 w-4 text-white/45" />
            <HCombobox.Input
              className="w-full bg-transparent text-white placeholder:text-white/40 outline-none"
              displayValue={(o: ComboOption) => o?.label ?? ""}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
            />
            <HCombobox.Button className="ml-1 rounded-lg p-1 hover:bg-white/10">
              <ChevronDown className="h-4 w-4 text-white/60" />
            </HCombobox.Button>
          </div>
          <HCombobox.Options className="absolute z-50 mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-white/10 bg-[#12081f]/95 p-1 shadow-[0_20px_60px_rgba(0,0,0,.5)] backdrop-blur">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-white/60">Aucun résultat</div>
            ) : (
              filtered.map(o => (
                <HCombobox.Option
                  key={o.value}
                  value={o}
                  className={({ active }) => cn(
                    "flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm",
                    active ? "bg-white/10" : "bg-transparent"
                  )}
                >
                  {({ selected }) => (
                    <>
                      <div>
                        <div className="text-white">{o.label}</div>
                        {o.meta ? <div className="text-xs text-white/55">{o.meta}</div> : null}
                      </div>
                      {selected ? <Check className="h-4 w-4 text-ink-300" /> : null}
                    </>
                  )}
                </HCombobox.Option>
              ))
            )}
          </HCombobox.Options>
        </div>
      </HCombobox>
      {error ? <div className="mt-1 text-xs text-blush-300">{error}</div> : hint ? <div className="mt-1 text-xs text-white/55">{hint}</div> : null}
    </div>
  );
}
