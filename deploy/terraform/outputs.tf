output "backend_image" {
  value = local.image
}

output "backend_url" {
  value = google_cloud_run_v2_service.backend.uri
}

output "frontend_url" {
  value = local.frontend_url
}

output "google_oauth_callback" {
  value = "${local.frontend_url}/api/auth/google/callback"
}
