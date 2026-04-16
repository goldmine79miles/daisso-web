import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { checkRateLimit, getClientIP } from "@/lib/rateLimit";

const DISCONNECT_SECRET = process.env.TOSS_DISCONNECT_SECRET || "";

if (!DISCONNECT_SECRET && process.env.NODE_ENV === "production") {
  console.error("[toss-disconnect] FATAL: TOSS_DISCONNECT_SECRET is not set in production");
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function verifyBasicAuth(req: NextRequest): boolean {
  // 프로덕션에서 TOSS_DISCONNECT_SECRET 없으면 무조건 거부
  if (!DISCONNECT_SECRET) {
    if (process.env.NODE_ENV === "production") {
      console.error("[toss-disconnect] TOSS_DISCONNECT_SECRET 미설정 — 인증 거부");
      return false;
    }
    console.warn("[toss-disconnect] DEV 모드: 인증 스킵");
    return true;
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Basic ")) return false;

  const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
  // 길이를 검사 후 조기 리턴하면 타이밍 공격 노출 가능 → 고정 길이로 패딩해서 비교
  const expectedBuf = Buffer.from(DISCONNECT_SECRET);
  const decodedBuf = Buffer.from(decoded);
  // 고정 길이 버퍼 (64바이트) 로 normalize해서 length-independent 비교
  const CMP_LEN = 64;
  const expectedPadded = Buffer.alloc(CMP_LEN, 0);
  const decodedPadded = Buffer.alloc(CMP_LEN, 0);
  expectedBuf.copy(expectedPadded, 0, 0, Math.min(expectedBuf.length, CMP_LEN));
  decodedBuf.copy(decodedPadded, 0, 0, Math.min(decodedBuf.length, CMP_LEN));
  const lengthMatch = expectedBuf.length === decodedBuf.length;
  const contentMatch = crypto.timingSafeEqual(expectedPadded, decodedPadded);
  return lengthMatch && contentMatch;
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
