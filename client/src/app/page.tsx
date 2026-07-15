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
        <span
          aria-label="profile"
          className="inline-flex size-9 items-center justify-center rounded-full bg-[#9fd4ff]/20 text-[#9fd4ff]"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-5"
            fill="currentColor"
            aria-hidden
          >
            <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
          </svg>
        </span>
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
          project foundation is ready. api health lives at{" "}
          <a
            href={`${apiBaseUrl}/health`}
            className="text-ss-text underline-offset-4 hover:underline"
          >
            {apiBaseUrl}/health
          </a>
          .
        </p>

        <div className="mt-10">
          <a
            href={`${apiBaseUrl}/docs`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-full bg-ss-accent px-8 py-2.5 text-sm text-white lowercase transition-colors hover:bg-ss-accent-hover"
          >
            open api docs
          </a>
        </div>
      </section>
    </main>
  );
}
