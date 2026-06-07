# The public-read static website / asset bucket — the origin Cloudflare's edge
# (Worker + CDN + TLS) fetches from. No GCP load balancer, no Cloud CDN: TLS and
# caching are Cloudflare's job, so this bucket is the entire GCP serving surface.

resource "google_storage_bucket" "website" {
  name     = var.bucket_name
  location = var.region

  # One IAM model for the whole bucket (no per-object ACLs). Required for the
  # allUsers objectViewer grant below to be the single source of public access.
  uniform_bucket_level_access = true

  # SPA hosting: serve index.html at "/", and fall back to index.html on a miss
  # so client-side routes resolve. The Cloudflare Worker also does SPA fallback;
  # this is the origin-level backstop for any direct GCS access.
  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html"
  }

  # This bucket is INTENTIONALLY public-read: it serves a public static site with
  # no secrets, no user data, no backend (see README.md / SECURITY.md). We must
  # therefore NOT enable public_access_prevention=enforced — that would block the
  # allUsers grant the site depends on. Leaving it unset uses the project/org
  # default ("inherited"), which the allUsers grant then opens for this bucket.

  force_destroy = false
}

# Public read: anyone can GET objects. This is what makes the static site
# reachable as Cloudflare's fetch origin. objectViewer grants read on objects
# only — it does NOT grant list, write, or admin. Intentional and reviewed:
# a public static site has nothing secret to protect here.
resource "google_storage_bucket_iam_member" "public_read" {
  bucket = google_storage_bucket.website.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}
