# Remote Terraform state in the pre-existing, versioned GCS bucket.
# The bucket itself is bootstrapped out-of-band (Phase A: manual) — it must
# exist before `terraform init` connects to it. State for this stack lives
# under the `violin-tools/state` prefix so the bucket can host other states later.
#
# Cold validation (`terraform init -backend=false`) skips this backend entirely,
# so `terraform validate` runs offline without GCP credentials.
terraform {
  backend "gcs" {
    bucket = "strings-solo-prod-tfstate"
    prefix = "violin-tools/state"
  }
}
