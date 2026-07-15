"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { authApi } from "@/lib/api/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState(searchParams.get("token") ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const result = await authApi.resetPassword({ token, newPassword });
      setMessage(result.message);
      setTimeout(() => router.push("/login"), 1200);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="reset password" subtitle="choose a new password for your account.">
      <form className="space-y-5" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="token" className="lowercase text-ss-muted">
            reset token
          </Label>
          <Input
            id="token"
            required
            value={token}
            onChange={(event) => setToken(event.target.value)}
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
          {loading ? "updating..." : "reset password"}
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthShell title="reset password" subtitle="loading..."><p className="text-ss-muted lowercase">loading...</p></AuthShell>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
