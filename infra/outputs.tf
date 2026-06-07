# Outputs consumed AFTER `terraform apply` (Phase C) to wire the GitHub Actions
# repo variables that deploy.yml reads:
#   WIF_PROVIDER  <- wif_provider
#   DEPLOY_SA     <- deploy_sa_email
# (GCP_PROJECT is already set; the bucket name is in deploy.yml as a var too.)

output "wif_provider" {
  description = "Full resource name of the WIF provider — set as the WIF_PROVIDER Actions variable."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "deploy_sa_email" {
  description = "Email of the keyless deploy service account — set as the DEPLOY_SA Actions variable."
  value       = google_service_account.deploy.email
}

output "website_bucket" {
  description = "Name of the public-read website/asset bucket (rsync target)."
  value       = google_storage_bucket.website.name
}
