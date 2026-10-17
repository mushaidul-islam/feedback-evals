variable "gcp_project_id" {
  description = "Existing Google Cloud project with billing enabled."
  type        = string
}

variable "name" {
  description = "Backend resource name. Keep unchanged after the first deployment."
  type        = string
  default     = "feedback-evals-aryan"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,24}[a-z0-9]$", var.name))
    error_message = "Use a lowercase slug between 6 and 26 characters."
  }
}

variable "gcp_region" {
  type    = string
  default = "asia-southeast1"
}

variable "neon_region" {
  type    = string
  default = "aws-ap-southeast-1"
}

variable "vercel_team_id" {
  description = "Vercel team/account scope that can access the GitHub repository."
  type        = string
}

variable "image_tag" {
  description = "Use a new tag for each backend release; push the image before applying."
  type        = string
  default     = "initial"
}

variable "google_client_id" {
  description = "Existing Google OAuth web client ID, shared by the frontend and API."
  type        = string
}

variable "google_client_secret" {
  type      = string
  sensitive = true
}

variable "baseten_api_key" {
  type      = string
  sensitive = true
}
