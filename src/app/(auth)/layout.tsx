export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
      <p className="mb-8 text-sm font-medium text-zinc-500">Resume Manager</p>
      {children}
    </main>
  );
}
