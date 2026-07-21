"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import {
  authApi,
  AuthUser,
  getStoredAccessToken,
  storeAccessToken,
} from "@/lib/api/auth";
import { companiesApi } from "@/lib/api/companies";
import { employeesApi } from "@/lib/api/employees";
import { tripsApi } from "@/lib/api/trips";
import { readCompanyBudgetPolicy } from "@/lib/budget-policy";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Create a draft trip — purpose is required before booking. */
export default function NewTripPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [purpose, setPurpose] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

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
        if (!me.companyId) {
          router.replace("/company");
          return;
        }
        setUser(me);
      } catch (err) {
        storeAccessToken(null);
        setError(err instanceof ApiError ? err.message : "Session expired");
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getStoredAccessToken();
    if (!token || !user) return;

    const nextPurpose = purpose.trim();
    if (!nextPurpose) {
      setError("purpose of trip is required");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      let travelerId: string | null = null;
      if (user.role === "EMPLOYEE") {
        const profile = await employeesApi.me(token);
        travelerId = profile.id;
      } else {
        try {
          const profile = await employeesApi.me(token);
          travelerId = profile.id;
        } catch {
          const roster = await employeesApi.list(
            { page: 1, pageSize: 1, status: "ACTIVE" },
            token,
          );
          travelerId = roster.items[0]?.id ?? null;
        }
      }
      if (!travelerId) {
        throw new ApiError(
          "add at least one active employee before creating a trip",
          400,
        );
      }

      let budgetAmount: number | undefined;
      let budgetCurrency: string | undefined;
      try {
        const company = await companiesApi.me(token);
        const policy = readCompanyBudgetPolicy(company.policyJson);
        budgetCurrency = policy.defaultBudgetCurrency;
        if (policy.defaultBudgetLimit !== null) {
          budgetAmount = policy.defaultBudgetLimit;
        }
      } catch {
        // optional
      }

      const created = await tripsApi.create(
        {
          purpose: nextPurpose,
          budgetAmount,
          budgetCurrency,
          travelers: [{ employeeId: travelerId, isPrimary: true }],
        },
        token,
      );
      router.replace(`/trips/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create trip");
      if (err instanceof ApiError && err.status === 401) {
        storeAccessToken(null);
        router.replace("/login");
      }
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-ss-muted lowercase">loading...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-ss-muted lowercase">{error ?? "redirecting..."}</p>
      </main>
    );
  }

  return (
    <AppShell user={user}>
      <section className="mt-12 rounded-3xl border border-white/15 bg-ss-surface p-8">
        <h1 className="text-3xl font-medium text-ss-text lowercase">new trip</h1>
        <p className="mt-2 text-sm text-ss-muted lowercase">
          start with the purpose of travel, then pick flights and hotels on the
          next screen.
        </p>

        <form className="mt-8 space-y-5" onSubmit={(e) => void onCreate(e)}>
          <div className="space-y-2">
            <Label className="lowercase text-ss-muted">
              purpose of trip <span className="text-red-300">*</span>
            </Label>
            <Input
              required
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. client workshop in berlin"
              disabled={creating}
              maxLength={200}
              className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
            />
          </div>

          {error ? (
            <p className="text-sm text-red-300 lowercase" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={creating || !purpose.trim()}
              className="rounded-full bg-ss-accent px-6 text-white lowercase hover:bg-ss-accent-hover"
            >
              {creating ? "creating…" : "continue to booking"}
            </Button>
            <Button
              type="button"
              disabled={creating}
              onClick={() => router.push("/trips")}
              className="rounded-full border border-white/20 bg-transparent px-6 text-ss-text lowercase hover:bg-white/5"
            >
              cancel
            </Button>
          </div>
        </form>
      </section>
    </AppShell>
  );
}
