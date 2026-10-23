"use client";

import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { PageView } from "@/components/template/PageView";
import { usePagination } from "@/lib/pagination/usePagination";
import type { PageSize, ResumeContent } from "@/lib/resume/schema";

/**
 * Print view: the same computed pages as the editor preview, as fixed-size
 * divs, one per printed sheet. With `?autoprint=1` it opens the print dialog
 * once fonts are loaded and pages are laid out.
 */
export function PrintView({
  id,
  title,
  pageSize,
  content,
}: {
  id: string;
  title: string;
  pageSize: PageSize;
  content: ResumeContent;
}) {
  const { geo, pages, measureLayer } = usePagination(content, pageSize, { debounceMs: 0 });
  const printed = useRef(false);

  // Chrome uses the document title as the default PDF file name.
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => void (document.title = previous);
  }, [title]);

  useEffect(() => {
    if (!pages || printed.current) return;
    if (!new URLSearchParams(window.location.search).has("autoprint")) return;
    printed.current = true;
    // Pages are measured with loaded fonts; give the browser a frame to paint them.
    document.fonts.ready.then(() => requestAnimationFrame(() => window.print()));
  }, [pages]);

  const inexactBrowser = useInexactPrintBrowser();

  // Pages are sized only by their content in print (no fixed height, no bottom
  // padding): content never exceeds the page minus its bottom margin, so a
  // browser that ignores `@page { margin: 0 }` and adds its own margins still
  // fits each page on one sheet instead of spilling a blank one.
  const css = `
    @page { size: ${geo.cssSize}; margin: 0; }
    @media print {
      html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
      body { display: block !important; min-height: 0 !important; }
      .print-toolbar, [data-measure-layer], nextjs-portal { display: none !important; }
      .print-pages { display: block !important; gap: 0 !important; padding: 0 !important; background: none !important; }
      .print-page {
        height: auto !important;
        padding-bottom: 0 !important;
        box-shadow: none !important;
        break-after: page;
        break-inside: avoid;
      }
      .print-page:last-child { break-after: auto; }
      .print-page, .print-page * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }`;

  return (
    <>
      <style>{css}</style>
      {measureLayer}
      <div className="print-toolbar sticky top-0 z-10 flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-2 text-sm">
        <Link href={`/resumes/${id}`} className="text-zinc-500 hover:text-zinc-900">
          ← Back to editor
        </Link>
        <span className="font-semibold">{title}</span>
        <span className="text-xs text-zinc-500">
          {pageSize} · {pages ? `${pages.length} ${pages.length === 1 ? "page" : "pages"}` : "laying out…"}
        </span>
        {inexactBrowser ? (
          <span className="ml-auto text-xs font-medium text-amber-700">
            This browser may ignore the page size and margins. For a PDF that matches the preview exactly, use Chrome or Edge.
          </span>
        ) : (
          <span className="ml-auto hidden text-xs text-zinc-500 md:inline">
            In the dialog choose “Save as PDF”. Keep scale at 100%.
          </span>
        )}
        <button
          onClick={() => window.print()}
          disabled={!pages}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
        >
          Print / Save as PDF
        </button>
      </div>
      <main className="print-pages flex flex-col items-center gap-6 bg-zinc-200/70 py-8" data-ready={pages ? "" : undefined}>
        {pages?.map((page, i) => (
          <PageView key={i} blocks={page.blocks} geo={geo} className="print-page shadow-md" />
        ))}
      </main>
    </>
  );
}

const noopSubscribe = () => () => {};
/** Safari and Firefox don't reliably honour `@page { size; margin }`; Chromium does. */
function useInexactPrintBrowser() {
  return useSyncExternalStore(
    noopSubscribe,
    () => !/Chrome|Chromium|Edg\//.test(navigator.userAgent) || /Firefox/.test(navigator.userAgent),
    () => false,
  );
}
