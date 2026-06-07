# Remote, locked Terraform state in GCS.
#
# The state bucket itself is bootstrapped ONCE, out of band (it can't store the
# state of the bucket that holds it) — see infra/README.md. It already exists:
#   gs://strings-solo-prod-tfstate  (versioned, for rollback).
#
# `terraform init -backend=false` skips this block entirely, which is how the
# cold `terraform validate` (and CI) run with no GCP credentials.
terraform {
  backend "gcs" {
    bucket = "strings-solo-prod-tfstate"
    prefix = "violin-tools/state"
  }
}
