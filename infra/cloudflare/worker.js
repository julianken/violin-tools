// Cloudflare Worker — serves the public GCS website bucket over HTTPS as the
// edge for strings-solo.com. This is the free alternative to a GCP load
// balancer: Cloudflare provides TLS + CDN; this Worker provides index-default,
// SPA fallback, and the www->apex 301.
//
// NOT committed with secrets and NOT deployed via Wrangler-in-CI. The
// orchestrator deploys it in Phase C via the Cloudflare API / MCP, bound to a
// Workers custom domain (or route) for `strings-solo.com` and `www`. There are
// no env bindings or tokens in this file — the origin bucket is public-read, so
// the Worker fetches it anonymously over HTTPS (TLS is end-to-end to GCS).

const ORIGIN = "https://storage.googleapis.com/strings-solo-prod-web";
const APEX = "strings-solo.com";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // www -> apex 301 (the redirect the dropped GCP URL map used to do).
    if (url.hostname === `www.${APEX}`) {
      url.hostname = APEX;
      return Response.redirect(url.toString(), 301);
    }

    // Map "/" to the index document.
    let path = url.pathname;
    if (path === "/" || path.endsWith("/")) path += "index.html";

    const originResponse = await fetch(ORIGIN + path);

    // SPA fallback: on a miss, serve index.html with a 200 so client-side routes
    // resolve. v1 has no deep links, so this is forward-prep — but it makes the
    // edge behave like the bucket's own not_found_page=index.html setting.
    const response = originResponse.ok
      ? originResponse
      : new Response(await (await fetch(ORIGIN + "/index.html")).text(), {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });

    // Caching: hashed assets are immutable; everything else (notably the SPA
    // entry) revalidates so a fresh deploy goes live without a purge. Gate
    // `immutable` on a REAL asset hit (`originResponse.ok` AND an /assets/ path):
    // a 404 that fell back to index.html keeps `path` as /assets/... but must NOT
    // be stamped immutable, or a missing hashed file would be cached forever as a
    // stale SPA shell. (This matches the live `strings-solo-web` Worker.)
    const headers = new Headers(response.headers);
    headers.set(
      "Cache-Control",
      originResponse.ok && path.startsWith("/assets/")
        ? "public,max-age=31536000,immutable"
        : "no-cache",
    );

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  },
};
