# Static website bucket — the artifact target the deploy job syncs to.
#
# `website.main_page_suffix = "index.html"` serves index.html at the root, and
# `website.not_found_page = "index.html"` is the SPA fallback: when a deep link
# (e.g. /scales/a-major) has no matching object, GCS returns index.html with a
# 200, so client-side routing resolves the path instead of a hard 404. This is
# the static-SPA hosting shape (DESIGN.md §8.2, §9). v1 ships no router, so the
# fallback is forward-prep, not a capability v1 exercises.
resource "google_storage_bucket" "website" {
  name     = var.bucket_name
  location = var.region

  # Static assets are public; no object holds user data (no backend, no PII).
  uniform_bucket_level_access = true

  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html"
  }

  # The bucket only ever holds rebuildable static assets; allow `terraform
  # destroy` to remove it without a manual empty-first step.
  force_destroy = true
}

# Make the bucket's objects publicly readable through the load balancer / CDN.
# This is a static, public web app (README: "no backend, no accounts, no
# personal data") — there is nothing private to expose.
resource "google_storage_bucket_iam_member" "public_read" {
  bucket = google_storage_bucket.website.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}
