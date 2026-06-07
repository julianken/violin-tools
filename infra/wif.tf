# Keyless CI/CD via Workload Identity Federation (WIF).
#
# GitHub Actions presents a short-lived OIDC token; GCP exchanges it for a
# scoped, short-lived access token impersonating the deploy service account. NO
# service-account JSON key is created or exported anywhere — the trust is a
# config relationship, not a stored credential (AGENTS.md no-secrets posture /
# SECURITY.md). This is Path 2: Terraform CREATES the pool, provider, SA, and
# IAM (they are NOT pre-created, so there are no `import` blocks).

# Project number is needed for the principalSet path (it embeds the NUMBER, not
# the id). data.google_project resolves it from the configured project.
data "google_project" "this" {
  project_id = var.project_id
}

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github-actions"
  display_name              = "GitHub Actions"
  description               = "Keyless OIDC federation for julianken/violin-tools CI/CD."
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  display_name                       = "GitHub OIDC"
  description                        = "GitHub Actions OIDC provider, restricted to this repo on main."

  # Restrict, at the provider level, which credentials may federate at all:
  # only this repo, only the main branch. Belt-and-suspenders with the SA
  # binding's repo-scoped principalSet below.
  attribute_condition = "assertion.repository=='julianken/violin-tools' && assertion.ref=='refs/heads/main'"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# The identity CI impersonates. No key resource — WIF only.
resource "google_service_account" "deploy" {
  account_id   = "violin-tools-deploy"
  display_name = "Violin Tools CI/CD deploy (keyless, WIF)"
  description  = "Impersonated by GitHub Actions via WIF to build+sync the static site and invalidate the CDN."
}

# Deploy permissions on the project:
#   - roles/storage.admin   : write objects to the website bucket (rsync).
#   - roles/compute.admin   : manage the LB/CDN AND invalidate the CDN cache
#                             (compute.admin includes compute.urlMaps.invalidateCache,
#                             which the deploy job's `invalidate-cdn-cache` step needs).
resource "google_project_iam_member" "deploy_storage" {
  project = var.project_id
  role    = "roles/storage.admin"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

resource "google_project_iam_member" "deploy_compute" {
  project = var.project_id
  role    = "roles/compute.admin"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

# Bind the federated principal to the deploy SA: only identities from THIS repo
# (attribute.repository == julianken/violin-tools) may impersonate it. The
# provider's attribute_condition further pins this to the main ref. The pool's
# computed `name` embeds the project NUMBER (48440654897), as the principalSet
# path requires.
resource "google_service_account_iam_member" "wif_impersonation" {
  service_account_id = google_service_account.deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/julianken/violin-tools"
}
