"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { authApi, AuthUser, getStoredAccessToken, storeAccessToken } from "@/lib/api/auth";
import { employeesApi, Employee } from "@/lib/api/employees";
import { tripsApi } from "@/lib/api/trips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NewTripPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selfEmployeeId, setSelfEmployeeId] = useState<string | null>(null);
  const [purpose, setPurpose] = useState("");
  const [destinationCountry, setDestinationCountry] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    void (async () => {
      try {
        const me = await authApi.me(token);
        setUser(me);
        if (me.role === "SUPER_ADMIN") {
          router.replace("/companies");
          return;
        }
        if (!me.companyId) {
          router.replace("/company");
          return;
        }

        if (me.role === "EMPLOYEE") {
          const profile = await employeesApi.me(token);
          setSelfEmployeeId(profile.id);
          setSelectedIds([profile.id]);
          setEmployees([profile]);
        } else {
          const roster = await employeesApi.list(
            { page: 1, pageSize: 100, status: "ACTIVE" },
            token,
          );
          setEmployees(roster.items);
        }
      } catch (err) {
        storeAccessToken(null);
        setError(err instanceof ApiError ? err.message : "Unable to load form");
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  function toggleTraveler(id: string) {
    if (user?.role === "EMPLOYEE" && id === selfEmployeeId) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getStoredAccessToken();
    if (!token) return;
    setSaving(true);
    setError(null);

    try {
      if (selectedIds.length < 1) {
        throw new ApiError("select at least one traveler", 400);
      }
      const created = await tripsApi.create(
        {
          purpose,
          destinationCountry: destinationCountry || undefined,
          destinationCity: destinationCity || undefined,
          startDate,
          endDate,
          budgetAmount: budgetAmount ? Number(budgetAmount) : undefined,
          notes: notes || undefined,
          travelers: selectedIds.map((employeeId, index) => ({
            employeeId,
            isPrimary: index === 0,
          })),
        },
        token,
      );
      router.push(`/trips/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create trip");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-ss-muted lowercase">loading...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-10">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm font-semibold tracking-[0.35em] text-ss-text uppercase">
          Seesight
        </Link>
        <Link href="/trips" className="text-sm text-ss-muted lowercase hover:text-ss-text">
          trips
        </Link>
      </header>

      <section className="mt-12 rounded-3xl border border-white/15 bg-ss-surface p-8">
        <h1 className="text-3xl font-medium text-ss-text lowercase">new trip</h1>
        <p className="mt-2 text-sm text-ss-muted lowercase">
          create a draft with at least one traveler. submit for approval from the trip detail page.
        </p>

        {error ? (
          <p className="mt-6 text-sm text-red-300 lowercase" role="alert">
            {error}
          </p>
        ) : null}

        <form className="mt-8 space-y-5" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label className="lowercase text-ss-muted">purpose</Label>
            <Input
              required
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="lowercase text-ss-muted">country</Label>
              <Input
                maxLength={2}
                value={destinationCountry}
                onChange={(e) => setDestinationCountry(e.target.value)}
                className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
              />
            </div>
            <div className="space-y-2">
              <Label className="lowercase text-ss-muted">city</Label>
              <Input
                value={destinationCity}
                onChange={(e) => setDestinationCity(e.target.value)}
                className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="lowercase text-ss-muted">start date</Label>
              <Input
                required
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
              />
            </div>
            <div className="space-y-2">
              <Label className="lowercase text-ss-muted">end date</Label>
              <Input
                required
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="lowercase text-ss-muted">budget (eur)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={budgetAmount}
              onChange={(e) => setBudgetAmount(e.target.value)}
              className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
            />
          </div>
          <div className="space-y-2">
            <Label className="lowercase text-ss-muted">notes</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
            />
          </div>

          <div className="space-y-3">
            <Label className="lowercase text-ss-muted">travelers</Label>
            <ul className="max-h-56 space-y-2 overflow-y-auto rounded-2xl border border-white/10 p-3">
              {employees.map((employee) => {
                const checked = selectedIds.includes(employee.id);
                const locked =
                  user?.role === "EMPLOYEE" && employee.id === selfEmployeeId;
                return (
                  <li key={employee.id}>
                    <label className="flex cursor-pointer items-center gap-3 text-sm lowercase text-ss-text">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={locked}
                        onChange={() => toggleTraveler(employee.id)}
                        className="size-4 accent-[var(--ss-accent)]"
                      />
                      <span>
                        {employee.firstName} {employee.lastName}
                        <span className="text-ss-muted"> · {employee.email}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>

          <Button
            type="submit"
            disabled={saving}
            className="rounded-full bg-ss-accent px-6 text-white lowercase hover:bg-ss-accent-hover"
          >
            {saving ? "creating..." : "create draft"}
          </Button>
        </form>
      </section>
    </main>
  );
}
