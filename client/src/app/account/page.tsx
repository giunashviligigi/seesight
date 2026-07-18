"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import {
  authApi,
  AuthUser,
  getStoredAccessToken,
  storeAccessToken,
} from "@/lib/api/auth";
import { Button } from "@/components/ui/button";

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [protectedMessage, setProtectedMessage] = useState<string | null>(null);
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
        const [me, sample] = await Promise.all([
          authApi.me(token),
          authApi.protectedSample(token),
        ]);
        setUser(me);
        setProtectedMessage(sample.message);
      } catch (err) {
        storeAccessToken(null);
        setError(err instanceof ApiError ? err.message : "Session expired");
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function onLogout() {
    try {
      await authApi.logout();
    } finally {
      storeAccessToken(null);
      router.push("/login");
      router.refresh();
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-ss-muted lowercase">loading account...</p>
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
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-10">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm font-semibold tracking-[0.35em] text-ss-text uppercase">
          Seesight
        </Link>
        <div className="flex items-center gap-3">
          {(user.role === "COMPANY_ADMIN" || user.role === "EMPLOYEE") && user.companyId ? (
            <>
              <Link href="/dashboard" className="text-sm text-ss-muted lowercase hover:text-ss-text">
                dashboard
              </Link>
              <Link href="/trips" className="text-sm text-ss-muted lowercase hover:text-ss-text">
                trips
              </Link>
            </>
          ) : null}
          <Link
            href={
              user.role === "SUPER_ADMIN"
                ? "/companies"
                : user.role === "EMPLOYEE"
                  ? "/profile"
                  : "/employees"
            }
            className="text-sm text-ss-muted lowercase hover:text-ss-text"
          >
            {user.role === "SUPER_ADMIN"
              ? "companies"
              : user.role === "EMPLOYEE"
                ? "profile"
                : "employees"}
          </Link>
          {user.role === "COMPANY_ADMIN" ? (
            <Link href="/company" className="text-sm text-ss-muted lowercase hover:text-ss-text">
              company
            </Link>
          ) : null}
          <Button
            onClick={onLogout}
            className="rounded-full bg-ss-accent px-5 text-white lowercase hover:bg-ss-accent-hover"
          >
            log out
          </Button>
        </div>
      </header>

      <section className="mt-16 rounded-3xl border border-white/15 bg-ss-surface p-8">
        <h1 className="text-3xl font-medium text-ss-text lowercase">account</h1>
        <p className="mt-2 text-sm text-ss-muted lowercase">
          protected page proving jwt authentication works.
        </p>

        <dl className="mt-8 grid gap-4 text-sm lowercase sm:grid-cols-2">
          <div>
            <dt className="text-ss-muted">email</dt>
            <dd className="mt-1 text-ss-text">{user.email}</dd>
          </div>
          <div>
            <dt className="text-ss-muted">role</dt>
            <dd className="mt-1 text-ss-text">{user.role}</dd>
          </div>
          <div>
            <dt className="text-ss-muted">status</dt>
            <dd className="mt-1 text-ss-text">{user.status}</dd>
          </div>
          <div>
            <dt className="text-ss-muted">company id</dt>
            <dd className="mt-1 text-ss-text">{user.companyId ?? "not assigned yet"}</dd>
          </div>
        </dl>

        {protectedMessage ? (
          <p className="mt-8 rounded-2xl border border-white/10 bg-ss-surface-strong px-4 py-3 text-sm text-ss-text lowercase">
            {protectedMessage}
          </p>
        ) : null}
      </section>
    </main>
  );
}
