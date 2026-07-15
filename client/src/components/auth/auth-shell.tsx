import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <main className="relative flex min-h-screen flex-1 flex-col px-6 py-10">
      <header className="mx-auto flex w-full max-w-md items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <span
            aria-hidden
            className="inline-flex size-8 items-center justify-center rounded-full border border-white/30 bg-ss-navy/60 text-xs tracking-[0.2em] text-ss-text"
          >
            ◯
          </span>
          <span className="text-sm font-semibold tracking-[0.35em] text-ss-text uppercase">
            Seesight
          </span>
        </Link>
      </header>

      <section className="mx-auto mt-16 w-full max-w-md rounded-3xl border border-white/15 bg-ss-surface p-8 backdrop-blur-sm">
        <h1 className="text-3xl font-medium tracking-tight text-ss-text lowercase">
          {title}
        </h1>
        <p className="mt-2 text-sm text-ss-muted lowercase">{subtitle}</p>
        <div className="mt-8">{children}</div>
      </section>
    </main>
  );
}
