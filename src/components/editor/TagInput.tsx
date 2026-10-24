"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { normalizeTag, resolveTag } from "@/lib/tags";

const MAX_SUGGESTIONS = 8;

/**
 * Tags as removable chips, with autocomplete from the user's existing tags.
 * Enter, Tab or a comma adds the typed tag; it's normalized first (aliases
 * like ts → TypeScript, and an existing tag's spelling when one matches).
 * Backspace in an empty field removes the last tag.
 */
export function TagInput({
  value,
  onChange,
  suggestions,
  placeholder = "Add a tag…",
  size = "md",
  "aria-label": ariaLabel,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  /** Existing tags to offer, most used first. */
  suggestions: readonly string[];
  placeholder?: string;
  size?: "sm" | "md";
  "aria-label": string;
}) {
  const listId = useId();
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const has = (tag: string) => value.some((t) => t.toLowerCase() === tag.toLowerCase());
  const query = draft.trim().toLowerCase();
  const aliased = normalizeTag(draft);
  const matches = query
    ? suggestions.filter((s) => !has(s) && s.toLowerCase().includes(query))
    : suggestions.filter((s) => !has(s));
  // Show what an alias resolves to first ("ts" → TypeScript) even if it's a new tag.
  const options = (
    query && aliased.toLowerCase() !== query && !has(aliased) ? [aliased, ...matches.filter((m) => m !== aliased)] : matches
  ).slice(0, MAX_SUGGESTIONS);

  const add = (raw: string) => {
    const tag = resolveTag(raw, suggestions);
    setDraft("");
    setActive(0);
    if (tag && !has(tag)) onChange([...value, tag]);
  };
  const remove = (tag: string) => onChange(value.filter((t) => t !== tag));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const showing = open && options.length > 0;
    if (e.key === "ArrowDown" && showing) {
      e.preventDefault();
      setActive((a) => (a + 1) % options.length);
    } else if (e.key === "ArrowUp" && showing) {
      e.preventDefault();
      setActive((a) => (a - 1 + options.length) % options.length);
    } else if (e.key === "Enter" || e.key === "," || (e.key === "Tab" && draft.trim())) {
      if (!draft.trim() && !(showing && e.key === "Enter")) return;
      e.preventDefault();
      // Enter takes the highlighted suggestion; a comma always takes what was typed.
      add(showing && e.key !== "," && query ? options[active] : draft);
    } else if (e.key === "Backspace" && !draft && value.length > 0) {
      remove(value[value.length - 1]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const sm = size === "sm";
  return (
    <div className="relative min-w-0 flex-1">
      <div
        className={`flex flex-wrap items-center gap-1 rounded-md border border-zinc-300 bg-white focus-within:border-zinc-500 focus-within:ring-1 focus-within:ring-zinc-500 ${
          sm ? "px-1 py-0.5" : "px-1.5 py-1"
        }`}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className={`flex items-center gap-0.5 rounded-full bg-zinc-100 text-zinc-700 ${sm ? "py-0 pl-1.5 pr-0.5 text-[11px]" : "py-0.5 pl-2 pr-1 text-xs"}`}
          >
            {tag}
            <button
              type="button"
              onClick={() => remove(tag)}
              aria-label={`Remove tag ${tag}`}
              className="rounded-full px-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
            >
              ×
            </button>
          </span>
        ))}
        <input
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open && options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options.length > 0 ? `${listId}-${active}` : undefined}
          value={draft}
          placeholder={value.length === 0 ? placeholder : ""}
          onChange={(e) => {
            setDraft(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            if (draft.trim()) add(draft);
          }}
          onKeyDown={onKeyDown}
          className={`min-w-24 flex-1 bg-transparent outline-none placeholder:text-zinc-400 ${sm ? "py-0.5 text-xs" : "py-0.5 text-sm"}`}
        />
      </div>
      {open && options.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 z-30 mt-1 max-h-56 w-full min-w-48 overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg"
        >
          {options.map((option, i) => (
            <li
              key={option}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown, not click: it must win over the input's blur.
              onMouseDown={(e) => {
                e.preventDefault();
                add(option);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-2.5 py-1 text-sm ${i === active ? "bg-zinc-100" : ""}`}
            >
              {option}
              {!suggestions.includes(option) && <span className="ml-1.5 text-xs text-zinc-400">new</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
