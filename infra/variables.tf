# Input variables.
#
# Every structural (non-secret) variable carries a SAFE DEFAULT so a cold
# `terraform validate` (and a future CI `terraform plan`) runs non-interactively
# with no tfvars file. The real per-deploy values live in
# infra/terraform.tfvars.example (copy to the gitignored terraform.tfvars for a
# real plan/apply). No variable here is, or holds, a secret.

variable "project_id" {
  type        = string
  description = "GCP project that hosts the bucket, CDN, and load balancer. Real value: strings-solo-prod."
  default     = "strings-solo-prod"
}

variable "region" {
  type        = string
  description = "GCP region for the website bucket. The LB/CDN/cert are global; only the bucket is regional."
  default     = "us-central1"
}

variable "bucket_name" {
  type        = string
  description = "Globally-unique name for the static website bucket the deploy job syncs to."
  default     = "strings-solo-prod-web"
}

variable "domain" {
  type        = string
  description = <<-EOT
    Apex domain the Google-managed cert and URL map serve. The managed cert
    covers both this apex and its www.<domain> (apex-canonical: www 301s to
    apex). Real value: strings-solo.com. Defaults EMPTY so a cold
    `terraform validate` is non-interactive and the stack's shape is checkable
    before a domain is supplied; a real plan/apply sets it via terraform.tfvars.
  EOT
  default     = ""
}
