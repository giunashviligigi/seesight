"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authApi, getStoredAccessToken, storeAccessToken } from "@/lib/api/auth";
import { getHomeHref } from "@/lib/nav";

const VALUE_CARDS = [
  {
    title: "trip approvals",
    body: "employees submit travel requests. managers review, approve, or reject with a clear audit trail.",
  },
  {
    title: "flights & hotels",
    body: "search market offers in one workspace, attach the chosen itinerary, and keep everything on the trip.",
  },
  {
    title: "spend & reports",
    body: "see company travel cost by month, department, and destination — so policy stays grounded in data.",
  },
] as const;

const HOW_STEPS = [
  {
    step: "01",
    title: "create your company",
    body: "register as a company admin and set up your organization profile.",
  },
  {
    step: "02",
    title: "invite employees",
    body: "add travelers by department so everyone books inside the same system.",
  },
  {
    step: "03",
    title: "submit & approve trips",
    body: "travelers propose itineraries; admins approve spend before it happens.",
  },
] as const;

const FAQ_ITEMS = [
  {
    q: "who is seesight for?",
    a: "companies that manage business travel — smbs, tech teams, event agencies, and sports organizations that need one place for trips, approvals, and spend.",
  },
  {
    q: "what roles exist?",
    a: "company admins manage employees, policy, and approvals. employees create and track their own trips. super admins operate the platform.",
  },
  {
    q: "how does search and ai help?",
    a: "inside a trip you can search flights and hotels, or describe the trip in plain language so we fill the search for you. pricing is shown as a stay total with night count.",
  },
  {
    q: "how do approvals work?",
    a: "an employee submits a trip for review. a company admin approves or rejects it. the traveler gets notified and can reopen rejected trips as drafts.",
  },
] as const;

export default function HomePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) {
      setReady(true);
      return;
    }

    void (async () => {
      try {
        const me = await authApi.me(token);
        router.replace(getHomeHref(me.role));
      } catch {
        storeAccessToken(null);
        setReady(true);
      }
    })();
  }, [router]);

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-ss-muted lowercase">loading...</p>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-1 flex-col">
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
            sign up
          </Link>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-6xl flex-col px-6 pb-16 pt-8 sm:pb-24 sm:pt-12">
        <p className="max-w-xl text-4xl leading-tight font-medium tracking-tight text-ss-text lowercase sm:text-5xl">
          travel smart.
          <br />
          control company spend.
        </p>
        <p className="mt-6 max-w-lg text-base leading-relaxed text-ss-muted lowercase">
          seesight is the business travel workspace for your company — plan
          trips, approve requests, and keep flight and hotel spend visible in
          one place.
        </p>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-20">
        <h2 className="text-2xl font-medium lowercase text-ss-text">
          built for company travel
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-ss-muted lowercase">
          replace scattered bookings, spreadsheets, and email threads with one
          approval-ready workflow.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {VALUE_CARDS.map((card) => (
            <article
              key={card.title}
              className="rounded-3xl border border-white/15 bg-ss-surface p-6"
            >
              <h3 className="text-lg font-medium lowercase text-ss-text">
                {card.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ss-muted lowercase">
                {card.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-20">
        <h2 className="text-2xl font-medium lowercase text-ss-text">
          how it works
        </h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          {HOW_STEPS.map((item) => (
            <li
              key={item.step}
              className="rounded-3xl border border-white/10 bg-ss-surface-strong p-6"
            >
              <p className="text-xs tracking-[0.2em] text-ss-accent">
                {item.step}
              </p>
              <h3 className="mt-3 text-lg font-medium lowercase text-ss-text">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ss-muted lowercase">
                {item.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-20">
        <h2 className="text-2xl font-medium lowercase text-ss-text">
          frequently asked questions
        </h2>
        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {FAQ_ITEMS.map((item, index) => {
            const open = openFaq === index;
            return (
              <div
                key={item.q}
                className="rounded-2xl border border-white/15 bg-ss-surface"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left lowercase"
                  aria-expanded={open}
                  onClick={() => setOpenFaq(open ? null : index)}
                >
                  <span className="text-sm font-medium text-ss-text">
                    {item.q}
                  </span>
                  <span className="text-ss-muted" aria-hidden>
                    {open ? "–" : "+"}
                  </span>
                </button>
                {open ? (
                  <p className="border-t border-white/10 px-5 py-4 text-sm leading-relaxed text-ss-muted lowercase">
                    {item.a}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <footer className="mt-auto border-t border-white/10 bg-black/40">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="inline-flex size-7 items-center justify-center rounded-full border border-white/30 text-[0.65rem] tracking-[0.2em] text-ss-text"
            >
              ◯
            </span>
            <span className="text-xs font-semibold tracking-[0.35em] text-ss-text uppercase">
              Seesight
            </span>
          </div>
          <div className="flex flex-wrap gap-4 text-sm lowercase text-ss-muted">
            <Link href="/login" className="hover:text-ss-text">
              log in
            </Link>
            <Link href="/register" className="hover:text-ss-text">
              sign up
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
