"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { authApi, getStoredAccessToken, storeAccessToken } from "@/lib/api/auth";
import { employeesApi, Employee } from "@/lib/api/employees";

export default function ProfilePage() {
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
        if (me.role === "COMPANY_ADMIN") {
          router.replace("/employees");
          return;
        }
        const profile = await employeesApi.me(token);
        setEmployee(profile);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setError("no employee profile linked to this account yet.");
        } else {
          storeAccessToken(null);
          setError(err instanceof ApiError ? err.message : "Unable to load profile");
          router.replace("/login");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-ss-muted lowercase">loading profile...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-10">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm font-semibold tracking-[0.35em] text-ss-text uppercase">
          Seesight
        </Link>
        <div className="flex gap-3">
          <Link href="/dashboard" className="text-sm text-ss-muted lowercase hover:text-ss-text">
            dashboard
          </Link>
          <Link href="/trips" className="text-sm text-ss-muted lowercase hover:text-ss-text">
            trips
          </Link>
          <Link href="/account" className="text-sm text-ss-muted lowercase hover:text-ss-text">
            account
          </Link>
        </div>
      </header>

      <section className="mt-12 rounded-3xl border border-white/15 bg-ss-surface p-8">
        <h1 className="text-3xl font-medium text-ss-text lowercase">my profile</h1>
        <p className="mt-2 text-sm text-ss-muted lowercase">
          employees can view their own roster profile. ask a company admin to update details.
        </p>

        {error ? (
          <p className="mt-6 text-sm text-red-300 lowercase" role="alert">
            {error}
          </p>
        ) : null}

        {employee ? (
          <dl className="mt-8 grid gap-4 text-sm lowercase sm:grid-cols-2">
            <div>
              <dt className="text-ss-muted">name</dt>
              <dd className="mt-1 text-ss-text">
                {employee.firstName} {employee.lastName}
              </dd>
            </div>
            <div>
              <dt className="text-ss-muted">email</dt>
              <dd className="mt-1 text-ss-text">{employee.email}</dd>
            </div>
            <div>
              <dt className="text-ss-muted">job title</dt>
              <dd className="mt-1 text-ss-text">{employee.jobTitle ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-ss-muted">department</dt>
              <dd className="mt-1 text-ss-text">{employee.departmentName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-ss-muted">phone</dt>
              <dd className="mt-1 text-ss-text">{employee.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-ss-muted">status</dt>
              <dd className="mt-1 text-ss-text">{employee.status.toLowerCase()}</dd>
            </div>
            <div>
              <dt className="text-ss-muted">nationality</dt>
              <dd className="mt-1 text-ss-text">{employee.nationality ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-ss-muted">preferred airport</dt>
              <dd className="mt-1 text-ss-text">{employee.preferredAirport ?? "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-ss-muted">passport number</dt>
              <dd className="mt-1 text-ss-text">{employee.passportNumber ?? "—"}</dd>
            </div>
          </dl>
        ) : null}
      </section>
    </main>
  );
}
