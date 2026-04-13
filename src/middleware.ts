import { NextRequest, NextResponse } from "next/server";

const TOSS_ORIGINS = [
  "https://daisso.apps.tossmini.com",
  "https://daisso.private-apps.tossmini.com",
  "https://apps-in-toss.toss.im",
  "https://developer.tossmini.com",
];

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const origin = req.headers.get("origin") || "";
  const isAllowed = TOSS_ORIGINS.includes(origin) || origin.endsWith(".toss.im") || origin.endsWith(".tossmini.com");

  // Preflight
  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": isAllowed ? origin : "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const res = NextResponse.next();
  res.headers.set("Access-Control-Allow-Origin", isAllowed ? origin : "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
