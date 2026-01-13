import * as React from "react";
import { Combobox as HCombobox } from "@headlessui/react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/utils/cn";

export type MultiOption = { value: string; label: string };

type Props = {
  label?: string;
  hint?: string;
  error?: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: MultiOption[];
  placeholder?: string;
};

export function MultiSelect({ label, hint, error, values, onChange, options, placeholder }: Props) {
  const selected = options.filter(o => values.includes(o.value));
  const [query, setQuery] = React.useState("");

  const filtered = query.trim().length === 0
    ? options
    : options.filter(o => (o.label + " " + o.value).toLowerCase().includes(query.toLowerCase()));

  function remove(v: string) {
    onChange(values.filter(x => x !== v));
  }

  return (
    <div className="block">
      {label ? <div className="mb-1 text-xs font-medium text-white/75">{label}</div> : null}

      <HCombobox value={selected} onChange={(newSelected: MultiOption[]) => onChange(newSelected.map(x => x.value))} multiple>
        <div className="relative">
          <div className={cn(
            "min-h-[44px] rounded-2xl border border-white/10 bg-[#0f081a] px-3 py-2 text-sm outline-none transition focus-within:border-ink-500/40 focus-within:ring-2 focus-within:ring-ink-500/20",
            error && "border-blush-500/40 focus-within:border-blush-500/60 focus-within:ring-blush-500/20"
          )}>
            <div className="mb-2 flex flex-wrap gap-2">
              {selected.map(s => (
                <span key={s.value} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-xs text-white/80">
                  {s.label}
                  <button
                    type="button"
                    onClick={() => remove(s.value)}
                    className="rounded-full p-0.5 hover:bg-white/10"
                    aria-label={`Retirer ${s.label}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {selected.length === 0 ? <span className="text-xs text-white/40">{placeholder ?? "Choisir..."}</span> : null}
            </div>

            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-white/45" />
              <HCombobox.Input
                className="w-full bg-transparent text-white placeholder:text-white/40 outline-none"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher…"
              />
              <HCombobox.Button className="ml-1 rounded-lg p-1 hover:bg-white/10">
                <ChevronDown className="h-4 w-4 text-white/60" />
              </HCombobox.Button>
            </div>
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
                      <div className="text-white">{o.label}</div>
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
