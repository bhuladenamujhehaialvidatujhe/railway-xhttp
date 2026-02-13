import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// Railway auto-assigns PORT
const PORT = Number(Deno.env.get("PORT") || 8080);

// 馃敀 Hardcoded Target Host
const TARGET_HOST = "zz.sdbuild.me";

console.log("Proxy starting...");
console.log("Target:", TARGET_HOST);

serve(async (req: Request) => {
  const url = new URL(req.url);

  // =========================
  // 1锔忊儯 WebSocket Proxy
  // =========================
  if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
    try {
      const { socket: clientWs, response } = Deno.upgradeWebSocket(req);

      const targetWsUrl = `wss://${TARGET_HOST}${url.pathname}${url.search}`;
      const targetWs = new WebSocket(targetWsUrl);

      const queue: Array<string | ArrayBuffer | Blob> = [];

      targetWs.onopen = () => {
        while (queue.length > 0) {
          targetWs.send(queue.shift()!);
        }
      };

      clientWs.onmessage = (e) => {
        if (targetWs.readyState === WebSocket.OPEN) {
          targetWs.send(e.data);
        } else {
          queue.push(e.data);
        }
      };

      targetWs.onmessage = (e) => {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(e.data);
        }
      };

      const cleanup = () => {
        try { clientWs.close(); } catch {}
        try { targetWs.close(); } catch {}
      };

      targetWs.onerror = cleanup;
      clientWs.onerror = cleanup;
      targetWs.onclose = cleanup;
      clientWs.onclose = cleanup;

      return response;
    } catch (err) {
      console.error("WebSocket Error:", err);
      return new Response("WebSocket Error", { status: 500 });
    }
  }

  // =========================
  // 2锔忊儯 HTTP Proxy
  // =========================
  try {
    const targetUrl = `https://${TARGET_HOST}${url.pathname}${url.search}`;

    const headers = new Headers();
    const skipHeaders = [
      "host",
      "connection",
      "upgrade",
      "keep-alive",
      "proxy-connection",
    ];

    for (const [key, value] of req.headers.entries()) {
      if (!skipHeaders.includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    }

    headers.set("Host", TARGET_HOST);

    const res = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: !["GET", "HEAD"].includes(req.method) ? req.body : null,
      redirect: "manual",
    });

    const resHeaders = new Headers(res.headers);

    // Remove problematic hop-by-hop headers
    resHeaders.delete("content-encoding");
    resHeaders.delete("transfer-encoding");

    return new Response(res.body, {
      status: res.status,
      headers: resHeaders,
    });

  } catch (err: any) {
    console.error("Fetch Error:", err.message);

    return new Response(
      JSON.stringify({
        error: "Proxy Error",
        details: err.message,
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

}, { port: PORT });

console.log(`Server running on port ${PORT}`);
      
