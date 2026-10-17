locals {
  frontend_name = "feedback-tbt"
  frontend_url  = "https://${local.frontend_name}.vercel.app"
  image         = "${var.gcp_region}-docker.pkg.dev/${var.gcp_project_id}/${var.name}/backend:${var.image_tag}"
  backend_secrets = {
    database-url = neon_project.app.connection_uri_pooler
    baseten-key  = var.baseten_api_key
  }
}

resource "google_project_service" "api" {
  for_each = toset([
    "artifactregistry.googleapis.com",
    "iam.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
  ])
  service            = each.key
  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "backend" {
  location      = var.gcp_region
  repository_id = var.name
  format        = "DOCKER"
  depends_on    = [google_project_service.api]
}

# Imported existing project; preserve its database, role, and production branch.
resource "neon_project" "app" {
  name                      = "tbt-db"
  region_id                 = var.neon_region
  history_retention_seconds = 21600

  default_endpoint_settings {
    autoscaling_limit_min_cu = 0.25
    autoscaling_limit_max_cu = 0.25
    suspend_timeout_seconds  = 0 # Free plan uses Neon's default idle suspension.
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_service_account" "backend" {
  account_id = "${var.name}-api"
  depends_on = [google_project_service.api]
}

resource "google_secret_manager_secret" "backend" {
  for_each  = toset(["database-url", "baseten-key"])
  secret_id = "${var.name}-${each.key}"
  replication {
    auto {}
  }
  depends_on = [google_project_service.api]
}

resource "google_secret_manager_secret_version" "backend" {
  for_each    = toset(["database-url", "baseten-key"])
  secret      = google_secret_manager_secret.backend[each.key].id
  secret_data = local.backend_secrets[each.key]
}

resource "google_secret_manager_secret_iam_member" "backend" {
  for_each  = toset(["database-url", "baseten-key"])
  secret_id = google_secret_manager_secret.backend[each.key].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.backend.email}"
}

resource "google_cloud_run_v2_service" "backend" {
  name                = "${var.name}-api"
  location            = var.gcp_region
  deletion_protection = true

  # Routes enforce app authentication; the feedback submission route is public.
  invoker_iam_disabled = true

  template {
    service_account                  = google_service_account.backend.email
    timeout                          = "60s"
    max_instance_request_concurrency = 8

    scaling {
      min_instance_count = 0
      max_instance_count = 1
    }

    containers {
      image = local.image
      ports {
        container_port = 8080
      }
      resources {
        limits            = { cpu = "1", memory = "512Mi" }
        cpu_idle          = true
        startup_cpu_boost = true
      }
      startup_probe {
        http_get {
          path = "/healthz"
          port = 8080
        }
      }
      dynamic "env" {
        for_each = {
          APP_ENV              = "production"
          GOOGLE_CLIENT_ID     = var.google_client_id
          CORS_ALLOWED_ORIGINS = local.frontend_url
          DB_AUTO_MIGRATE      = "true"
        }
        content {
          name  = env.key
          value = env.value
        }
      }
      dynamic "env" {
        for_each = { DATABASE_URL = "database-url", BASETEN_API_KEY = "baseten-key" }
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.backend[env.value].secret_id
              version = google_secret_manager_secret_version.backend[env.value].version
            }
          }
        }
      }
    }
  }

  depends_on = [google_secret_manager_secret_iam_member.backend, google_artifact_registry_repository.backend]
}

resource "vercel_project" "frontend" {
  name           = local.frontend_name
  framework      = "nextjs"
  root_directory = "frontend"
  # Link GitHub after its Vercel installation can access the repository.
  # Preview deployments never receive production credentials.
  preview_deployments_disabled = true
  resource_config = {
    function_default_regions = ["sin1"]
  }
}

resource "vercel_project_environment_variable" "frontend" {
  for_each   = toset(["API_URL", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"])
  project_id = vercel_project.frontend.id
  key        = each.key
  value = {
    API_URL              = google_cloud_run_v2_service.backend.uri
    GOOGLE_CLIENT_ID     = var.google_client_id
    GOOGLE_CLIENT_SECRET = var.google_client_secret
  }[each.key]
  target    = ["production"]
  sensitive = each.key == "GOOGLE_CLIENT_SECRET"
}
