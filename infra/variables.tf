# Input variables. Every variable carries a safe default so a cold
# `terraform validate` (and a `terraform plan` in CI) needs no -var flags and
# no terraform.tfvars file. The defaults are the real Phase-A values for this
# instance; override locally via terraform.tfvars (gitignored) if they ever change.

variable "project_id" {
  description = "GCP project ID that owns the website bucket and the WIF resources."
  type        = string
  default     = "strings-solo-prod"
}

variable "region" {
  description = "GCP region for regional resources (the website bucket)."
  type        = string
  default     = "us-central1"
}

variable "bucket_name" {
  description = "Globally-unique name of the public-read website/asset bucket."
  type        = string
  default     = "strings-solo-prod-web"
}

variable "domain" {
  description = <<-EOT
    Public apex domain the site is served on. Informational for this stack —
    TLS, CDN, and DNS live at Cloudflare's edge (not in Terraform), so no GCP
    resource here consumes it; it is surfaced as an output for the Cloudflare
    Worker / DNS step in Phase C and documented in infra/README.md.
  EOT
  type        = string
  default     = "strings-solo.com"
}
