# Provider + Terraform version pins. Pinned versions keep `terraform init`
# deterministic across agents and machines.
#
# required_version admits Terraform 1.14.x (the toolchain this repo uses) while
# staying compatible back to 1.5 (the first version with `import` blocks, which
# the state-bucket bootstrap narrative references).
terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.41"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
