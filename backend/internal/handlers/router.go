// Package handlers holds the HTTP transport layer and the route table.
package handlers

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/mushaidul/truth-be-told/backend/internal/config"
	"github.com/mushaidul/truth-be-told/backend/internal/middleware"
	"github.com/mushaidul/truth-be-told/backend/internal/services"
	"github.com/mushaidul/truth-be-told/backend/pkg/utils"
)

// NewRouter builds the router. The whole route table lives in this one
// function, so "where is this endpoint handled?" is one screen to answer.
func NewRouter(cnf config.Config, log *slog.Logger, healthSvc *services.Health) http.Handler {
	r := chi.NewRouter()

	// Order matters: Tracing first so later log lines carry a correlation ID,
	// Recovery before the handlers so a panic still returns JSON.
	r.Use(middleware.Tracing)
	r.Use(middleware.Logger(log))
	r.Use(middleware.Recovery(log))
	r.Use(middleware.CORS(cnf.AllowedOrigins))

	// chi's defaults emit plain text, which breaks a client expecting JSON.
	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		utils.Error(w, r, http.StatusNotFound, utils.CodeNotFound,
			"The requested resource does not exist.")
	})
	r.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) {
		utils.Error(w, r, http.StatusMethodNotAllowed, utils.CodeInvalidArgument,
			"That method is not allowed for this resource.")
	})

	health := NewHealthHandler(healthSvc)

	// Operational endpoints sit outside /api/v1 — they are not part of the
	// versioned API contract.
	r.Get("/healthz", health.Live)
	r.Get("/readyz", health.Ready)

	r.Route("/api/v1", func(r chi.Router) {
		// Business routes mount here. See README, "Adding a feature".
		_ = r
	})

	return r
}
