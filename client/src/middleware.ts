import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PREFIXES = ["/account"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requiresAuth = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!requiresAuth) {
    return NextResponse.next();
  }

  const token = request.cookies.get("seesight_access_token")?.value;
  if (!token) {
    // Cookie may be missing across localhost ports; page still validates via Bearer token in localStorage.
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*"],
};
