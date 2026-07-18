"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { authApi, AuthUser, getStoredAccessToken, storeAccessToken } from "@/lib/api/auth";
import { companiesApi, Company } from "@/lib/api/companies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CompanySettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [country, setCountry] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [budgetLimit, setBudgetLimit] = useState("");
  const [message, setMessage] = useState<string | null>(null);
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
          setLoading(false);
          return;
        }

        const current = await companiesApi.me(token);
        setCompany(current);
        setName(current.name);
        setLegalName(current.legalName ?? "");
        setCountry(current.country ?? "");
        setBillingEmail(current.billingEmail ?? "");
        setTimezone(current.timezone);
        const limit = current.policyJson?.defaultBudgetLimit;
        setBudgetLimit(typeof limit === "number" ? String(limit) : "");
      } catch (err) {
        storeAccessToken(null);
        setError(err instanceof ApiError ? err.message : "Unable to load company");
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const created = await companiesApi.create({
        name,
        legalName: legalName || undefined,
        country: country || undefined,
        billingEmail: billingEmail || undefined,
        timezone,
        policyJson: budgetLimit
          ? { defaultBudgetLimit: Number(budgetLimit), currency: "EUR" }
          : undefined,
      });
      setCompany(created);
      setMessage("company created and linked to your account.");
      const me = await authApi.me();
      setUser(me);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create company");
    } finally {
      setSaving(false);
    }
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!company) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const updated = await companiesApi.update(company.id, {
        name,
        legalName: legalName || null,
        country: country || null,
        billingEmail: billingEmail || null,
        timezone,
        policyJson: budgetLimit
          ? { defaultBudgetLimit: Number(budgetLimit), currency: "EUR" }
          : null,
      });
      setCompany(updated);
      setMessage("company profile updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to update company");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-ss-muted lowercase">loading company...</p>
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
          <Link href="/employees" className="text-sm text-ss-muted lowercase hover:text-ss-text">
            employees
          </Link>
          <Link href="/account" className="text-sm text-ss-muted lowercase hover:text-ss-text">
            account
          </Link>
        </div>
      </header>

      <section className="mt-12 rounded-3xl border border-white/15 bg-ss-surface p-8">
        <h1 className="text-3xl font-medium text-ss-text lowercase">
          {company ? "company settings" : "create your company"}
        </h1>
        <p className="mt-2 text-sm text-ss-muted lowercase">
          {company
            ? "update your organization profile and travel policy defaults."
            : "company admins without a tenant can create their first company here."}
        </p>

        <form className="mt-8 space-y-5" onSubmit={company ? onSave : onCreate}>
          <div className="space-y-2">
            <Label className="lowercase text-ss-muted">name</Label>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
            />
          </div>
          <div className="space-y-2">
            <Label className="lowercase text-ss-muted">legal name</Label>
            <Input
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="lowercase text-ss-muted">country</Label>
              <Input
                maxLength={2}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
              />
            </div>
            <div className="space-y-2">
              <Label className="lowercase text-ss-muted">timezone</Label>
              <Input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="lowercase text-ss-muted">billing email</Label>
            <Input
              type="email"
              value={billingEmail}
              onChange={(e) => setBillingEmail(e.target.value)}
              className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
            />
          </div>
          <div className="space-y-2">
            <Label className="lowercase text-ss-muted">default budget limit</Label>
            <Input
              type="number"
              min={0}
              value={budgetLimit}
              onChange={(e) => setBudgetLimit(e.target.value)}
              className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
            />
          </div>

          {company ? (
            <p className="text-xs text-ss-muted lowercase">
              slug: {company.slug} · status: {company.status.toLowerCase()}
              {user?.companyId ? ` · id: ${user.companyId}` : null}
            </p>
          ) : null}

          {error ? (
            <p className="text-sm text-red-300 lowercase" role="alert">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="text-sm text-ss-text lowercase" role="status">
              {message}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={saving}
            className="h-11 rounded-full bg-ss-accent px-8 text-white lowercase hover:bg-ss-accent-hover"
          >
            {saving ? "saving..." : company ? "save changes" : "create company"}
          </Button>
        </form>
      </section>
    </main>
  );
}
