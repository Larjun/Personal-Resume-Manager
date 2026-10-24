// Shared Tailwind classes for the auth and account forms (app chrome only).

export const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500";

// Buttons have no width; SubmitButton adds w-full unless fullWidth={false}.
export const primaryButtonClass =
  "rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50";

export const secondaryButtonClass =
  "rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50";

export const dangerButtonClass =
  "rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50";

export const linkClass = "font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-600";
