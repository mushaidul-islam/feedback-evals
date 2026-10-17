terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.0"
    }
    neon = {
      source  = "kislerdm/neon"
      version = "~> 0.15.0"
    }
    vercel = {
      source  = "vercel/vercel"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

# Tokens come from NEON_API_KEY and VERCEL_API_TOKEN, not Terraform files.
provider "neon" {}

provider "vercel" {
  team = var.vercel_team_id
}
