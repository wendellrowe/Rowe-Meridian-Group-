#!/usr/bin/env python3
"""Deploy the Rowe Meridian site as a Cloudflare Worker with static assets.

All HTTP goes through curl: the sandbox's credential proxy presents a
certificate that Python 3.14's stricter X.509 verification rejects, while curl
trusts it via the system store. curl also receives the proxy-injected
Authorization header, so account-scoped calls need no explicit token here.
"""
import base64
import hashlib
import json
import mimetypes
import pathlib
import subprocess
import sys
import tempfile

ACCOUNT = "25539f37daa4dbd98f1774c5f75f5842"
ZONE = "88727924cbce98e83501402022120183"
SCRIPT = "rowe-meridian-site"
BASE = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}"
ROOT = pathlib.Path("/home/user/workspace/rowe-meridian")

IGNORE_FILES = {
    "README.md", "package.json", "package-lock.json",
    "wrangler.jsonc", ".assetsignore", ".gitignore", "_headers",
}
SKIP_DIRS = {"node_modules", ".git", ".wrangler", "src", "licenses", "qa"}

mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("image/svg+xml", ".svg")

tmp = pathlib.Path(tempfile.mkdtemp(prefix="cfdeploy-"))


def log(*a):
    print(*a, flush=True)


def curl(args, label, allow_fail=False, direct=False):
    """Run curl, returning the parsed JSON body.

    `direct=True` bypasses the credential proxy. The asset-upload endpoint
    authenticates with the short-lived session JWT, which we already hold; the
    proxy would otherwise overwrite that header with the account token and the
    request would 401.
    """
    cmd = ["curl", "-sS", "--max-time", "240", "-w", "\n%{http_code}"]
    if direct:
        cmd += ["--noproxy", "*"]
    proc = subprocess.run(
        cmd + args,
        capture_output=True, text=True,
    )
    if proc.returncode != 0:
        log(f"!! {label}: curl failed -> {proc.stderr.strip()[:400]}")
        if allow_fail:
            return None
        sys.exit(1)
    raw = proc.stdout.rsplit("\n", 1)
    body_text, code = (raw[0], raw[1]) if len(raw) == 2 else (proc.stdout, "?")
    try:
        body = json.loads(body_text)
    except ValueError:
        log(f"!! {label}: non-JSON response (HTTP {code}): {body_text[:300]}")
        if allow_fail:
            return None
        sys.exit(1)
    if not body.get("success", True):
        log(f"!! {label}: HTTP {code} errors={body.get('errors')}")
        if allow_fail:
            return None
        sys.exit(1)
    return body


def post_json(url, payload, label, method="POST", allow_fail=False):
    f = tmp / "payload.json"
    f.write_text(json.dumps(payload))
    return curl(
        ["-X", method, url, "-H", "content-type: application/json",
         "--data", f"@{f}"],
        label, allow_fail=allow_fail,
    )


# ---------------------------------------------------------------- 1. manifest
files = {}
for p in sorted(ROOT.rglob("*")):
    if not p.is_file():
        continue
    rel = p.relative_to(ROOT)
    if rel.parts[0] in SKIP_DIRS or p.name in IGNORE_FILES:
        continue
    data = p.read_bytes()
    files["/" + rel.as_posix()] = {
        "data": data,
        "hash": hashlib.sha256(data).hexdigest()[:32],
        "ct": mimetypes.guess_type(p.name)[0] or "application/octet-stream",
    }

manifest = {k: {"hash": v["hash"], "size": len(v["data"])} for k, v in files.items()}
by_hash = {v["hash"]: v for v in files.values()}
total = sum(len(v["data"]) for v in files.values())
log(f"1. manifest: {len(manifest)} files, {total/1024:.0f} KB")

# --------------------------------------------------- 2. asset upload session
sess = post_json(
    f"{BASE}/workers/scripts/{SCRIPT}/assets-upload-session",
    {"manifest": manifest}, "assets-upload-session",
)["result"]
jwt = sess.get("jwt")
buckets = [b for b in (sess.get("buckets") or []) if b]
log(f"2. session opened; {len(buckets)} bucket(s) need upload")

# ------------------------------------------------------------ 3. upload files
completion = jwt
for i, bucket in enumerate(buckets, 1):
    args = [f"{BASE}/workers/assets/upload?base64=true",
            "-H", f"Authorization: Bearer {jwt}"]
    for h in bucket:
        f = by_hash[h]
        b64 = tmp / h
        b64.write_text(base64.b64encode(f["data"]).decode())
        args += ["-F", f"{h}=@{b64};type={f['ct']};filename={h}"]
    body = curl(args, f"upload bucket {i}", direct=True)
    log(f"3.{i} uploaded {len(bucket)} file(s)")
    tok = (body.get("result") or {}).get("jwt")
    if tok:
        completion = tok

if not buckets:
    log("3. all files already present server-side")

# ------------------------------------------------------- 4. upload the worker
metadata = {
    "main_module": "index.js",
    "compatibility_date": "2026-08-01",
    "bindings": [
        {"type": "assets", "name": "ASSETS"},
        {"type": "send_email", "name": "EMAIL",
         "destination_address": "hello@wendellrowe.com"},
    ],
    "assets": {
        "jwt": completion,
        "config": {
            "html_handling": "auto-trailing-slash",
            "not_found_handling": "404-page",
            "run_worker_first": True,
        },
    },
    "observability": {"enabled": True},
}
meta_f = tmp / "metadata.json"
meta_f.write_text(json.dumps(metadata))

res = curl(
    ["-X", "PUT", f"{BASE}/workers/scripts/{SCRIPT}",
     "-F", f"metadata=@{meta_f};type=application/json",
     "-F", f"index.js=@{ROOT / 'src' / 'index.js'};type=application/javascript+module"],
    "worker upload",
)["result"]
log(f"4. worker deployed: {res.get('id')}")

# ----------------------------------------------------- 5. workers.dev preview
sub = curl([f"{BASE}/workers/subdomain"], "subdomain")["result"]
post_json(f"{BASE}/workers/scripts/{SCRIPT}/subdomain",
          {"enabled": True, "previews_enabled": False}, "enable subdomain",
          allow_fail=True)
log(f"5. preview: https://{SCRIPT}.{sub.get('subdomain')}.workers.dev")

# ---------------------------------------------------------- 6. custom domains
for host in ("rowemeridiangroup.com", "www.rowemeridiangroup.com"):
    out = post_json(
        f"{BASE}/workers/domains",
        {"environment": "production", "hostname": host,
         "service": SCRIPT, "zone_id": ZONE},
        f"attach {host}", method="PUT", allow_fail=True,
    )
    log(f"6. {host} -> {'attached' if out else 'FAILED (see above)'}")

log("\nDONE")
