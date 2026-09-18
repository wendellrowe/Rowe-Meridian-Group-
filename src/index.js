const CANONICAL_HOST = "rowemeridian.com";

/**
 * Hostnames permitted to POST to /api/inquiry. workers.dev preview hosts are
 * allowed dynamically so the form can be exercised before a custom domain
 * is attached.
 */
const ALLOWED_ORIGIN_HOSTS = new Set([CANONICAL_HOST, `www.${CANONICAL_HOST}`]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Collapse www -> apex once a custom domain is live.
    if (url.hostname === `www.${CANONICAL_HOST}`) {
      url.hostname = CANONICAL_HOST;
      return Response.redirect(url.toString(), 308);
    }

    if (url.pathname === "/api/inquiry") return handleInquiry(request, env);

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) return response;

    const notFound = await env.ASSETS.fetch(new Request(new URL("/404.html", url), request));
    const headers = new Headers(notFound.headers);
    headers.set("X-Robots-Tag", "noindex");
    return new Response(request.method === "HEAD" ? null : notFound.body, {
      status: 404,
      headers,
    });
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
