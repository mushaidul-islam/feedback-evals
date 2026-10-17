# Deploy Truth Be Told

One Terraform root manages the existing Neon `tbt-db` database, a Go API on Cloud Run, and a
Vercel project. The initial frontend release was uploaded from tracked source
files because the Vercel GitHub installation cannot yet access this repository. No custom modules, VPC,
load balancer, CI pipeline, or custom DNS. The Google Cloud project and billing
account must already exist. This deployment uses `personal-projects-511904`,
which can also hold separate services for other personal apps. Existing Neon data is preserved; local data is not copied.

## 1. Accounts and authentication

Install Terraform 1.14+ and the Google Cloud CLI. A Docker-compatible runtime (OrbStack or Docker Desktop) must be running.
Authenticate to Google Cloud both as a CLI user and for Terraform:

```sh
gcloud auth login
gcloud auth application-default login
```

Link billing to your Google Cloud project. Your identity needs permission to
enable services, create the resources below, and configure their IAM bindings.
Enable these bootstrap APIs once, replacing PROJECT_ID with your real ID:

```sh
gcloud services enable serviceusage.googleapis.com cloudresourcemanager.googleapis.com --project=PROJECT_ID
```

Keep your AWS login active for the existing S3 state backend. Routine work
should use a scoped IAM identity rather than the root identity used during
initial setup. No AWS resources or identities are created here.

In Vercel, install/authorize the GitHub integration for
`mushaidul-islam/feedback-evals` under the team/account you will use. Obtain its
team ID and create a Vercel token. Create a Neon API key under a Free account. The existing `tbt-db` project
(`fancy-smoke-31745326`) has been imported as `neon_project.app`; do not import
it again or create a duplicate. Its six-hour history retention is preserved.
Neon uses the community `kislerdm/neon` provider linked by Neon's API docs;
Google and Vercel use their published providers. Exact versions and checksums
are recorded in `.terraform.lock.hcl`.

From the repository root:

```sh
cd deploy/terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit the three values in `terraform.tfvars`: Google project ID, Vercel team ID,
and your Google OAuth web client ID. The optional `name` controls the backend
resource prefix and must stay unchanged after resources exist. The frontend
project name is `local.frontend_name` in `main.tf`, currently `feedback-tbt`.
Defaults place Google, Neon, and Vercel compute
in Singapore. Set a different Google/Neon region before the first deployment
if needed; the Vercel region is set alongside the project in `main.tf`.

Supply credentials as environment variables. These hidden prompts work in zsh
and keep values out of terminal output and shell history:

```zsh
read -rs 'NEON_API_KEY?Neon API key: '
export NEON_API_KEY
read -rs 'VERCEL_API_TOKEN?Vercel token: '
export VERCEL_API_TOKEN
read -rs 'TF_VAR_google_client_secret?Existing Google OAuth client secret: '
export TF_VAR_google_client_secret
read -rs 'TF_VAR_baseten_api_key?Baseten API key: '
export TF_VAR_baseten_api_key
```

The Google/Baseten values can be reused from your local app configuration.
OAuth now uses the client in `personal-projects-511904` (client ID begins
`716227625668-`), not the original friend-owned client.
Do not put provider tokens in Terraform files or paste secrets into chat.
If you already created a Neon or Vercel project, import it into these resource
addresses before applying instead of creating another project. Import formats
are linked below. Imported Neon projects may require retrieving their existing
role password separately; stop and reconcile the connection URI before applying.

## 2. First backend image

Terraform provisions infrastructure; Docker builds the application. The image
repository must exist before the API can be deployed. Bootstrap only that
repository and its API dependencies on the first run:

```sh
terraform init
terraform fmt -check
terraform validate
terraform plan -target=google_artifact_registry_repository.backend -out=bootstrap.tfplan
terraform apply bootstrap.tfplan
```

Review the plan before applying. Targeting is only for this initial image
bootstrap; subsequent plans must cover the whole configuration.

Build and push from this same directory. Use your configured Google region
instead of `asia-southeast1` if you changed it:

```sh
gcloud auth configure-docker asia-southeast1-docker.pkg.dev
image_ref=$(terraform output -raw backend_image)
docker buildx build --platform linux/amd64 --file ../../backend/deploy/docker/Dockerfile --tag "$image_ref" --push ../../backend
```

The existing Dockerfile produces the Go binary and runs it as a non-root user.
`backend/.dockerignore` excludes local environment files and build artifacts.

## 3. Provision the application

```sh
terraform plan -out=deployment.tfplan
terraform apply deployment.tfplan
terraform output
```

This creates a public HTTPS API. Campaign ownership and creator sign-in are
still enforced by the Go application; anonymous feedback submission remains
public. The API uses a dedicated service account with access to just its two
Secret Manager secrets: the Neon pooled connection URL and Baseten API key.
The frontend gets the API URL and Google OAuth settings for production only.
Preview deployments are disabled so they cannot accidentally write production
feedback. The database and API have deletion protection.

The backend uses its existing startup schema migration behavior
(`DB_AUTO_MIGRATE=true`) to create or update the tables in the Neon database.
Terraform does not introduce a separate migration system.

Add the `google_oauth_callback` output to your Google OAuth client's
Authorized redirect URIs. If the OAuth app is in testing mode, add the accounts
that should be able to sign in as test users.

The first production frontend deployment was uploaded directly through Vercel's
API, using only tracked frontend files and excluding environment files. The
Vercel GitHub integration currently belongs to `Aryan3212`, while this repository
belongs to `mushaidul-islam`. Authorize Vercel for that repository, then add its
`git_repository` settings to `vercel_project.frontend` to enable automatic builds
from `main`. Until then, deploy frontend updates with the Vercel CLI from the
repository root (`bunx vercel --prod`), selecting the existing
`feedback-tbt` project. Its configured root directory is `frontend`.
Environment-variable changes apply only to new deployments.

Verify `/readyz` on the `backend_url`, then sign in at the
`frontend_url`, create a campaign, submit feedback from a private browser
window, and confirm it appears in the creator inbox. Cloud Run intercepts public `/healthz` requests with a Google 404; the same
route works for the internal startup probe. Test real submission and
Google sign-in before sharing the site publicly. The current form shows sent
optimistically and does not report delivery failures.

## Updates and cost

For a backend release, change `image_tag` to a new unique tag, build/push that
image, then run a full Terraform plan/apply. Do not overwrite an existing tag:
Cloud Run resolves tags to image digests when creating a revision. After
changing `image_tag`, build using the new tag from the configured image path;
`terraform output` still shows the previous release until an apply completes.

Cloud Run uses request-based CPU allocation, zero minimum instances, 512 MiB
RAM, concurrency eight, and a maximum of one instance per revision. Neon runs
at 0.25 CU and uses the Free plan’s default idle suspension. These reduce idle costs but are
not a spending cap or a guarantee of free hosting. Builds/images, logs, secret
versions, network traffic, S3, and Baseten usage may be billed. Delete unused
images as releases accumulate. Vercel Hobby must be used within its plan's
personal/non-commercial restrictions.

## State and verification

State is stored at
`s3://tf-state-relearnify/feedback-evals/production.tfstate` in `ap-south-1`.
The existing shared bucket has versioning, AES-256 encryption, and all S3
public-access blocks enabled. This configuration does not own or change the
bucket. S3 locking uses `production.tfstate.tflock`; no DynamoDB table is needed.

Terraform state and saved plans can contain the database password, Baseten key,
and Google client secret even when values are marked sensitive. Anyone with
state access can read them. Provider tokens come from your local environment.
Git ignores state, plans, `.terraform/`, and variable-value files. Commit the
provider lock file and the example variable file.

The infrastructure has been applied in `personal-projects-511904`; a full plan
reports no changes. The API is at
`https://feedback-evals-aryan-api-byoccfdpaa-as.a.run.app` and the frontend at
`https://feedback-tbt.vercel.app`. Database readiness, unauthenticated
route protection, campaign creation, and real feedback processing were checked.
All 12 live collection/sharing browser checks passed at desktop and mobile sizes,
including QR decoding and image downloads. Temporary test records were removed.
Google sign-in uses the client owned by `personal-projects-511904`. The
production callback was accepted and the normal Google sign-in screen was
verified after deployment. Completing an actual account sign-in remains a
manual check; while the OAuth app is in testing, add each tester under Audience.

References:
- [S3 backend](https://developer.hashicorp.com/terraform/language/backend/s3)
- [Google Cloud CLI](https://cloud.google.com/sdk/docs/install)
- [Neon provider and import](https://registry.terraform.io/providers/kislerdm/neon/0.15.0/docs/resources/project)
- [Vercel project and import](https://registry.terraform.io/providers/vercel/vercel/latest/docs/resources/project)


The frontend was renamed to `feedback-tbt` without recreating the API, database,
or image registry. Add `https://feedback-tbt.vercel.app/api/auth/google/callback`
to the Google OAuth client's authorized redirect URIs. Retain the old callback
while old-domain links remain in use. New share links and QR codes use the domain
where the user opens the app, so new cards made on the new domain use the new URL.
