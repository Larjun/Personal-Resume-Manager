"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { BlockView, TemplateRoot } from "@/components/template/BlockView";
import { PAGE_GEOMETRY, type PageGeometry } from "@/lib/page/sizes";
import type { PageSize, ResumeContent } from "@/lib/resume/schema";
import { toBlocks, type Block } from "./blocks";
import { paginate } from "./paginate";

/** Absorbs sub-pixel differences between screen measurement and print layout. */
const SAFETY_PX = 2;

export type PaginatedPage = { blocks: Block[]; overflows: boolean };

export type Pagination = {
  geo: PageGeometry;
  /** null until the first measurement has run (client only). */
  pages: PaginatedPage[] | null;
  /** Render this somewhere in the tree; it portals an invisible measuring copy to <body>. */
  measureLayer: ReactNode;
};

/**
 * Measures every block off-screen at the page's content width and places them
 * onto pages. Recomputes when content changes (debounced), immediately when
 * the page size changes, and whenever web fonts finish loading.
 */
export function usePagination(
  content: ResumeContent,
  pageSize: PageSize,
  { debounceMs = 150 }: { debounceMs?: number } = {},
): Pagination {
  const geo = PAGE_GEOMETRY[pageSize];
  const debounced = useDebouncedValue(content, debounceMs);
  const blocks = useMemo(() => toBlocks(debounced), [debounced]);
  const fontsVersion = useFontsVersion();

  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  const [pages, setPages] = useState<PaginatedPage[] | null>(null);
  const mounted = useIsClient();

  useLayoutEffect(() => {
    // The layer is display:none while printing (print CSS); measuring then
    // would read 0px for every block. Keep the last good layout instead.
    if (!layer || layer.getClientRects().length === 0) return;
    const byKey = new Map(blocks.map((b) => [b.key, b]));
    const measured = [...layer.children].map((el, i) => ({
      key: blocks[i].key,
      height: el.getBoundingClientRect().height,
      keepWithNext: blocks[i].keepWithNext,
    }));
    const layout = paginate(measured, geo.contentHeight - SAFETY_PX);
    // Measuring the DOM and storing the result is what layout effects are for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPages(layout.map((p) => ({ blocks: p.keys.map((k) => byKey.get(k)!), overflows: p.overflows })));
  }, [layer, blocks, geo, fontsVersion]);

  const measureLayer =
    mounted &&
    createPortal(
      <div
        aria-hidden
        data-measure-layer
        style={{
          position: "absolute",
          top: 0,
          left: -100000,
          width: geo.contentWidth,
          visibility: "hidden",
          pointerEvents: "none",
        }}
      >
        <TemplateRoot>
          <div ref={setLayer}>
            {blocks.map((block) => (
              <div key={block.key}>
                <BlockView block={block} />
              </div>
            ))}
          </div>
        </TemplateRoot>
      </div>,
      document.body,
    );

  return { geo, pages, measureLayer };
}

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    if (ms <= 0) return;
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return ms <= 0 ? value : debounced;
}

const noopSubscribe = () => () => {};
/** false during SSR and hydration, true afterwards (portals need document). */
const useIsClient = () => useSyncExternalStore(noopSubscribe, () => true, () => false);

/** Bumps whenever web fonts finish loading, so layout can be re-measured. */
function useFontsVersion(): number {
  const [version, setVersion] = useState(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const bump = () => alive.current && setVersion((v) => v + 1);
    document.fonts.ready.then(bump);
    document.fonts.addEventListener("loadingdone", bump);
    return () => {
      alive.current = false;
      document.fonts.removeEventListener("loadingdone", bump);
    };
  }, []);
  return version;
}
