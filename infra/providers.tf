# Provider + Terraform version constraints.
#
# `required_version >= 1.5` admits the locally-installed Terraform 1.14.x and
# any CI runner on 1.5+. The google provider is pinned to the 6.x major line:
# the resources this stack uses (google_storage_bucket, the IAM members, and the
# Workload Identity pool/provider) are stable there, and the `.terraform.lock.hcl`
# committed alongside these files pins the exact patch + checksums for
# reproducible CI provider resolution.
terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
