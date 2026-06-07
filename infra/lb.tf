# Global external HTTPS load balancer + Google-managed TLS.
#
# Chain: forwarding rule (443) -> target HTTPS proxy -> URL map -> backend
# bucket (Cloud CDN) -> website bucket. An optional HTTP (80) forwarding rule
# 301-redirects to HTTPS.
#
# DOMAIN HANDLING for a cold, non-interactive validate: the `domain` variable
# defaults EMPTY so `terraform validate` runs with no inputs. The locals below
# resolve a placeholder apex when `domain == ""` so the managed cert's
# `domains` list and the www host rule are always well-formed; a real
# plan/apply sets `domain = "strings-solo.com"` via terraform.tfvars.

locals {
  # Apex used for the cert + URL map. Placeholder keeps a cold validate valid;
  # a real deploy overrides it with the strings-solo.com value.
  apex_domain = var.domain != "" ? var.domain : "example.com"
  www_domain  = "www.${local.apex_domain}"

  # The managed cert covers BOTH apex and www so the www->apex 301 host also
  # has valid TLS (apex-canonical, per the #39 Cloudflare amendment).
  cert_domains = [local.apex_domain, local.www_domain]
}

# Stable global anycast IP for the LB. Cloudflare's apex (and www) A records
# point here, DNS-only / gray-cloud (see infra/README.md) so the Google-managed
# cert can validate against the LB.
resource "google_compute_global_address" "default" {
  name = "${var.bucket_name}-lb-ip"
}

# Recreate the managed cert cleanly when the domain set changes (the canonical
# pattern — a managed cert's `domains` is immutable, so the cert name is keyed
# to the domain list and create_before_destroy avoids a TLS gap).
resource "random_id" "cert" {
  byte_length = 4
  prefix      = "${var.bucket_name}-cert-"

  keepers = {
    domains = join(",", local.cert_domains)
  }
}

resource "google_compute_managed_ssl_certificate" "default" {
  name = random_id.cert.hex

  lifecycle {
    create_before_destroy = true
  }

  managed {
    domains = local.cert_domains
  }
}

resource "google_compute_target_https_proxy" "default" {
  name             = "${var.bucket_name}-https-proxy"
  url_map          = google_compute_url_map.default.id
  ssl_certificates = [google_compute_managed_ssl_certificate.default.id]
}

resource "google_compute_global_forwarding_rule" "https" {
  name                  = "${var.bucket_name}-https-fr"
  target                = google_compute_target_https_proxy.default.id
  ip_address            = google_compute_global_address.default.address
  port_range            = "443"
  load_balancing_scheme = "EXTERNAL_MANAGED"
}

# Optional but standard: redirect plain HTTP (80) to HTTPS so http://apex
# upgrades to https://apex instead of failing.
resource "google_compute_target_http_proxy" "redirect" {
  name    = "${var.bucket_name}-http-proxy"
  url_map = google_compute_url_map.https_redirect.id
}

resource "google_compute_global_forwarding_rule" "http" {
  name                  = "${var.bucket_name}-http-fr"
  target                = google_compute_target_http_proxy.redirect.id
  ip_address            = google_compute_global_address.default.address
  port_range            = "80"
  load_balancing_scheme = "EXTERNAL_MANAGED"
}
