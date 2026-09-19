const CANONICAL_HOST = "rowemeridiangroup.com";

/**
 * Hostnames permitted to POST to /api/inquiry. workers.dev preview hosts are
 * allowed dynamically so the form can be exercised before a custom domain
 * is attached.
 */
const ALLOWED_ORIGIN_HOSTS = new Set([CANONICAL_HOST, `www.${CANONICAL_HOST}`]);

/**
 * Applied in the Worker rather than relying solely on `_headers`, so the policy
 * holds regardless of how the project is deployed.
 */
const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; " +
    "form-action 'self'; img-src 'self' data:; font-src 'self'; style-src 'self' 'unsafe-inline'; " +
    "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; " +
    "connect-src 'self' https://cloudflareinsights.com; upgrade-insecure-requests",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

function harden(response, extra) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  if (extra) for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Cloudflare's static-asset binding answers every request with the full body and
 * no `Accept-Ranges`, so browsers cannot scrub audio — a seek just restarts the
 * track. Media responses are therefore range-served here.
 */
const RANGEABLE = /^(audio|video)\//;

async function withRange(request, response) {
  if (!RANGEABLE.test(response.headers.get("content-type") || "")) return response;

  const range = request.headers.get("Range");

  // Advertise support even on a full response, so the browser offers scrubbing.
  if (!range || response.status !== 200) {
    const headers = new Headers(response.headers);
    headers.set("Accept-Ranges", "bytes");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!match || (match[1] === "" && match[2] === "")) return response;

  const body = new Uint8Array(await response.arrayBuffer());
  const size = body.byteLength;

  let start;
  let end;
  if (match[1] === "") {
    start = Math.max(0, size - Number(match[2])); // bytes=-N → trailing N bytes
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${size}`, "Accept-Ranges": "bytes" },
    });
  }

  const headers = new Headers(response.headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  headers.set("Content-Length", String(end - start + 1));

  return new Response(body.subarray(start, end + 1), {
    status: 206,
    statusText: "Partial Content",
    headers,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Collapse www -> apex once a custom domain is live.
    if (url.hostname === `www.${CANONICAL_HOST}`) {
      url.hostname = CANONICAL_HOST;
      return Response.redirect(url.toString(), 308);
    }

    if (url.pathname === "/api/inquiry") return handleInquiry(request, env);

    // Never serve the asset-config file itself.
    if (url.pathname === "/_headers" || url.pathname === "/_redirects") {
      return new Response("Not found", { status: 404 });
    }

    // `not_found_handling: "404-page"` means the assets binding already returns
    // the rendered 404 page body on a miss — just mark it noindex.
    const response = await withRange(request, await env.ASSETS.fetch(request));
    return harden(response, response.status === 404 ? { "X-Robots-Tag": "noindex" } : null);
  },
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

function originAllowed(origin) {
  if (!origin) return true;
  let host;
  try {
    host = new URL(origin).hostname;
  } catch {
    return false;
  }
  return ALLOWED_ORIGIN_HOSTS.has(host) || host.endsWith(".workers.dev");
}

async function handleInquiry(request, env) {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!originAllowed(request.headers.get("Origin"))) {
    return json({ error: "Origin not allowed." }, 403);
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const name = clean(data.name, 120);
  const organization = clean(data.organization, 160);
  const email = clean(data.email, 254);
  const purpose = clean(data.purpose, 80);
  const message = clean(data.message, 4000);

  if (!name || !email || !purpose || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Please complete the required fields." }, 400);
  }

  // Honeypot: silently accept and discard.
  if (clean(data.website, 120)) return json({ ok: true });

  const subject = "Rowe Meridian inquiry \u2014 " + purpose;
  const text = [
    "Name: " + name,
    "Organization: " + (organization || "Not provided"),
    "Email: " + email,
    "Purpose: " + purpose,
    "",
    message,
  ].join("\n");

  try {
    await env.EMAIL.send({
      from: "Rowe Meridian Group <inquiries@wendellrowe.com>",
      to: "hello@wendellrowe.com",
      replyTo: `${name} <${email}>`,
      subject,
      text,
    });
    return json({ ok: true });
  } catch (err) {
    console.error("Inquiry delivery failed:", err?.message || err);
    return json(
      {
        error:
          "We could not send your inquiry. Please try again or email hello@wendellrowe.com.",
      },
      502,
    );
  }
}

function clean(value, max) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}
