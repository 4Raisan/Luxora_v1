terraform {
  required_version = ">= 1.6"
  required_providers {
    google = { source = "hashicorp/google", version = ">= 6.0, < 8.0" }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

variable "project_id" { type = string }
variable "region" {
  type    = string
  default = "asia-south1"
}
variable "images" {
  description = "Immutable image URLs/digests for accounts, bookings, payments, engagement, gateway, and jobs."
  type        = map(string)
  validation {
    condition     = alltrue([for name in ["accounts", "bookings", "payments", "engagement", "gateway", "jobs"] : contains(keys(var.images), name)])
    error_message = "Supply an image for every service and jobs."
  }
}
variable "secrets" {
  description = "Environment name => existing Secret Manager secret ID. Values never enter Terraform state."
  type        = map(string)
  validation {
    condition     = alltrue([for name in ["DATABASE_URL", "DIRECT_URL", "JWT_SECRET", "BANK_ENCRYPTION_KEY", "REDIS_URL", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] : contains(keys(var.secrets), name)])
    error_message = "Database, direct migration URL, signing/banking, Redis and object-storage credential references are required."
  }
}
variable "environment" {
  description = "Non-secret configuration: FRONTEND_URL, CORS_ORIGIN, S3_BUCKET, S3_REGION/ENDPOINT, gateway settings, etc. Never put credentials here."
  type        = map(string)
  validation {
    condition     = contains(keys(var.environment), "S3_BUCKET") && contains(keys(var.environment), "FRONTEND_URL") && contains(keys(var.environment), "CORS_ORIGIN")
    error_message = "Configure durable storage and explicit frontend origins."
  }
}
variable "max_instances" {
  type    = number
  default = 3
  validation {
    condition     = var.max_instances >= 1 && var.max_instances <= 20
    error_message = "Set a connection-budgeted instance limit between 1 and 20."
  }
}
variable "schedulers_paused" {
  description = "Keep schedules paused for initial migration/smoke checks; set false for cutover."
  type        = bool
  default     = true
}

locals {
  domains = toset(["accounts", "bookings", "payments", "engagement"])
  jobs = {
    booking-timeouts = "* * * * *"
    demo-renewals    = "0 * * * *"
    monthly-payouts  = "0 23 28-31 * *"
  }
  runtime_env = merge(var.environment, {
    NODE_ENV    = "production", LUXORA_RUNTIME = "serverless", TZ = "Asia/Colombo",
    TRUST_PROXY = "1", PRISMA_CONNECTION_LIMIT = "3", PAYOUT_SCHEDULER_ENABLED = "false"
  })
}

resource "google_project_service" "apis" {
  for_each           = toset(["run.googleapis.com", "cloudscheduler.googleapis.com", "secretmanager.googleapis.com", "artifactregistry.googleapis.com"])
  service            = each.value
  disable_on_destroy = false
}

resource "google_service_account" "runtime" {
  for_each   = toset(concat(tolist(local.domains), ["gateway", "jobs", "scheduler"]))
  account_id = "luxora-${each.key}"
}

resource "google_secret_manager_secret_iam_member" "runtime" {
  for_each   = { for pair in setproduct(concat(tolist(local.domains), ["jobs"]), keys(var.secrets)) : "${pair[0]}-${pair[1]}" => { identity = pair[0], secret = var.secrets[pair[1]] } }
  secret_id  = each.value.secret
  role       = "roles/secretmanager.secretAccessor"
  member     = "serviceAccount:${google_service_account.runtime[each.value.identity].email}"
  depends_on = [google_project_service.apis]
}

resource "google_cloud_run_v2_service" "domain" {
  for_each            = local.domains
  name                = "luxora-${each.key}"
  location            = var.region
  deletion_protection = true
  template {
    service_account                  = google_service_account.runtime[each.key].email
    timeout                          = "3600s"
    max_instance_request_concurrency = 20
    scaling {
      min_instance_count = 0
      max_instance_count = var.max_instances
    }
    containers {
      image   = var.images[each.key]
      command = ["node", "backend/src/index.js"]
      ports { container_port = 8080 }
      resources {
        limits            = { cpu = "1", memory = "512Mi" }
        cpu_idle          = true
        startup_cpu_boost = true
      }
      dynamic "env" {
        for_each = merge(local.runtime_env, { LUXORA_SERVICE = each.key })
        content {
          name  = env.key
          value = env.value
        }
      }
      dynamic "env" {
        for_each = var.secrets
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value
              version = "latest"
            }
          }
        }
      }
      startup_probe {
        http_get { path = "/healthz" }
        initial_delay_seconds = 2
        period_seconds        = 5
        failure_threshold     = 20
      }
    }
  }
  depends_on = [google_project_service.apis, google_secret_manager_secret_iam_member.runtime]
}

resource "google_cloud_run_v2_service_iam_member" "gateway_invokes" {
  for_each = local.domains
  name     = google_cloud_run_v2_service.domain[each.key].name
  location = var.region
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.runtime["gateway"].email}"
}

resource "google_cloud_run_v2_service" "gateway" {
  name                = "luxora-gateway"
  location            = var.region
  deletion_protection = true
  template {
    service_account = google_service_account.runtime["gateway"].email
    timeout         = "3600s"
    scaling { max_instance_count = var.max_instances }
    containers {
      image   = var.images["gateway"]
      command = ["node", "backend/src/gateway.js"]
      ports { container_port = 8080 }
      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "TRUST_PROXY"
        value = "1"
      }
      env {
        name  = "CLOUD_RUN_IDENTITY"
        value = "true"
      }
      dynamic "env" {
        for_each = local.domains
        content {
          name  = "${upper(env.value)}_SERVICE_URL"
          value = google_cloud_run_v2_service.domain[env.value].uri
        }
      }
    }
  }
  depends_on = [google_cloud_run_v2_service_iam_member.gateway_invokes]
}

resource "google_cloud_run_v2_service_iam_member" "public_gateway" {
  name     = google_cloud_run_v2_service.gateway.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_job" "worker" {
  for_each = merge({ for name, schedule in local.jobs : name => ["node", "backend/src/jobs.js", name] }, {
    migrate = ["node", "backend/node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "backend/prisma/schema.prisma"]
  })
  name                = "luxora-${each.key}"
  location            = var.region
  deletion_protection = true
  template {
    task_count = 1
    template {
      service_account = google_service_account.runtime["jobs"].email
      max_retries     = 2
      timeout         = "600s"
      containers {
        image   = var.images["jobs"]
        command = each.value
        dynamic "env" {
          for_each = local.runtime_env
          content {
            name  = env.key
            value = env.value
          }
        }
        dynamic "env" {
          for_each = var.secrets
          content {
            name = env.key
            value_source {
              secret_key_ref {
                secret  = env.value
                version = "latest"
              }
            }
          }
        }
      }
    }
  }
  depends_on = [google_project_service.apis, google_secret_manager_secret_iam_member.runtime]
}

resource "google_cloud_run_v2_job_iam_member" "scheduler" {
  for_each = local.jobs
  name     = google_cloud_run_v2_job.worker[each.key].name
  location = var.region
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.runtime["scheduler"].email}"
}

resource "google_cloud_scheduler_job" "worker" {
  for_each  = local.jobs
  name      = "luxora-${each.key}"
  region    = var.region
  schedule  = each.value
  paused    = var.schedulers_paused
  time_zone = "Asia/Colombo"
  retry_config { retry_count = 3 }
  http_target {
    http_method = "POST"
    uri         = "https://run.googleapis.com/v2/projects/${var.project_id}/locations/${var.region}/jobs/${google_cloud_run_v2_job.worker[each.key].name}:run"
    oauth_token { service_account_email = google_service_account.runtime["scheduler"].email }
  }
  depends_on = [google_cloud_run_v2_job_iam_member.scheduler]
}

output "gateway_url" { value = google_cloud_run_v2_service.gateway.uri }
output "service_urls" { value = { for name, service in google_cloud_run_v2_service.domain : name => service.uri } }
