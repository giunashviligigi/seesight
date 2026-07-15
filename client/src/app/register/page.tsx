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

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await authApi.register({
        email,
        password,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
      });
      storeAccessToken(result.accessToken);
      router.push("/account");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to register");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="register"
      subtitle="create a company admin account to start managing travel."
    >
      <form className="space-y-5" onSubmit={onSubmit}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName" className="lowercase text-ss-muted">
              first name
            </Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName" className="lowercase text-ss-muted">
              last name
            </Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
            />
          </div>
        </div>
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
            autoComplete="new-password"
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
          {loading ? "creating account..." : "create account"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-ss-muted lowercase">
        already registered?{" "}
        <Link href="/login" className="text-ss-text underline-offset-4 hover:underline">
          log in
        </Link>
      </p>
    </AuthShell>
  );
}
