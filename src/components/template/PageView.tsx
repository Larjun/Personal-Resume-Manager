import type { PageGeometry } from "@/lib/page/sizes";
import type { Block } from "@/lib/pagination/blocks";
import { BlockView, TemplateRoot } from "./BlockView";

/** One fixed-size resume page. Shared by the editor preview and the print view. */
export function PageView({ blocks, geo, className = "" }: { blocks: Block[]; geo: PageGeometry; className?: string }) {
  return (
    <div
      className={className}
      style={{
        width: geo.width,
        height: geo.height,
        padding: `${geo.margin.top}px ${geo.margin.right}px ${geo.margin.bottom}px ${geo.margin.left}px`,
        overflow: "hidden",
        background: "#fff",
        boxSizing: "border-box",
      }}
    >
      <TemplateRoot>
        {blocks.map((block) => (
          <BlockView key={block.key} block={block} />
        ))}
      </TemplateRoot>
    </div>
  );
}
