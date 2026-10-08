import { useEffect, useRef, useState, type ReactNode } from "react";
import { normalizeTag } from "../lib/types";
import { prettyMonth } from "../lib/format";

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function AmountField({ value, onChange, autoFocus = true }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) setTimeout(() => ref.current?.focus(), 150);
  }, [autoFocus]);
  return (
    <input
      ref={ref}
      className="amount-input"
      inputMode="decimal"
      placeholder="0"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
      aria-label="Amount"
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)} type="button">
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Progress({ value, tone = "accent" }: { value: number; tone?: "accent" | "good" | "warn" | "bad" }) {
  return (
    <div className="progress">
      <div className={`progress-fill ${tone}`} style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
    </div>
  );
}

export function Empty({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <div className="empty">
      <div className="empty-emoji">{emoji}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

const PATHS: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  list: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
  piggy: "M19 10c0-3.3-3.1-6-7-6-1.2 0-2.3.2-3.3.7L6 3v3.3C4.8 7.3 4 8.6 4 10H2v4h2.4c.6 1.2 1.6 2.2 2.6 2.9V20h3v-2h4v2h3v-3.1c1.8-1.1 3-2.9 3-4.9h1v-2zM15.5 9.5h.01",
  hand: "M16 3h5v5M21 3l-7 7M8 21H3v-5M3 21l7-7",
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6 6 18",
  trash: "M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  check: "M5 12l5 5L20 7",
  up: "M12 19V5M5 12l7-7 7 7",
  down: "M12 5v14M19 12l-7 7-7-7",
  chevron: "M9 6l6 6-6 6",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  upload: "M12 16V5M7 10l5-5 5 5M5 20h14",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  eyeoff: "M3 3l18 18M10.6 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2",
  share: "M12 3v12M8 7l4-4 4 4M5 12v8h14v-8",
  repeat: "M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3",
  left: "M15 6l-6 6 6 6",
  arrow: "M5 12h14M13 6l6 6-6 6",
  tag: "M3 12V3h9l9 9-9 9zM7.5 7.5h.01",
  card: "M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM2 10h20M6 15h4",
  google: "",
};

export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  if (name === "google")
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}

export function TagInput({ value, onChange, suggestions }: { value: string[]; onChange: (v: string[]) => void; suggestions: string[] }) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const t = normalizeTag(raw);
    if (t && !value.includes(t) && value.length < 8) onChange([...value, t]);
    setDraft("");
  };
  const q = normalizeTag(draft);
  const matches = suggestions.filter((s) => !value.includes(s) && (!q || s.includes(q))).slice(0, 6);
  return (
    <div className="tag-input">
      <div className="tag-box">
        {value.map((t) => (
          <button type="button" key={t} className="tag on" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove tag ${t}`}>
            #{t} <span aria-hidden>×</span>
          </button>
        ))}
        <input
          value={draft}
          placeholder={value.length ? "" : "Add tags: trip, office…"}
          onChange={(e) => {
            const v = e.target.value;
            if (/[,\s]$/.test(v)) add(v);
            else setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (draft.trim()) add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => draft.trim() && add(draft)}
          enterKeyHint="done"
          aria-label="Tags"
        />
      </div>
      {matches.length > 0 && (
        <div className="tag-suggest">
          {matches.map((s) => (
            <button type="button" key={s} className="tag" onMouseDown={(e) => e.preventDefault()} onClick={() => add(s)}>
              #{s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function MonthPicker({ value, onChange, max }: { value: string; onChange: (m: string) => void; max: string }) {
  const shift = (d: number) => {
    const [y, m] = value.split("-").map(Number);
    const n = new Date(y, m - 1 + d, 1);
    onChange(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`);
  };
  return (
    <div className="month-picker">
      <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month">
        <Icon name="left" size={18} />
      </button>
      <strong>{prettyMonth(value)}</strong>
      <button className="icon-btn" onClick={() => shift(1)} disabled={value >= max} aria-label="Next month">
        <Icon name="chevron" size={18} />
      </button>
    </div>
  );
}
