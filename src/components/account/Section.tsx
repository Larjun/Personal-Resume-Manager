import type { ReactNode } from "react";

export function Section({
  title,
  description,
  tone = "default",
  children,
}: {
  title: string;
  description?: ReactNode;
  tone?: "default" | "danger";
  children: ReactNode;
}) {
  return (
    <section
      className={`rounded-lg border bg-white p-6 ${tone === "danger" ? "border-red-200" : "border-zinc-200"}`}
    >
      <h2 className={`text-base font-semibold ${tone === "danger" ? "text-red-700" : "text-zinc-900"}`}>{title}</h2>
      {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
