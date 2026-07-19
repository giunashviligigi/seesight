"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { authApi, getStoredAccessToken, storeAccessToken } from "@/lib/api/auth";
import { companiesApi } from "@/lib/api/companies";
import { employeesApi } from "@/lib/api/employees";
import { tripsApi } from "@/lib/api/trips";
import { readCompanyBudgetPolicy } from "@/lib/budget-policy";

/** Legacy route: create a booking-first draft and open the trip page. */
export default function NewTripPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

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

        let travelerId: string | null = null;
        if (me.role === "EMPLOYEE") {
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
            budgetAmount,
            budgetCurrency,
            travelers: [{ employeeId: travelerId, isPrimary: true }],
          },
          token,
        );
        router.replace(`/trips/${created.id}`);
      } catch (err) {
        storeAccessToken(
          err instanceof ApiError && err.status === 401 ? null : getStoredAccessToken(),
        );
        setError(err instanceof ApiError ? err.message : "Unable to create trip");
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
        }
      }
    })();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <p className="text-ss-muted lowercase">
        {error ?? "opening booking…"}
      </p>
    </main>
  );
}
