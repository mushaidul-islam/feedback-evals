# Truth Be Told — Backend

Go HTTP API for campaigns and anonymous feedback, with structured logging,
middleware, graceful shutdown, and health checks.

**Stack:** Go 1.26 · [chi](https://github.com/go-chi/chi) router · stdlib
`log/slog` · Postgres 18 · [GORM](https://gorm.io).

---

## 1. Install Go

Needs **Go 1.26+**:

```bash
go version
```

If that prints nothing or a version below 1.26, install from
[go.dev/dl](https://go.dev/dl/) (`brew install go` on macOS).

You do not need an exact patch version — `go.mod` pins `toolchain go1.26.6`, so
any Go 1.21+ downloads the right one on first build.

## 2. Fetch dependencies and start Postgres

Once per clone:

```bash
cd backend
cp .env.example .env
make deps   # adds gorm and its postgres driver
make db-up  # Postgres 18 in Docker, data kept in a named volume
```

The server creates its own tables on startup, so there is no migration step.

## 3. Start the server

```bash
cd backend
cp .env.example .env
make run
```

```
time=2026-08-18T14:32:20.699Z level=INFO msg="server started" addr=0.0.0.0:8080 env=development version=dev
```

The server is listening on **http://localhost:8080**. Leave it running and open
a second terminal.

For automatic rebuilds on save:

```bash
go install github.com/air-verse/air@latest
make dev
```

`make dev` falls back to a plain run if `air` is missing. `make help` lists
every target; `make docker-up` runs the same thing in a container.

## 4. Call the health API

Two endpoints, answering two different questions.

### `GET /healthz` — is the process alive?

```bash
curl localhost:8080/healthz
```

```json
{ "status": "ok", "version": "dev", "uptime": "1m12s" }
```

If you get this, everything works: config loaded, router wired, middleware
running. `version` is the git SHA when built with `make build`, `dev` under
`make run` — that is how you confirm which build is deployed.

This endpoint checks **no** dependencies, deliberately. If it pinged the
database, an outage would make every replica report unhealthy, the orchestrator
would restart all of them, and nothing would be serving when the database came
back.

### `GET /readyz` — should this instance receive traffic?

```bash
curl -i localhost:8080/readyz
```

```json
{
  "status": "ready",
  "checks": [{ "name": "postgres", "ok": true, "latency": "2ms" }]
}
```

This is the endpoint that probes dependencies; when one fails it returns
**503**, which tells a load balancer to stop routing here without restarting
the process.

### Adding a dependency check

One line in `cmd/server.go`:

```go
healthSvc := services.NewHealth(Version,
    services.Check{Name: "postgres", Probe: pool.Ping},
    services.Check{Name: "redis", Probe: redisClient.Ping},
)
```

Checks run concurrently, so latency is the slowest probe rather than the sum:

```json
{
  "status": "not_ready",
  "checks": [
    { "name": "postgres", "ok": true,  "latency": "3ms" },
    { "name": "redis",    "ok": false, "latency": "3s", "error": "dial tcp: i/o timeout" }
  ]
}
```

### Also worth trying

```bash
curl localhost:8080/api/v1/nope          # errors are always JSON, never plain text
curl -i localhost:8080/healthz | grep -i tracing   # every response carries a tracing ID
# Ctrl-C the server and watch it drain instead of dropping connections
```

---

## Campaign feedback API

Campaigns have an ID and a name. The name is also the context sent to the
feedback classifier. Feedback is stored only when the classifier accepts it:
category 1 stores the submitted text, category 2 stores only the rewrite, and
categories 3 and 4 store nothing. All four categories return `{"sent":true}`
to the submitter. The creator-facing API never returns the original text for a
rewritten submission.

Routes are under `/api/v1`:

| Route | Purpose | Sign-in required |
|---|---|---|
| `POST /auth/google` | Exchange `{"credential":"..."}` from Google for a session token | No |
| `GET /auth/me` | The signed-in user | Yes |
| `POST /auth/logout` | End the current session | Yes |
| `GET /campaign/` | Your campaigns and accepted feedback counts | Yes |
| `POST /campaign/` | Create with `{"name":"..."}` | Yes |
| `GET /campaign/{id}` | Campaign detail, yours only | Yes |
| `GET /campaign/{id}/public` | Campaign name for the public form | No |
| `GET /feedback/?campaign_id={id}` | Saved feedback for one of your campaigns | Yes |
| `POST /feedback/` | Submit `{"campaign_id":"...","text":"..."}` | No |

### Sign-in

Creators sign in with Google; submitters never sign in.

1. The Next.js app sends the browser to Google's sign-in page. Google sends it
   back with a one-time code, which the Next.js server trades for an ID token
   -- a short-lived token signed by Google that says who the person is.
2. The Next.js server posts it to `POST /auth/google` as `credential`. This
   server checks Google's signature, that it has not expired, and that it was issued for
   `GOOGLE_CLIENT_ID` -- a credential minted for another website is refused.
3. The user is found or created by their Google `sub` (a permanent account id,
   unlike email), and a session is created. The response carries a random
   session token; only its SHA-256 hash is stored.
4. Next.js keeps that token in an http-only cookie and sends it on as
   `Authorization: Bearer <token>`. Sessions last 30 days.

Each campaign belongs to the creator who made it. Asking for someone else's
campaign returns 404, not 403, so ids cannot be probed to learn what exists.
Campaigns created before sign-in existed have no owner and are no longer
visible to anyone.

Campaign creation accepts an optional `content_url` and `content_type` alongside `name`. The type is `image`, `video`, or `embed`. Image/video types accept public HTTPS direct media links, including URLs without file extensions. Embed supports websites, public Google Drive file links, and recognized social post/video URLs from YouTube, X, TikTok, LinkedIn, Facebook, and Instagram. If the type is omitted, common image/video extensions are recognized and other URLs use embed. Invalid types, schemes, credentials, ports, missing hosts, localhost, and literal private/local IP addresses return 400. Known social-provider links still require a recognized post format; lookalike hosts remain generic websites and never receive a provider icon.

The URL and selected type are stored on the campaign. Individual campaign responses include a `content` object with `type`, `provider`, `url`, and `embed_url` where available. The API constructs provider URLs without fetching remote content, resolving redirects, storing HTML, or checking whether media is accessible. Website fragments and Drive resource keys are retained. Browser rendering and original-link fallbacks handle unavailable content. The classifier still receives only the campaign name and submitted feedback text.

Restart with automatic migration enabled to add the `content_type` column. Its empty default preserves existing campaigns: their type is derived when read. No destructive migration or local database reset is needed. The public response includes the creator's display name/picture and excludes email, Google subject, credentials, and internal user ID. Share-image uploads and local image persistence are frontend-only and add no API endpoints.

`internal/services/campaign_content_test.go` covers supported link forms and
explicit and inferred media types, Drive preview links, websites, and rejected schemes, credentials, ports, local addresses, and invalid provider paths. The existing
campaign integration test also covers type persistence in protected/public reads, invalid types, link persistence, invalid-link
rejection, text-only campaigns, creator names, and public response fields.
These checks pass against a disposable local PostgreSQL database. The integration test requires
`TEST_DATABASE_URL` pointing to a disposable PostgreSQL database.

Run `go test ./...` for unit checks. Set `TEST_DATABASE_URL` to a disposable
Postgres database URL to also run the campaign and feedback integration test.
The test creates and removes its own campaign and feedback rows.

---

## Structure

```
backend/
├── main.go                 # calls cmd.Server()
├── cmd/server.go           # config, wiring, graceful shutdown
├── internal/
│   ├── config/             # env → struct, loaded once
│   ├── database/           # the connection, and the AutoMigrate list
│   ├── models/             # one file per table, the whole schema
│   ├── handlers/           # HTTP layer: router.go + one file per feature
│   ├── services/           # business logic, knows nothing about HTTP
│   └── middleware/         # tracing, logging, recovery, CORS
├── pkg/utils/              # shared HTTP helpers, no app logic
├── deploy/docker/
├── Makefile
└── .env.example
```

Three layers, and each one has a rule:

| Layer | Rule |
|---|---|
| `handlers/` | Decode, delegate, encode. No business logic. |
| `services/` | Business logic. No `net/http`, no status codes. |
| `cmd/server.go` | The only place dependencies are constructed. |

## Adding a feature

1. `internal/services/<name>.go` — the logic, plus whatever types it returns
2. `internal/handlers/<name>.go` — decode → call the service → encode
3. Register routes in `internal/handlers/router.go`
4. Construct it in `cmd/server.go`

Health is the worked example: read those four places and copy the shape.

## Adding a table

`users` is the worked example — three files, open them side by side.

**1. Write the model** in `internal/models/`, one file per table. Copy
`user.go`: uuid primary key filled in by `BeforeCreate`, `CreatedAt` and
`UpdatedAt` named exactly that so GORM maintains them, constraints in the
`gorm` tag.

**2. Register it** in the `AutoMigrate` list in
`internal/database/database.go`. A model that is not in that list has no table.

**3. Write the service** in `internal/services/`, following `user.go`: it holds
`*gorm.DB`, translates GORM errors into its own (`ErrUserNotFound`), and knows
nothing about HTTP. Handlers turn those into status codes.

Then wire it in `cmd/server.go`:

```go
campaignSvc := services.NewCampaignService(db)
campaignHandler := handlers.NewCampaignHandler(campaignSvc)
```

and register the routes in `handlers.NewRouter`.

### One rule about reads

Never send a model straight to the client. Handlers build their own response
struct with only the fields that response needs.

This is not style. The creator's feedback inbox must never carry the original
text of a submission that was rewritten precisely so they would not read it
(see `docs/PHASE_1.md`), and a model struct carries every column by default.
Select the columns you mean, into a struct that holds only those.

### The schema updates itself on startup

`AutoMigrate` creates tables, columns and indexes to match the models. It never
drops or narrows anything, which makes it safe but not complete: renaming a
column or changing its type is beyond it, and needs a hand-written migration.

Fine while the schema is still moving. Worth replacing with real migration
files once there is data no one wants to lose. `DB_AUTO_MIGRATE=false` stops
the server touching the schema at all.

## Decisions, and why

**chi over Gin/Echo/Fiber.** Since Go 1.22 the stdlib router does method and
path matching, which was the main reason to reach for a framework. chi adds
only middleware chaining and sub-routers in ~1k lines with zero dependencies,
and its handlers *are* `http.Handler` — so stdlib and ecosystem middleware
(Sentry, OpenTelemetry) work unmodified, and dropping chi later is a small
change rather than a rewrite. Gin's `*gin.Context` would lock every handler
signature to Gin.

**Config loaded once in `cmd/`, passed down.** No `GetConfig()` singleton
reachable from anywhere. A global config is what makes packages impossible to
test without manipulating process env.

**No `godotenv.Load()` at startup.** `.env` is a developer convenience, not a
deployment mechanism. Loading one at startup means the binary refuses to run in
a container that has none.

**No `ports/` or `domain/` package.** An interface with exactly one
implementation is indirection without substitution. Go's convention is to
declare an interface where it is *consumed* — so when a real seam appears (a
database, say), declare `type Repo interface{...}` in the package that needs
it and pass an implementation in from `cmd/server.go`.

**Three layers, not five.** Layer count should follow from need. Adding
`ports/` and `domain/` before there is a second implementation costs two
directories and buys nothing.

**GORM, and models as the schema.** No separate migration files while the
schema is still moving: the model is the definition, and the server reconciles
the database to it on boot. Fewer places to change, one fewer thing to
remember. The cost is real and named above — AutoMigrate cannot rename or
retype a column — and comes due when there is data worth protecting, not
before.

**Handlers never serialise a model.** The one discipline GORM asks for here.
See the read rule above.

## Not built yet

Campaign editing or deletion and follow-up questions are not part of this
increment. Expired sessions are rejected but never deleted; that table will
need an occasional cleanup once there are real users.

## Relationship to `docs/MVP.md`

`docs/MVP.md` specifies a TypeScript backend on Supabase Edge Functions and
Trigger.dev. This directory contradicts that — an unresolved divergence, not an
oversight (the spec also still says Vite while `frontend/` is Next.js). Worth
deciding before this takes real traffic. The rest of the spec — state machine,
data model, abuse rules — is unaffected by the language choice.

Google sign-in also stores the optional `picture` claim and refreshes it on subsequent sign-ins. Public campaign responses include `creator_picture` when present, alongside `creator_name`; private account fields remain excluded. The existing automatic migration adds the `users.picture` column. Accounts without a photo continue to work and the frontend displays initials. The campaign integration test verifies the picture travels from the verified Google claims through storage to the public response.
