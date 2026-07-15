"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { authApi, getStoredAccessToken, storeAccessToken } from "@/lib/api/auth";
import { companiesApi, Company } from "@/lib/api/companies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CompaniesAdminPage() {
  const router = useRouter();
  const [items, setItems] = useState<Company[]>([]);
  const [search, setSearch] = useState("");
  const [assignCompanyId, setAssignCompanyId] = useState("");
  const [assignEmail, setAssignEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(token: string, q?: string) {
    const result = await companiesApi.list({ search: q, pageSize: 50 }, token);
    setItems(result.items);
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
        if (me.role !== "SUPER_ADMIN") {
          router.replace("/company");
          return;
        }
        await load(token);
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
      await load(token, search);
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
      await load(token, search);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Status update failed");
    }
  }

  async function onAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getStoredAccessToken();
    if (!token || !assignCompanyId) return;
    setError(null);
    setMessage(null);
    try {
      const result = await companiesApi.assignAdmin(
        assignCompanyId,
        { email: assignEmail, replaceExisting: false },
        token,
      );
      setMessage(result.message);
      setAssignEmail("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Assign admin failed");
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-ss-muted lowercase">loading companies...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm font-semibold tracking-[0.35em] text-ss-text uppercase">
          Seesight
        </Link>
        <Link href="/account" className="text-sm text-ss-muted lowercase hover:text-ss-text">
          account
        </Link>
      </header>

      <section className="mt-12 rounded-3xl border border-white/15 bg-ss-surface p-8">
        <h1 className="text-3xl font-medium text-ss-text lowercase">companies</h1>
        <p className="mt-2 text-sm text-ss-muted lowercase">
          super admin tenant directory — search, activate/deactivate, assign admins.
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
            className="h-11 rounded-full bg-ss-accent px-6 text-white lowercase hover:bg-ss-accent-hover"
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
          <table className="w-full min-w-[640px] text-left text-sm text-ss-text">
            <thead className="text-ss-muted lowercase">
              <tr className="border-b border-white/10">
                <th className="py-3 pr-4 font-medium">name</th>
                <th className="py-3 pr-4 font-medium">slug</th>
                <th className="py-3 pr-4 font-medium">status</th>
                <th className="py-3 pr-4 font-medium">billing</th>
                <th className="py-3 font-medium">actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((company) => (
                <tr key={company.id} className="border-b border-white/5">
                  <td className="py-3 pr-4">{company.name}</td>
                  <td className="py-3 pr-4 lowercase text-ss-muted">{company.slug}</td>
                  <td className="py-3 pr-4 lowercase">{company.status.toLowerCase()}</td>
                  <td className="py-3 pr-4 text-ss-muted">{company.billingEmail ?? "—"}</td>
                  <td className="py-3">
                    <Button
                      type="button"
                      onClick={() => void toggleStatus(company)}
                      className="rounded-full border border-white/20 bg-transparent px-3 text-xs text-ss-text lowercase hover:bg-white/5"
                    >
                      {company.status === "ACTIVE" ? "deactivate" : "activate"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form className="mt-10 space-y-4 border-t border-white/10 pt-8" onSubmit={onAssign}>
          <h2 className="text-xl text-ss-text lowercase">assign company admin</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="lowercase text-ss-muted">company id</Label>
              <Input
                required
                value={assignCompanyId}
                onChange={(e) => setAssignCompanyId(e.target.value)}
                className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
              />
            </div>
            <div className="space-y-2">
              <Label className="lowercase text-ss-muted">user email</Label>
              <Input
                required
                type="email"
                value={assignEmail}
                onChange={(e) => setAssignEmail(e.target.value)}
                className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
              />
            </div>
          </div>
          <Button
            type="submit"
            className="h-11 rounded-full bg-ss-accent px-6 text-white lowercase hover:bg-ss-accent-hover"
          >
            assign admin
          </Button>
        </form>
      </section>
    </main>
  );
}
