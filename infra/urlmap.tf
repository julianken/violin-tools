# URL maps for the HTTPS load balancer.
#
# Two routing behaviors:
#
# 1. SPA fallback (200, not 404). The apex's default_service is the Cloud CDN
#    backend bucket. The actual unknown-path -> index.html rewrite happens at
#    the GCS layer via the bucket's `website.not_found_page = "index.html"`
#    (storage.tf): a deep link with no matching object returns index.html with a
#    200, so client-side routing resolves it (DESIGN.md §8.2, §9). The URL map
#    routes apex traffic to that backend; the bucket supplies the SPA 200.
#
# 2. www -> apex 301. A host rule for www.<domain> sends it to a path matcher
#    whose default_url_redirect does a permanent (301) host redirect to the
#    apex. This is the apex-canonical decision from the #39 Cloudflare
#    amendment, and it lives HERE in the GCP URL map (NOT a Cloudflare redirect
#    rule) precisely because Option A's www record is gray-cloud / DNS-only —
#    a Cloudflare redirect rule would require an orange-cloud (proxied) www
#    record, which returns Cloudflare's anycast IP and breaks Google-managed
#    cert validation (FAILED_NOT_VISIBLE).

resource "google_compute_url_map" "default" {
  name        = "${var.bucket_name}-urlmap"
  description = "Violin Tools: apex -> CDN backend bucket (SPA 200 via bucket not_found_page); www -> apex 301."

  # Apex and any other host: serve the static site via the CDN backend bucket.
  default_service = google_compute_backend_bucket.website.id

  # www.<domain>: 301 to the apex.
  host_rule {
    hosts        = [local.www_domain]
    path_matcher = "www-redirect"
  }

  path_matcher {
    name = "www-redirect"

    default_url_redirect {
      host_redirect          = local.apex_domain
      https_redirect         = true
      redirect_response_code = "MOVED_PERMANENTLY_DEFAULT" # 301
      strip_query            = false
    }
  }
}

# HTTP (port 80) URL map: 301 everything to HTTPS on the same host/path.
resource "google_compute_url_map" "https_redirect" {
  name = "${var.bucket_name}-http-redirect"

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT" # 301
    strip_query            = false
  }
}
