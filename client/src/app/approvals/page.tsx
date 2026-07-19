"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { authApi, AuthUser, getStoredAccessToken, storeAccessToken } from "@/lib/api/auth";
import { approvalsApi, PendingApproval } from "@/lib/api/approvals";
import { formatCountryLabel } from "@/lib/country";
import { AppHeader, APPROVALS_UPDATED_EVENT } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ApprovalsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [items, setItems] = useState<PendingApproval[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [commentByTrip, setCommentByTrip] = useState<Record<string, string>>({});

  async function load(token: string) {
    const result = await approvalsApi.pending({ page: 1, pageSize: 50 }, token);
    setItems(result.items);
    setTotal(result.total);
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
        if (me.role === "SUPER_ADMIN") {
          router.replace("/companies");
          return;
        }
        if (me.role === "EMPLOYEE") {
          router.replace("/trips");
          return;
        }
        if (!me.companyId) {
          router.replace("/company");
          return;
        }
        await load(token);
      } catch (err) {
        storeAccessToken(null);
        setError(err instanceof ApiError ? err.message : "Unable to load approvals");
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function decide(tripId: string, action: "approve" | "reject") {
    const token = getStoredAccessToken();
    if (!token) return;
    setBusyId(tripId);
    setError(null);
    setMessage(null);
    try {
      const comment = commentByTrip[tripId]?.trim() || undefined;
      if (action === "approve") {
        await approvalsApi.approve(tripId, comment, token);
        setMessage("trip approved.");
      } else {
        await approvalsApi.reject(tripId, comment, token);
        setMessage("trip rejected.");
      }
      await load(token);
      window.dispatchEvent(new Event(APPROVALS_UPDATED_EVENT));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Decision failed");
    } finally {
      setBusyId(null);
    }
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-ss-muted lowercase">loading approvals...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10">
      <AppHeader user={user} pendingApprovalsCount={total} />

      <section className="mt-12 rounded-3xl border border-white/15 bg-ss-surface p-8">
        <h1 className="text-3xl font-medium text-ss-text lowercase">approvals</h1>
        <p className="mt-2 text-sm text-ss-muted lowercase">
          pending trip reviews. you cannot approve trips you created or travel on.
        </p>

        {error ? (
          <p className="mt-6 text-sm text-red-300 lowercase" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-6 text-sm text-emerald-300 lowercase">{message}</p>
        ) : null}

        {items.length === 0 ? (
          <p className="mt-10 text-sm text-ss-muted lowercase">
            no pending approvals{total === 0 ? "" : ""}.
          </p>
        ) : (
          <ul className="mt-8 space-y-6">
            {items.map((item) => (
              <li
                key={item.approvalId}
                className="rounded-2xl border border-white/10 bg-ss-surface-strong/40 p-5"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <Link
                      href={`/trips/${item.tripId}`}
                      className="text-lg text-ss-text lowercase hover:underline"
                    >
                      {item.purpose}
                    </Link>
                    <p className="mt-1 text-sm text-ss-muted lowercase">
                      {[
                        item.destinationCity,
                        formatCountryLabel(item.destinationCountry) || null,
                      ]
                        .filter(Boolean)
                        .join(", ") || "destination TBD"}{" "}
                      · {item.startDate} → {item.endDate}
                    </p>
                    <p className="mt-1 text-sm text-ss-muted lowercase">
                      requested by {item.createdByName ?? item.createdByEmail} ·{" "}
                      {item.travelerCount} traveler
                      {item.travelerCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="rounded-full border border-amber-400/30 px-3 py-1 text-xs lowercase text-amber-200">
                    pending
                  </span>
                </div>

                <div className="mt-4 space-y-2">
                  <Label className="lowercase text-ss-muted">comment (optional)</Label>
                  <Input
                    value={commentByTrip[item.tripId] ?? ""}
                    onChange={(e) =>
                      setCommentByTrip((prev) => ({
                        ...prev,
                        [item.tripId]: e.target.value,
                      }))
                    }
                    className="h-11 rounded-xl border-white/20 bg-ss-surface text-ss-text"
                    placeholder="reason or note"
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    disabled={busyId === item.tripId}
                    onClick={() => void decide(item.tripId, "approve")}
                    className="rounded-full bg-ss-accent px-4 text-white lowercase hover:bg-ss-accent-hover"
                  >
                    approve
                  </Button>
                  <Button
                    disabled={busyId === item.tripId}
                    onClick={() => void decide(item.tripId, "reject")}
                    className="rounded-full border border-white/20 bg-transparent px-4 text-ss-text lowercase hover:bg-white/5"
                  >
                    reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
