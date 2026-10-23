import type { ReactNode } from "react";
import type { Block } from "@/lib/pagination/blocks";
import s from "./template.module.css";

/**
 * Renders one resume block. Pure and deterministic: the measure layer,
 * the preview pages and the print view all render through this.
 */
export function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case "header": {
      const { name, email, location, phone, links } = block.header;
      const visible: { id: string; text: string; url?: string }[] = [
        { id: "email", text: email.trim() },
        { id: "location", text: location.trim() },
        { id: "phone", text: phone.trim() },
        ...links.map((l) => ({ id: l.id, text: l.text.trim() || displayUrl(l.url), url: l.url.trim() })),
      ].filter((c) => c.text);
      return (
        <div>
          <div className={s.name}>{name || <span className={s.placeholder}>Your Name</span>}</div>
          {visible.length > 0 && (
            <div className={s.contacts}>
              {visible.map((c, i) => (
                <span key={c.id}>
                  {i > 0 && <span className={s.contactSep}>•</span>}
                  {c.url ? (
                    <a className={s.link} href={c.url}>
                      {c.text}
                    </a>
                  ) : (
                    c.text
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      );
    }

    case "heading":
      return (
        <div className={s.heading}>
          <div className={s.headingText}>{block.text}</div>
        </div>
      );

    case "summary":
      return <p className={s.summary}>{block.text}</p>;

    case "entryHeader": {
      const { title, org, location } = block.entry;
      return (
        <div className={`${s.entryHeader} ${s.row}`}>
          <div className={s.rowLeft}>{joinBar(title, org)}</div>
          <div className={s.rowRight}>{joinBar(location, block.dateText)}</div>
        </div>
      );
    }

    case "paper": {
      const { title, url, authors, venue } = block.paper;
      const citation = [authors.trim(), venue.trim()].filter(Boolean);
      return (
        <div className={s.paper}>
          <div className={`${s.paperTitle} ${s.row}`}>
            <div className={s.rowLeft}>{url ? <a href={url}>{title}</a> : title}</div>
            <div className={s.rowRight}>{block.dateText}</div>
          </div>
          {citation.length > 0 && (
            <div className={s.citation}>
              {authors.trim() && `${trimPeriod(authors)}.`}
              {citation.length === 2 && " "}
              {venue.trim() && <span className={s.venue}>{trimPeriod(venue)}.</span>}
            </div>
          )}
        </div>
      );
    }

    case "bullet":
      return (
        <div className={s.bullet}>
          <span className={s.bulletGlyph} aria-hidden>
            ●
          </span>
          <span className={s.bulletText}>{block.bullet.text}</span>
        </div>
      );

    case "school": {
      const { school, location } = block.school;
      return (
        <div className={s.school}>
          {school}
          {location && (
            <>
              {" | "}
              <span className={s.schoolLocation}>{location}</span>
            </>
          )}
        </div>
      );
    }

    case "degree": {
      const { name } = block.degree;
      return (
        <div className={`${s.degree} ${s.row}`}>
          <div className={`${s.rowLeft} ${s.degreeName}`}>
            <span aria-hidden>➔</span>
            <span>{name}</span>
          </div>
          <div className={`${s.rowRight} ${s.degreeDates}`}>{block.dateText}</div>
        </div>
      );
    }

    case "skillRow": {
      const { category, items } = block.row;
      return (
        <div className={s.skillRow}>
          {category && `${category}: `}
          {items.join(", ")}
        </div>
      );
    }
  }
}

/** Root wrapper that applies base template typography. */
export function TemplateRoot({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${s.root} ${className}`}>{children}</div>;
}

/** "https://www.example.com/x/" → "example.com/x/" */
const displayUrl = (url: string) => url.trim().replace(/^[a-z]+:\/\//i, "").replace(/^www\./, "");

const trimPeriod = (s: string) => s.trim().replace(/\.+$/, "");

/** "A | B" with a regular-weight bar, omitting empty parts. */
function joinBar(a: string, b: string): ReactNode {
  if (a && b) {
    return (
      <>
        {a} <span className={s.bar}>|</span> {b}
      </>
    );
  }
  return a || b;
}
