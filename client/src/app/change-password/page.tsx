"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import {
  authApi,
  getStoredAccessToken,
  storeAccessToken,
} from "@/lib/api/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    void (async () => {
      try {
        const me = await authApi.me(token);
        if (!me.mustChangePassword) {
          router.replace("/dashboard");
          return;
        }
      } catch {
        storeAccessToken(null);
        router.replace("/login");
        return;
      } finally {
        setChecking(false);
      }
    })();
  }, [router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setError("new passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const result = await authApi.changePassword({
        currentPassword,
        newPassword,
      });
      setMessage(result.message);
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 800);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Unable to change password",
      );
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <AuthShell title="change password" subtitle="loading...">
        <p className="text-sm text-ss-muted lowercase">checking session...</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="change password"
      subtitle="your account was created with a temporary password. set your own password to continue."
    >
      <form className="space-y-5" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="currentPassword" className="lowercase text-ss-muted">
            temporary password
          </Label>
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="newPassword" className="lowercase text-ss-muted">
            new password
          </Label>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="lowercase text-ss-muted">
            confirm new password
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
          />
        </div>

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
          disabled={loading}
          className="h-11 w-full rounded-full bg-ss-accent text-white lowercase hover:bg-ss-accent-hover"
        >
          {loading ? "saving..." : "set password"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-ss-muted lowercase">
        <Link href="/login" className="text-ss-text underline-offset-4 hover:underline">
          back to log in
        </Link>
      </p>
    </AuthShell>
  );
}
