import * as React from "react";
import { Input } from "./Input";
import { eurosToCents, formatEuro } from "@/utils/money";

type Props = {
  label?: string;
  valueCents: number;
  onChangeCents: (c: number) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
};

export function MoneyInput({ label, valueCents, onChangeCents, error, hint, placeholder }: Props) {
  const [raw, setRaw] = React.useState<string>(() => (valueCents ? (valueCents / 100).toFixed(2) : ""));

  React.useEffect(() => {
    const v = valueCents ? (valueCents / 100).toFixed(2) : "";
    // avoid cursor jump during typing: only sync when user isn't editing wildly
    // heuristic: if raw parses to same cents, keep.
    if (eurosToCents(raw) !== valueCents) setRaw(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueCents]);

  return (
    <Input
      label={label}
      value={raw}
      placeholder={placeholder ?? "0,00"}
      error={error}
      hint={hint}
      inputMode="decimal"
      onChange={(e) => {
        const v = formatEuro(e.target.value);
        setRaw(v);
        onChangeCents(eurosToCents(v));
      }}
      right={<span className="text-xs text-white/60">€</span>}
    />
  );
}
