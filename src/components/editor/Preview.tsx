"use client";

import { useLayoutEffect, useMemo, useState } from "react";
import { BlockView, TemplateRoot } from "@/components/template/BlockView";
import { PAGE_GEOMETRY } from "@/lib/page/sizes";
import { toBlocks } from "@/lib/pagination/blocks";
import type { PageSize, ResumeContent } from "@/lib/resume/schema";

const GUTTER = 32;

/**
 * Milestone 1b preview: one continuous sheet at the real page width, scaled
 * to fit. Milestone 1c replaces this with measured, paginated pages.
 */
export function Preview({ content, pageSize }: { content: ResumeContent; pageSize: PageSize }) {
  const geo = PAGE_GEOMETRY[pageSize];
  const blocks = useMemo(() => toBlocks(content), [content]);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [sheet, setSheet] = useState<HTMLDivElement | null>(null);
  const containerWidth = useObservedSize(container)?.width;
  const sheetHeight = useObservedSize(sheet)?.height ?? geo.height;
  const scale = containerWidth === undefined ? 1 : Math.min(1, containerWidth / geo.width);

  return (
    <div ref={setContainer} style={{ padding: GUTTER }}>
      <div style={{ height: sheetHeight * scale, width: geo.width * scale, margin: "0 auto" }}>
        <div
          ref={setSheet}
          className="bg-white shadow-md"
          style={{
            width: geo.width,
            minHeight: geo.height,
            padding: `${geo.margin.top}px ${geo.margin.right}px ${geo.margin.bottom}px ${geo.margin.left}px`,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <TemplateRoot>
            {blocks.map((block) => (
              <BlockView key={block.key} block={block} />
            ))}
          </TemplateRoot>
        </div>
      </div>
    </div>
  );
}

/** Content-box size of an element (layout size, unaffected by transforms). */
function useObservedSize(el: HTMLElement | null) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const box = entry.borderBoxSize?.[0];
      // Border-box for the sheet (includes padding); content-box for containers.
      setSize({
        width: entry.contentRect.width,
        height: box ? box.blockSize : el.offsetHeight,
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return size;
}
