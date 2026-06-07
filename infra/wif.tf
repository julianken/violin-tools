# Keyless CI deploy via Workload Identity Federation (WIF). GitHub Actions on
# this repo's `main` branch mints a short-lived GCP token by exchanging its OIDC
# token — NO service-account JSON key is ever created, committed, or stored.
#
# The deploy SA's only power is roles/storage.admin (it rsyncs the built site to
# the bucket). There is no compute role: there is no load balancer to manage.

# Project number is needed to build the workloadIdentityUser principalSet.
data "google_project" "this" {
  project_id = var.project_id
}

# The pool that holds the GitHub OIDC provider.
resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = "github-actions-pool"
  display_name              = "GitHub Actions pool"
  description               = "WIF pool for keyless GitHub Actions deploys (violin-tools)."
}

# The GitHub Actions OIDC provider. The attribute_condition is the security
# boundary: only tokens from this exact repo, on the main branch, may assume the
# deploy SA. attribute_mapping exposes repository/ref so the condition can match
# and so the SA binding's principalSet can scope to the repository.
resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-actions-provider"
  display_name                       = "GitHub Actions OIDC"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  # Only this repo, only the main branch.
  attribute_condition = "assertion.repository=='julianken/violin-tools' && assertion.ref=='refs/heads/main'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# The CI deploy identity.
resource "google_service_account" "deploy" {
  project      = var.project_id
  account_id   = "gha-deploy"
  display_name = "GitHub Actions deploy (violin-tools)"
  description  = "Keyless WIF deploy SA — rsyncs the built site to the website bucket. Storage-only."
}

# Its ONLY role: storage.admin (rsync + delete-unmatched needs object write +
# delete + metadata; admin is the standard role for a bucket sync deployer).
# Deliberately NO compute role — there is no load balancer in this architecture.
resource "google_project_iam_member" "deploy_storage_admin" {
  project = var.project_id
  role    = "roles/storage.admin"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

# Let any GitHub Actions run from THIS repo impersonate the deploy SA. The
# principalSet is scoped by attribute.repository, so only julianken/violin-tools
# tokens (further narrowed to main by the provider's attribute_condition) can
# assume the SA. The principalSet path uses the project NUMBER (from
# data.google_project), not the project ID.
resource "google_service_account_iam_member" "deploy_wif" {
  service_account_id = google_service_account.deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/projects/${data.google_project.this.number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github.workload_identity_pool_id}/attribute.repository/julianken/violin-tools"
}
