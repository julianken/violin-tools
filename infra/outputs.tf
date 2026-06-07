# Outputs Phase C reads after the first `terraform apply` to finish wiring:
#   - lb_ip            -> the Cloudflare apex/www A records (gray-cloud) + the
#                         post-deploy liveness check.
#   - wif_provider     -> the GitHub Actions `WIF_PROVIDER` repo variable.
#   - deploy_sa_email  -> the GitHub Actions `DEPLOY_SA` repo variable.
#   - website_bucket   -> the deploy job's rsync target (`GCS_BUCKET`).
#   - url_map_name     -> the deploy job's `invalidate-cdn-cache` target.

output "lb_ip" {
  description = "Global external HTTPS load balancer IP. Point Cloudflare apex (+ www) A records here, DNS-only (gray-cloud)."
  value       = google_compute_global_address.default.address
}

output "wif_provider" {
  description = "Full WIF provider resource name for the GitHub Actions WIF_PROVIDER repo variable."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "deploy_sa_email" {
  description = "Deploy service account email for the GitHub Actions DEPLOY_SA repo variable."
  value       = google_service_account.deploy.email
}

output "website_bucket" {
  description = "Website bucket name — the deploy job's rsync target (GCS_BUCKET repo variable)."
  value       = google_storage_bucket.website.name
}

output "url_map_name" {
  description = "URL map name — the deploy job's invalidate-cdn-cache target."
  value       = google_compute_url_map.default.name
}
