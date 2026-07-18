"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { authApi, getStoredAccessToken, storeAccessToken } from "@/lib/api/auth";
import { reportsApi, ReportsSummary } from "@/lib/api/reports";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function BarList({
  items,
  valueKey,
  labelKey,
  formatValue,
}: {
  items: Array<Record<string, string | number | null>>;
  valueKey: string;
  labelKey: string;
  formatValue?: (value: number) => string;
}) {
  const max = Math.max(
    1,
    ...items.map((item) => Number(item[valueKey] ?? 0)),
  );

  if (items.length === 0) {
    return <p className="mt-4 text-sm text-ss-muted lowercase">no data for this period.</p>;
  }

  return (
    <ul className="mt-4 space-y-3">
      {items.map((item) => {
        const value = Number(item[valueKey] ?? 0);
        const width = `${Math.max(4, (value / max) * 100)}%`;
        return (
          <li key={String(item[labelKey])}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm lowercase">
              <span className="text-ss-text">{String(item[labelKey])}</span>
              <span className="text-ss-muted">
                {formatValue ? formatValue(value) : value}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[var(--chart-1)] transition-all duration-500"
                style={{ width }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [from, setFrom] = useState("2026-01-01");
  const [to, setTo] = useState("2026-12-31");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  async function load(token: string, range = { from, to }) {
    const data = await reportsApi.summary(range, token);
    setSummary(data);
  }

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    void (async () => {
      try {
        const me = await authApi.me(token);
        if (me.role === "SUPER_ADMIN") {
          router.replace("/companies");
          return;
        }
        if (me.role === "EMPLOYEE") {
          router.replace("/dashboard");
          return;
        }
        if (!me.companyId) {
          router.replace("/company");
          return;
        }
        await load(token);
      } catch (err) {
        storeAccessToken(null);
        setError(err instanceof ApiError ? err.message : "Unable to load reports");
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function onFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getStoredAccessToken();
    if (!token) return;
    setError(null);
    try {
      await load(token, { from, to });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to refresh reports");
    }
  }

  async function onExport(
    dataset: "summary" | "monthly" | "departments" | "destinations",
  ) {
    const token = getStoredAccessToken();
    if (!token) return;
    setExporting(true);
    setError(null);
    try {
      const { blob, filename } = await reportsApi.downloadCsv(
        { from, to, dataset },
        token,
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-ss-muted lowercase">loading reports...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10">
      <header className="flex items-center justify-between gap-4">
        <Link href="/" className="text-sm font-semibold tracking-[0.35em] text-ss-text uppercase">
          Seesight
        </Link>
        <nav className="flex flex-wrap justify-end gap-3">
          <Link href="/dashboard" className="text-sm text-ss-muted lowercase hover:text-ss-text">
            dashboard
          </Link>
          <Link href="/trips" className="text-sm text-ss-muted lowercase hover:text-ss-text">
            trips
          </Link>
          <Link href="/approvals" className="text-sm text-ss-muted lowercase hover:text-ss-text">
            approvals
          </Link>
          <Link href="/account" className="text-sm text-ss-muted lowercase hover:text-ss-text">
            account
          </Link>
        </nav>
      </header>

      <section className="mt-12">
        <h1 className="text-3xl font-medium text-ss-text lowercase">reports</h1>
        <p className="mt-2 max-w-2xl text-sm text-ss-muted lowercase">
          company travel analytics from selected flight and hotel offers. max range{" "}
          {summary?.maxRangeMonths ?? 24} months.
        </p>

        {error ? (
          <p className="mt-6 text-sm text-red-300 lowercase" role="alert">
            {error}
          </p>
        ) : null}

        <form
          className="mt-8 grid gap-3 rounded-3xl border border-white/15 bg-ss-surface p-6 md:grid-cols-4"
          onSubmit={onFilter}
        >
          <div className="space-y-2">
            <Label className="lowercase text-ss-muted">from</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
            />
          </div>
          <div className="space-y-2">
            <Label className="lowercase text-ss-muted">to</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
            />
          </div>
          <div className="flex items-end md:col-span-2 md:justify-end md:gap-2">
            <Button
              type="submit"
              className="h-11 rounded-full bg-ss-accent px-5 text-white lowercase hover:bg-ss-accent-hover"
            >
              apply
            </Button>
            <Button
              type="button"
              disabled={exporting}
              onClick={() => void onExport("summary")}
              className="h-11 rounded-full border border-white/20 bg-transparent px-5 text-ss-text lowercase hover:bg-white/5"
            >
              export csv
            </Button>
          </div>
        </form>

        {summary ? (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <article className="rounded-3xl border border-white/15 bg-ss-surface p-6">
                <p className="text-xs text-ss-muted lowercase">total spend</p>
                <p className="mt-3 text-2xl text-ss-text">
                  {formatMoney(summary.totalSpend, summary.currency)}
                </p>
              </article>
              <article className="rounded-3xl border border-white/15 bg-ss-surface p-6">
                <p className="text-xs text-ss-muted lowercase">trips</p>
                <p className="mt-3 text-2xl text-ss-text">{summary.tripCount}</p>
              </article>
              <article className="rounded-3xl border border-white/15 bg-ss-surface p-6">
                <p className="text-xs text-ss-muted lowercase">avg trip cost</p>
                <p className="mt-3 text-2xl text-ss-text">
                  {formatMoney(summary.averageTripCost, summary.currency)}
                </p>
              </article>
              <article className="rounded-3xl border border-white/15 bg-ss-surface p-6">
                <p className="text-xs text-ss-muted lowercase">period</p>
                <p className="mt-3 text-sm text-ss-text lowercase">
                  {summary.periodFrom} → {summary.periodTo}
                </p>
              </article>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <section className="rounded-3xl border border-white/15 bg-ss-surface p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg text-ss-text lowercase">monthly spending</h2>
                  <button
                    type="button"
                    className="text-xs text-ss-accent lowercase hover:underline"
                    onClick={() => void onExport("monthly")}
                  >
                    csv
                  </button>
                </div>
                <BarList
                  items={summary.monthlySpending.map((row) => ({
                    label: row.month,
                    value: row.amount,
                  }))}
                  labelKey="label"
                  valueKey="value"
                  formatValue={(v) => formatMoney(v, summary.currency)}
                />
              </section>

              <section className="rounded-3xl border border-white/15 bg-ss-surface p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg text-ss-text lowercase">trips by department</h2>
                  <button
                    type="button"
                    className="text-xs text-ss-accent lowercase hover:underline"
                    onClick={() => void onExport("departments")}
                  >
                    csv
                  </button>
                </div>
                <BarList
                  items={summary.tripsByDepartment.map((row) => ({
                    label: row.departmentName,
                    value: row.tripCount,
                  }))}
                  labelKey="label"
                  valueKey="value"
                />
              </section>

              <section className="rounded-3xl border border-white/15 bg-ss-surface p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg text-ss-text lowercase">top countries</h2>
                  <button
                    type="button"
                    className="text-xs text-ss-accent lowercase hover:underline"
                    onClick={() => void onExport("destinations")}
                  >
                    csv
                  </button>
                </div>
                <BarList
                  items={summary.topCountries.map((row) => ({
                    label: row.label,
                    value: row.tripCount,
                  }))}
                  labelKey="label"
                  valueKey="value"
                />
              </section>

              <section className="rounded-3xl border border-white/15 bg-ss-surface p-6">
                <h2 className="text-lg text-ss-text lowercase">top cities</h2>
                <BarList
                  items={summary.topCities.map((row) => ({
                    label: row.label,
                    value: row.tripCount,
                  }))}
                  labelKey="label"
                  valueKey="value"
                />
              </section>
            </div>

            <section className="mt-6 overflow-x-auto rounded-3xl border border-white/15 bg-ss-surface p-6">
              <h2 className="text-lg text-ss-text lowercase">monthly table</h2>
              <table className="mt-4 w-full min-w-[420px] text-left text-sm lowercase">
                <thead>
                  <tr className="border-b border-white/10 text-ss-muted">
                    <th className="py-2 font-medium">month</th>
                    <th className="py-2 font-medium">trips</th>
                    <th className="py-2 font-medium">spend</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.monthlySpending.map((row) => (
                    <tr key={row.month} className="border-b border-white/5 text-ss-text">
                      <td className="py-2">{row.month}</td>
                      <td className="py-2">{row.tripCount}</td>
                      <td className="py-2">
                        {formatMoney(row.amount, summary.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}
