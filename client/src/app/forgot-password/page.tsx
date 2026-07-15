"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { authApi } from "@/lib/api/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setDevResetUrl(null);
    setLoading(true);

    try {
      const result = await authApi.forgotPassword(email);
      setMessage(result.message);
      setDevResetUrl(result.resetUrl ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to send reset");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="forgot password"
      subtitle="we will send reset instructions if an account exists."
    >
      <form className="space-y-5" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email" className="lowercase text-ss-muted">
            email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
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
        {devResetUrl ? (
          <p className="text-xs text-ss-muted lowercase">
            development reset link:{" "}
            <a href={devResetUrl} className="break-all text-ss-text underline">
              {devResetUrl}
            </a>
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-full bg-ss-accent text-white lowercase hover:bg-ss-accent-hover"
        >
          {loading ? "sending..." : "send reset link"}
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
