"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useId, type ReactNode } from "react";

/** Props to spread onto an item's drag handle (dnd-kit attributes + listeners + activator ref). */
export type DragHandleProps = Record<string, unknown> & { ref: (el: HTMLElement | null) => void };

type Props<T extends { id: string }> = {
  items: T[];
  onMove: (from: number, to: number) => void;
  renderItem: (item: T, index: number, handle: DragHandleProps) => ReactNode;
  className?: string;
};

/** Vertical drag-to-reorder list. Each item renders its own drag handle via `handle`. */
export function SortableList<T extends { id: string }>({ items, onMove, renderItem, className }: Props<T>) {
  const id = useId(); // stable id avoids SSR/client aria-describedby mismatch
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from >= 0 && to >= 0) onMove(from, to);
  };

  return (
    <DndContext id={id} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item, index) => (
            <SortableItem key={item.id} id={item.id}>
              {(handle) => renderItem(item, index, handle)}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableItem({ id, children }: { id: string; children: (handle: DragHandleProps) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        position: "relative",
        zIndex: isDragging ? 10 : undefined,
        opacity: isDragging ? 0.85 : undefined,
      }}
    >
      {children({ ...attributes, ...listeners, ref: setActivatorNodeRef })}
    </div>
  );
}

export function DragHandle({ handle, label = "Drag to reorder" }: { handle: DragHandleProps; label?: string }) {
  return (
    <button
      type="button"
      {...handle}
      aria-label={label}
      title={label}
      className="flex h-7 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 active:cursor-grabbing"
    >
      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden>
        {[2, 8, 14].map((y) => (
          <g key={y}>
            <circle cx="2.5" cy={y} r="1.5" />
            <circle cx="7.5" cy={y} r="1.5" />
          </g>
        ))}
      </svg>
    </button>
  );
}

/** Move an item within an array in place (works on immer drafts). */
export function moveItem<T>(arr: T[], from: number, to: number) {
  const [item] = arr.splice(from, 1);
  arr.splice(to, 0, item);
}
