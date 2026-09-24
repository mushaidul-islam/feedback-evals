package handlers

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/mushaidul/truth-be-told/backend/internal/models"
	"github.com/mushaidul/truth-be-told/backend/internal/services"
	"github.com/mushaidul/truth-be-told/backend/pkg/utils"
)

type CampaignHandler struct{ service *services.CampaignService }

func NewCampaignHandler(service *services.CampaignService) *CampaignHandler {
	return &CampaignHandler{service: service}
}

type campaignResponse struct {
	ID            uuid.UUID `json:"id"`
	Name          string    `json:"name"`
	CreatedAt     time.Time `json:"created_at"`
	FeedbackCount int64     `json:"feedback_count,omitempty"`
}

func campaignView(c models.Campaign) campaignResponse {
	return campaignResponse{ID: c.ID, Name: c.Name, CreatedAt: c.CreatedAt}
}

func campaignID(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.Error(w, r, http.StatusBadRequest, utils.CodeInvalidArgument, "Invalid campaign ID.")
		return uuid.Nil, false
	}
	return id, true
}

func (h *CampaignHandler) Create(w http.ResponseWriter, r *http.Request) {
	input, err := utils.Decode[struct {
		Name string `json:"name"`
	}](r)
	if err != nil || strings.TrimSpace(input.Name) == "" {
		utils.Error(w, r, http.StatusBadRequest, utils.CodeInvalidArgument, "Campaign name is required.")
		return
	}
	c, err := h.service.CreateCampaign(r.Context(), services.CreateCampaignInput{Name: strings.TrimSpace(input.Name)})
	if err != nil {
		utils.Error(w, r, http.StatusInternalServerError, utils.CodeInternal, "Could not create campaign.")
		return
	}
	utils.JSON(w, http.StatusCreated, campaignView(c))
}

func (h *CampaignHandler) List(w http.ResponseWriter, r *http.Request) {
	campaigns, err := h.service.ListCampaigns(r.Context())
	if err != nil {
		utils.Error(w, r, http.StatusInternalServerError, utils.CodeInternal, "Could not list campaigns.")
		return
	}
	result := make([]campaignResponse, 0, len(campaigns))
	for _, c := range campaigns {
		result = append(result, campaignResponse{ID: c.ID, Name: c.Name, CreatedAt: c.CreatedAt, FeedbackCount: c.FeedbackCount})
	}
	utils.JSON(w, http.StatusOK, result)
}

func (h *CampaignHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, ok := campaignID(w, r)
	if !ok {
		return
	}
	c, err := h.service.GetCampaign(r.Context(), id)
	if errors.Is(err, services.ErrCampaignNotFound) {
		utils.Error(w, r, http.StatusNotFound, utils.CodeNotFound, "Campaign not found.")
		return
	}
	if err != nil {
		utils.Error(w, r, http.StatusInternalServerError, utils.CodeInternal, "Could not load campaign.")
		return
	}
	utils.JSON(w, http.StatusOK, campaignView(c))
}
