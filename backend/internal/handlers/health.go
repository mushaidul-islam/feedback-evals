package handlers

import (
	"net/http"

	"github.com/mushaidul/truth-be-told/backend/internal/services"
	"github.com/mushaidul/truth-be-told/backend/pkg/utils"
)

// HealthHandler exposes the health service over HTTP.
type HealthHandler struct {
	svc *services.Health
}

// NewHealthHandler builds a HealthHandler.
func NewHealthHandler(svc *services.Health) *HealthHandler {
	return &HealthHandler{svc: svc}
}

// Live handles GET /healthz. Always 200 if the process can serve.
func (h *HealthHandler) Live(w http.ResponseWriter, r *http.Request) {
	utils.JSON(w, http.StatusOK, h.svc.Live(r.Context()))
}

// Ready handles GET /readyz. Returns 503 when a dependency check fails, which
// is what tells a load balancer to stop routing here.
func (h *HealthHandler) Ready(w http.ResponseWriter, r *http.Request) {
	result := h.svc.Ready(r.Context())

	status := http.StatusOK
	if !result.Healthy() {
		status = http.StatusServiceUnavailable
	}

	utils.JSON(w, status, result)
}
