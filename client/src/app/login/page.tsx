"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { authApi, storeAccessToken } from "@/lib/api/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await authApi.login({ email, password });
      storeAccessToken(result.accessToken);
      router.push("/account");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to log in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="log in" subtitle="access your company travel workspace.">
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
        <div className="space-y-2">
          <Label htmlFor="password" className="lowercase text-ss-muted">
            password
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
          />
        </div>

        {error ? (
          <p className="text-sm text-red-300 lowercase" role="alert">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-full bg-ss-accent text-white lowercase hover:bg-ss-accent-hover"
        >
          {loading ? "signing in..." : "log in"}
        </Button>
      </form>

      <div className="mt-6 space-y-2 text-sm text-ss-muted lowercase">
        <p>
          <Link href="/forgot-password" className="text-ss-text underline-offset-4 hover:underline">
            forgot password?
          </Link>
        </p>
        <p>
          no account yet?{" "}
          <Link href="/register" className="text-ss-text underline-offset-4 hover:underline">
            register
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
