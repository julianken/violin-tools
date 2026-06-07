# Cloud CDN backend-bucket over the website bucket.
#
# CACHE SPLIT (the standard SPA cache contract):
#   - cache_mode = "USE_ORIGIN_HEADERS" — Cloud CDN honors each object's own
#     Cache-Control header rather than imposing one blanket TTL. The deploy
#     workflow (.github/workflows/deploy.yml) uploads the two object classes
#     with DISTINCT Cache-Control headers, which this mode then respects:
#       * hashed Vite assets (assets/*, content-hashed filenames) →
#         `public, max-age=31536000, immutable` (1 year, safe because the hash
#         changes when content changes)
#       * index.html → `no-cache` (revalidate every request) so a deploy takes
#         effect immediately and never pins users to a stale shell.
#     A stale index.html would pin users to an old build, so the two are
#     configured distinctly — not one blanket value.
#   - client_ttl / default_ttl / max_ttl are the per-object UPPER BOUNDS the
#     origin headers are clamped to; they do not override a shorter origin TTL,
#     so index.html's `no-cache` still wins.
#   - serve_while_stale lets the edge serve slightly-stale content while it
#     revalidates, smoothing deploy transitions.
#
# The CI step `gcloud compute url-maps invalidate-cdn-cache --path=/index.html`
# (in deploy.yml) is the belt-and-suspenders flush of the shell after each sync.
resource "google_compute_backend_bucket" "website" {
  name        = "${var.bucket_name}-backend"
  description = "Cloud CDN backend for the Violin Tools static site bucket."
  bucket_name = google_storage_bucket.website.name
  enable_cdn  = true

  cdn_policy {
    cache_mode        = "USE_ORIGIN_HEADERS"
    client_ttl        = 31536000
    default_ttl       = 3600
    max_ttl           = 31536000
    serve_while_stale = 86400
  }
}
