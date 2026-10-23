export type MeasuredBlock = { key: string; height: number; keepWithNext: boolean };

export type PageLayout = {
  keys: string[];
  /** Sum of block heights placed on this page. */
  height: number;
  /** True when a single block is taller than the page and will be clipped. */
  overflows: boolean;
};

/**
 * Places measured blocks onto pages in order. Blocks are never split.
 *
 * Blocks joined by `keepWithNext` form a chain (heading → entry header →
 * first bullet) that moves to the next page as a unit when it doesn't fit.
 * A chain taller than a whole page is placed block by block instead, so
 * pagination always terminates.
 */
export function paginate(blocks: MeasuredBlock[], pageHeight: number): PageLayout[] {
  const pages: PageLayout[] = [];
  let page: PageLayout = { keys: [], height: 0, overflows: false };

  const newPage = () => {
    pages.push(page);
    page = { keys: [], height: 0, overflows: false };
  };
  const place = (b: MeasuredBlock) => {
    page.keys.push(b.key);
    page.height += b.height;
    if (page.height > pageHeight) page.overflows = true;
  };

  let i = 0;
  while (i < blocks.length) {
    // Chain: this block plus every following block it's glued to.
    let j = i;
    while (j < blocks.length - 1 && blocks[j].keepWithNext) j++;
    const chain = blocks.slice(i, j + 1);
    const chainHeight = chain.reduce((sum, b) => sum + b.height, 0);

    if (page.height + chainHeight <= pageHeight) {
      chain.forEach(place);
    } else if (chainHeight <= pageHeight) {
      newPage();
      chain.forEach(place);
    } else {
      // Pathological: the chain alone exceeds a page. Fill greedily.
      for (const b of chain) {
        if (page.keys.length > 0 && page.height + b.height > pageHeight) newPage();
        place(b);
      }
    }
    i = j + 1;
  }

  pages.push(page);
  return pages;
}
