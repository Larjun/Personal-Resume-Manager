"use client";

import { useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500";

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

type TextInputProps = Omit<ComponentProps<"input">, "onChange" | "value"> & {
  value: string;
  onChange: (value: string) => void;
};

export function TextInput({ value, onChange, className = "", ...rest }: TextInputProps) {
  return <input {...rest} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} ${className}`} />;
}

type TextAreaProps = Omit<ComponentProps<"textarea">, "onChange" | "value"> & {
  value: string;
  onChange: (value: string) => void;
};

/** Textarea that grows with its content. */
export function TextArea({ value, onChange, className = "", rows = 1, ...rest }: TextAreaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <textarea
      {...rest}
      ref={ref}
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputClass} resize-none overflow-hidden leading-snug ${className}`}
    />
  );
}

const parseList = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

/**
 * Comma-separated list input. Keeps its own draft string so typing
 * "React, " doesn't lose the trailing separator; stores string[].
 */
export function ListInput({
  value,
  onChange,
  ...rest
}: Omit<TextInputProps, "value" | "onChange"> & { value: string[]; onChange: (value: string[]) => void }) {
  const [draft, setDraft] = useState(() => value.join(", "));
  const [synced, setSynced] = useState(value);
  // Adopt external changes (e.g. undo, reload) without clobbering in-progress typing.
  if (synced !== value) {
    setSynced(value);
    if (parseList(draft).join("\u0000") !== value.join("\u0000")) setDraft(value.join(", "));
  }
  return (
    <TextInput
      {...rest}
      value={draft}
      onChange={(next) => {
        setDraft(next);
        onChange(parseList(next));
      }}
    />
  );
}

export function IconButton({
  label,
  onClick,
  children,
  tone = "default",
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 ${
        tone === "danger" ? "hover:text-red-600" : "hover:text-zinc-700"
      }`}
    >
      {children}
    </button>
  );
}

export function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
    >
      + {children}
    </button>
  );
}

export const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
    <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    aria-hidden
    style={{ transform: open ? "rotate(90deg)" : undefined, transition: "transform 120ms" }}
  >
    <path d="M6 3.5 10.5 8 6 12.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
