"use client";

import { useLayoutEffect, useState } from "react";
import { PageView } from "@/components/template/PageView";
import type { Pagination } from "@/lib/pagination/usePagination";

const GUTTER = 32;

/** Paginated preview: each computed page at true size, scaled to fit the panel. */
export function Preview({ pagination }: { pagination: Pagination }) {
  const { geo, pages } = pagination;
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const width = useObservedWidth(container);
  const scale = width === null ? 1 : Math.min(1, width / geo.width);

  return (
    <div ref={setContainer} style={{ padding: GUTTER }}>
      {pagination.measureLayer}
      {pages === null ? (
        <p className="py-12 text-center text-sm text-zinc-500">Laying out pages…</p>
      ) : (
        <div className="flex flex-col items-center gap-6">
          {pages.map((page, i) => (
            <figure key={i} aria-label={`Page ${i + 1} of ${pages.length}`}>
              <div className="shadow-md" style={{ width: geo.width * scale, height: geo.height * scale }}>
                <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
                  <PageView blocks={page.blocks} geo={geo} />
                </div>
              </div>
              <figcaption className="mt-2 text-center text-xs text-zinc-500">
                Page {i + 1} of {pages.length}
                {page.overflows && (
                  <span className="ml-2 font-medium text-red-600">⚠ A block is taller than the page and gets cut off</span>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

/** Content-box width of an element (layout size, unaffected by transforms). */
function useObservedWidth(el: HTMLElement | null) {
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return width;
}
