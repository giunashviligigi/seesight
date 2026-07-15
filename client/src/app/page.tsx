import Link from "next/link";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function HomePage() {
  return (
    <main className="relative flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="inline-flex size-8 items-center justify-center rounded-full border border-white/30 bg-ss-navy/60 text-xs tracking-[0.2em] text-ss-text"
          >
            ◯
          </span>
          <span className="text-sm font-semibold tracking-[0.35em] text-ss-text uppercase">
            Seesight
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm text-ss-text lowercase hover:bg-white/5"
          >
            log in
          </Link>
          <Link
            href="/register"
            className="rounded-full bg-ss-accent px-4 py-2 text-sm text-white lowercase hover:bg-ss-accent-hover"
          >
            register
          </Link>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 pb-24 pt-8">
        <p className="max-w-md text-4xl leading-tight font-medium tracking-tight text-ss-text lowercase sm:text-5xl">
          travel smart.
          <br />
          travel cheap.
          <br />
          have fun.
        </p>

        <p className="mt-6 max-w-lg text-base text-ss-muted lowercase">
          ai-powered business travel management. sign in to manage trips, or
          open the api docs at{" "}
          <a
            href={`${apiBaseUrl}/docs`}
            className="text-ss-text underline-offset-4 hover:underline"
          >
            {apiBaseUrl}/docs
          </a>
          .
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/account"
            className="inline-flex items-center justify-center rounded-full bg-ss-accent px-8 py-2.5 text-sm text-white lowercase transition-colors hover:bg-ss-accent-hover"
          >
            open account
          </Link>
          <Link
            href="/company"
            className="inline-flex items-center justify-center rounded-full border border-white/20 px-8 py-2.5 text-sm text-ss-text lowercase transition-colors hover:bg-white/5"
          >
            company settings
          </Link>
          <a
            href={`${apiBaseUrl}/health`}
            className="inline-flex items-center justify-center rounded-full border border-white/20 px-8 py-2.5 text-sm text-ss-text lowercase transition-colors hover:bg-white/5"
          >
            api health
          </a>
        </div>
      </section>
    </main>
  );
}
