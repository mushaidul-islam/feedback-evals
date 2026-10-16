package handlers

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/mushaidul/truth-be-told/backend/internal/middleware"
	"github.com/mushaidul/truth-be-told/backend/internal/models"
	"github.com/mushaidul/truth-be-told/backend/internal/services"
	"github.com/mushaidul/truth-be-told/backend/pkg/utils"
)

type CampaignHandler struct{ service *services.CampaignService }

func NewCampaignHandler(service *services.CampaignService) *CampaignHandler {
	return &CampaignHandler{service: service}
}

type campaignResponse struct {
	ID             uuid.UUID                 `json:"id"`
	Name           string                    `json:"name"`
	CreatedAt      time.Time                 `json:"created_at"`
	FeedbackCount  int64                     `json:"feedback_count,omitempty"`
	CreatorName    string                    `json:"creator_name,omitempty"`
	CreatorPicture string                    `json:"creator_picture,omitempty"`
	ContentURL     string                    `json:"content_url,omitempty"`
	Content        *services.CampaignContent `json:"content,omitempty"`
}

func campaignView(c models.Campaign) campaignResponse {
	content, _ := services.ParseCampaignContent(c.ContentURL)
	return campaignResponse{ID: c.ID, Name: c.Name, CreatedAt: c.CreatedAt, ContentURL: c.ContentURL, Content: content}
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
		Name       string `json:"name"`
		ContentURL string `json:"content_url"`
	}](r)
	if err != nil || strings.TrimSpace(input.Name) == "" {
		utils.Error(w, r, http.StatusBadRequest, utils.CodeInvalidArgument, "Campaign name is required.")
		return
	}
	userID, _ := middleware.UserID(r.Context())
	c, err := h.service.CreateCampaign(r.Context(), services.CreateCampaignInput{UserID: userID, Name: strings.TrimSpace(input.Name), ContentURL: input.ContentURL})
	if errors.Is(err, services.ErrInvalidContentURL) {
		utils.Error(w, r, http.StatusBadRequest, utils.CodeInvalidArgument, err.Error())
		return
	}
	if err != nil {
		utils.Error(w, r, http.StatusInternalServerError, utils.CodeInternal, "Could not create campaign.")
		return
	}
	utils.JSON(w, http.StatusCreated, campaignView(c))
}

func (h *CampaignHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserID(r.Context())
	campaigns, err := h.service.ListCampaigns(r.Context(), userID)
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

// Get returns one of the signed-in creator's campaigns.
func (h *CampaignHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, ok := campaignID(w, r)
	if !ok {
		return
	}
	userID, _ := middleware.UserID(r.Context())
	h.respond(w, r, func() (campaignResponse, error) {
		c, err := h.service.GetOwnedCampaign(r.Context(), id, userID)
		return campaignView(c), err
	})
}

// GetPublic returns any campaign's public fields, for the collection page.
func (h *CampaignHandler) GetPublic(w http.ResponseWriter, r *http.Request) {
	id, ok := campaignID(w, r)
	if !ok {
		return
	}
	h.respond(w, r, func() (campaignResponse, error) {
		c, err := h.service.GetPublicCampaign(r.Context(), id)
		response := campaignView(c.Campaign)
		response.CreatorName = strings.TrimSpace(c.CreatorName)
		response.CreatorPicture = c.CreatorPicture
		return response, err
	})
}

func (h *CampaignHandler) respond(w http.ResponseWriter, r *http.Request, load func() (campaignResponse, error)) {
	c, err := load()
	if errors.Is(err, services.ErrCampaignNotFound) {
		utils.Error(w, r, http.StatusNotFound, utils.CodeNotFound, "Campaign not found.")
		return
	}
	if err != nil {
		utils.Error(w, r, http.StatusInternalServerError, utils.CodeInternal, "Could not load campaign.")
		return
	}
	utils.JSON(w, http.StatusOK, c)
}
