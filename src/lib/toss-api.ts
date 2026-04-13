import https from "https";

export const TOSS_API = "https://apps-in-toss-api.toss.im";

export function mtlsRequest(
  url: string,
  options: {
    method: string;
    body?: string;
    extraHeaders?: Record<string, string>;
    cert: string;
    key: string;
  }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions: https.RequestOptions = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: options.method,
      cert: options.cert.replace(/\\n/g, "\n"),
      key: options.key.replace(/\\n/g, "\n"),
      headers: {
        "Content-Type": "application/json",
        ...options.extraHeaders,
        ...(options.body
          ? { "Content-Length": Buffer.byteLength(options.body).toString() }
          : {}),
      },
    };

    const request = https.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk: string) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Invalid JSON: ${data.slice(0, 200)}`));
        }
      });
    });

    request.on("error", reject);
    request.setTimeout(15000, () => {
      request.destroy();
      reject(new Error("mTLS request timeout"));
    });

    if (options.body) request.write(options.body);
    request.end();
  });
}
