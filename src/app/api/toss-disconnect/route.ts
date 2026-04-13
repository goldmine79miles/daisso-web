import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { checkRateLimit, getClientIP } from "@/lib/rateLimit";

const DISCONNECT_SECRET = process.env.TOSS_DISCONNECT_SECRET || "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function verifyBasicAuth(req: NextRequest): boolean {
  if (!DISCONNECT_SECRET) {
    console.warn("[toss-disconnect] TOSS_DISCONNECT_SECRET 미설정 — 인증 스킵");
    return true;
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Basic ")) return false;

  const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
  const expected = DISCONNECT_SECRET;
  if (decoded.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(decoded), Buffer.from(expected));
}

export async function GET(req: NextRequest) {
  const ip = getClientIP(req);
  const rl = checkRateLimit(`toss-disconnect:${ip}`, { limit: 10, windowSec: 60 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { ...CORS_HEADERS, "Retry-After": String(rl.resetIn) } }
    );
  }

  if (!verifyBasicAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const userKey = url.searchParams.get("userKey");

  try {
    if (userKey) {
      console.log(`[toss-disconnect] User disconnected: ${userKey}`);
    } else {
      console.log("[toss-disconnect] Test ping received (no userKey)");
    }
    return NextResponse.json({ resultType: "SUCCESS" }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error("[toss-disconnect] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: CORS_HEADERS });
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  const rl = checkRateLimit(`toss-disconnect:${ip}`, { limit: 10, windowSec: 60 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { ...CORS_HEADERS, "Retry-After": String(rl.resetIn) } }
    );
  }

  if (!verifyBasicAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }

  try {
    let userKey: string | undefined;
    try {
      const body = await req.json();
      userKey = body.userKey;
    } catch {}

    if (userKey) {
      console.log(`[toss-disconnect] User disconnected: ${userKey}`);
    } else {
      console.log("[toss-disconnect] Test ping received (no userKey)");
    }
    return NextResponse.json({ resultType: "SUCCESS" }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error("[toss-disconnect] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: CORS_HEADERS });
  }
}
