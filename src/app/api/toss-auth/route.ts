import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { checkRateLimit, getClientIP } from "@/lib/rateLimit";
import { mtlsRequest, TOSS_API } from "@/lib/toss-api";

const ALLOWED_ORIGINS = [
  "https://daisso.apps.tossmini.com",
  "https://daisso.private-apps.tossmini.com",
];

function getCorsHeaders(origin?: string | null) {
  const allowedOrigin =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(origin) });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function postMessageResponse(data: any): NextResponse {
  const json = JSON.stringify(data);
  const html = `<!DOCTYPE html><html><body><script>
try { window.parent.postMessage(${json}, window.location.origin); } catch(e) {}
</script></body></html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function POST(req: NextRequest) {
  const cors = getCorsHeaders(req.headers.get("origin"));

  const ip = getClientIP(req);
  const rl = checkRateLimit(`toss-auth:${ip}`, { limit: 10, windowSec: 60 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { ...cors, "Retry-After": String(rl.resetIn) } }
    );
  }

  const contentType = req.headers.get("content-type") || "";
  const isFormPost = contentType.includes("application/x-www-form-urlencoded");

  let authorizationCode: string;
  let referrer: string;

  try {
    if (isFormPost) {
      const formData = await req.formData();
      authorizationCode = formData.get("authorizationCode") as string;
      referrer = (formData.get("referrer") as string) || "DEFAULT";
    } else {
      const body = await req.json();
      authorizationCode = body.authorizationCode;
      referrer = body.referrer || "DEFAULT";
    }

    if (!authorizationCode) {
      const err = { error: "authorizationCode is required" };
      return isFormPost
        ? postMessageResponse(err)
        : NextResponse.json(err, { status: 400, headers: cors });
    }

    const certPem = process.env.TOSS_MTLS_CERT;
    const keyPem = process.env.TOSS_MTLS_KEY;
    const decryptKey = process.env.TOSS_DECRYPT_KEY;
    const decryptAAD = process.env.TOSS_DECRYPT_AAD || "TOSS";

    if (!certPem || !keyPem) {
      console.error("[toss-auth] mTLS 인증서 미설정");
      const err = { error: "Server auth not configured" };
      return isFormPost
        ? postMessageResponse(err)
        : NextResponse.json(err, { status: 500, headers: cors });
    }

    // Step 1: 인가코드 → AccessToken
    const tokenResult = await mtlsRequest(
      `${TOSS_API}/api-partner/v1/apps-in-toss/user/oauth2/generate-token`,
      { method: "POST", body: JSON.stringify({ authorizationCode, referrer }), cert: certPem, key: keyPem }
    );

    if (tokenResult.resultType !== "SUCCESS") {
      console.error("[toss-auth] token error:", tokenResult.error);
      const err = { error: tokenResult.error?.reason || "Token exchange failed" };
      return isFormPost
        ? postMessageResponse(err)
        : NextResponse.json(err, { status: 401, headers: cors });
    }

    const { accessToken, refreshToken, expiresIn } = tokenResult.success;

    // Step 2: AccessToken → 사용자 정보 (암호화됨)
    const userResult = await mtlsRequest(
      `${TOSS_API}/api-partner/v1/apps-in-toss/user/oauth2/login-me`,
      { method: "GET", extraHeaders: { Authorization: `Bearer ${accessToken}` }, cert: certPem, key: keyPem }
    );

    if (userResult.resultType !== "SUCCESS") {
      console.error("[toss-auth] user info error:", userResult.error);
      const err = { error: "Failed to get user info" };
      return isFormPost
        ? postMessageResponse(err)
        : NextResponse.json(err, { status: 401, headers: cors });
    }

    const raw = userResult.success;

    // Step 3: AES-256-GCM 복호화
    let name = "";
    if (decryptKey && raw.name) name = decryptField(raw.name, decryptKey, decryptAAD);

    const responseData = {
      userId: String(raw.userKey),
      name,
      accessToken,
      refreshToken,
      expiresIn,
    };

    return isFormPost
      ? postMessageResponse(responseData)
      : NextResponse.json(responseData, { headers: cors });
  } catch (error) {
    console.error("[toss-auth] error:", error);
    const err = { error: "Internal server error" };
    return isFormPost
      ? postMessageResponse(err)
      : NextResponse.json(err, { status: 500, headers: cors });
  }
}

function decryptField(encryptedText: string, key: string, aad: string): string {
  const IV_LENGTH = 12;
  const decoded = Buffer.from(encryptedText, "base64");
  const keyBuffer = Buffer.from(key, "base64");
  const iv = decoded.subarray(0, IV_LENGTH);
  const authTag = decoded.subarray(decoded.length - 16);
  const ciphertext = decoded.subarray(IV_LENGTH, decoded.length - 16);

  const decipher = crypto.createDecipheriv("aes-256-gcm", keyBuffer, iv);
  decipher.setAuthTag(authTag);
  decipher.setAAD(Buffer.from(aad));

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
