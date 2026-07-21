"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { authApi, AuthUser, getStoredAccessToken, storeAccessToken } from "@/lib/api/auth";
import { companiesApi, Company } from "@/lib/api/companies";
import { readCompanyBudgetPolicy } from "@/lib/budget-policy";
import { PlatformUser, usersApi } from "@/lib/api/users";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function formatTripBudget(company: Company): string {
  const policy = readCompanyBudgetPolicy(company.policyJson);
  if (policy.defaultBudgetLimit === null) {
    return `— · ${policy.defaultBudgetCurrency}`;
  }
  return `${policy.defaultBudgetLimit} ${policy.defaultBudgetCurrency}`;
}

export default function CompaniesAdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [items, setItems] = useState<Company[]>([]);
  const [unassignedUsers, setUnassignedUsers] = useState<PlatformUser[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadCompanies(token: string, q?: string) {
    const result = await companiesApi.list({ search: q, pageSize: 50 }, token);
    setItems(result.items);
  }

  async function loadUnassignedUsers(token: string) {
    const result = await usersApi.list(
      { unassignedOnly: true, pageSize: 50 },
      token,
    );
    setUnassignedUsers(result.items);
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
        setUser(me);
        if (me.role !== "SUPER_ADMIN") {
          router.replace("/company");
          return;
        }
        await Promise.all([loadCompanies(token), loadUnassignedUsers(token)]);
      } catch (err) {
        storeAccessToken(null);
        setError(err instanceof ApiError ? err.message : "Unable to load companies");
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getStoredAccessToken();
    if (!token) return;
    setError(null);
    try {
      await loadCompanies(token, search);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Search failed");
    }
  }

  async function toggleStatus(company: Company) {
    const token = getStoredAccessToken();
    if (!token) return;
    setError(null);
    setMessage(null);
    try {
      if (company.status === "ACTIVE") {
        await companiesApi.deactivate(company.id, token);
        setMessage(`${company.name} deactivated.`);
      } else {
        await companiesApi.activate(company.id, token);
        setMessage(`${company.name} activated.`);
      }
      await loadCompanies(token, search);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Status update failed");
    }
  }

  async function onRemove(company: Company) {
    const token = getStoredAccessToken();
    if (!token) return;
    const confirmed = window.confirm(
      `Remove ${company.name}? It will leave the directory. Data is kept.`,
    );
    if (!confirmed) return;
    setError(null);
    setMessage(null);
    try {
      await companiesApi.remove(company.id, token);
      setMessage(`${company.name} removed.`);
      await loadCompanies(token, search);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Remove failed");
    }
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-ss-muted lowercase">loading companies...</p>
      </main>
    );
  }

  return (
    <AppShell user={user} contentClassName="max-w-7xl">
      <section className="mt-12 rounded-3xl border border-white/15 bg-ss-surface p-8">
        <h1 className="text-3xl font-medium text-ss-text lowercase">companies</h1>
        <p className="mt-2 text-sm text-ss-muted lowercase">
          super admin directory — companies and signed-up users with no company yet.
        </p>

        <form className="mt-8 flex flex-col gap-3 sm:flex-row" onSubmit={onSearch}>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search name, slug, email"
            className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
          />
          <Button
            type="submit"
            className="h-11 shrink-0 rounded-full bg-ss-accent px-6 text-white lowercase hover:bg-ss-accent-hover"
          >
            search
          </Button>
        </form>

        {error ? (
          <p className="mt-4 text-sm text-red-300 lowercase" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-4 text-sm text-ss-text lowercase" role="status">
            {message}
          </p>
        ) : null}

        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm text-ss-text">
            <thead className="text-ss-muted lowercase">
              <tr className="border-b border-white/10">
                <th className="whitespace-nowrap py-3 pr-5 font-medium">name</th>
                <th className="whitespace-nowrap py-3 pr-5 font-medium">slug</th>
                <th className="whitespace-nowrap py-3 pr-5 font-medium">status</th>
                <th className="whitespace-nowrap py-3 pr-5 font-medium">admin</th>
                <th className="whitespace-nowrap py-3 pr-5 font-medium">trip budget</th>
                <th className="whitespace-nowrap py-3 pr-5 font-medium">billing email</th>
                <th className="whitespace-nowrap py-3 font-medium">actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((company) => (
                <tr key={company.id} className="border-b border-white/5">
                  <td className="whitespace-nowrap py-3 pr-5">{company.name}</td>
                  <td className="whitespace-nowrap py-3 pr-5 lowercase text-ss-muted">
                    {company.slug}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-5 lowercase">
                    {company.status.toLowerCase()}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-5 text-ss-muted">
                    {company.adminEmails && company.adminEmails.length > 0
                      ? company.adminEmails.join(", ")
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-5 lowercase text-ss-muted">
                    {formatTripBudget(company)}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-5 text-ss-muted">
                    {company.billingEmail ?? "—"}
                  </td>
                  <td className="whitespace-nowrap py-3">
                    <div className="flex flex-nowrap items-center gap-2">
                      <Link
                        href={`/employees?companyId=${encodeURIComponent(company.id)}`}
                        className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-ss-text lowercase hover:bg-white/5"
                      >
                        employees
                      </Link>
                      <Button
                        type="button"
                        onClick={() => void toggleStatus(company)}
                        className="rounded-full border border-white/20 bg-transparent px-3 text-xs text-ss-text lowercase hover:bg-white/5"
                      >
                        {company.status === "ACTIVE" ? "deactivate" : "activate"}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => void onRemove(company)}
                        className="rounded-full border border-red-400/40 bg-transparent px-3 text-xs text-red-300 lowercase hover:bg-red-500/10"
                      >
                        remove
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-10 space-y-4 border-t border-white/10 pt-8">
          <div>
            <h2 className="text-xl text-ss-text lowercase">users without a company</h2>
            <p className="mt-2 text-sm text-ss-muted lowercase">
              people who registered but have not created or been linked to a company yet.
            </p>
          </div>

          {unassignedUsers.length === 0 ? (
            <p className="text-sm text-ss-muted lowercase">no unassigned users right now.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm text-ss-text">
                <thead className="text-ss-muted lowercase">
                  <tr className="border-b border-white/10">
                    <th className="whitespace-nowrap py-3 pr-5 font-medium">name</th>
                    <th className="whitespace-nowrap py-3 pr-5 font-medium">email</th>
                    <th className="whitespace-nowrap py-3 font-medium">signed up</th>
                  </tr>
                </thead>
                <tbody>
                  {unassignedUsers.map((u) => (
                    <tr key={u.id} className="border-b border-white/5">
                      <td className="whitespace-nowrap py-3 pr-5 lowercase">
                        {[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-5 text-ss-muted">{u.email}</td>
                      <td className="whitespace-nowrap py-3 text-ss-muted lowercase">
                        {new Date(u.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
