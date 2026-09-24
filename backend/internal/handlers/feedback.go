package handlers

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/mushaidul/truth-be-told/backend/internal/services"
	"github.com/mushaidul/truth-be-told/backend/pkg/utils"
)

type FeedbackHandler struct{ service *services.FeedbackService }

func NewFeedbackHandler(service *services.FeedbackService) *FeedbackHandler {
	return &FeedbackHandler{service: service}
}

func (h *FeedbackHandler) Create(w http.ResponseWriter, r *http.Request) {
	input, err := utils.Decode[struct {
		CampaignID string `json:"campaign_id"`
		Text       string `json:"text"`
	}](r)
	if err != nil {
		utils.Error(w, r, http.StatusBadRequest, utils.CodeInvalidArgument, "Invalid JSON request.")
		return
	}
	id, err := uuid.Parse(input.CampaignID)
	if err != nil {
		utils.Error(w, r, http.StatusBadRequest, utils.CodeInvalidArgument, "Invalid campaign ID.")
		return
	}
	if utf8.RuneCountInString(strings.TrimSpace(input.Text)) < 10 {
		utils.Error(w, r, http.StatusBadRequest, utils.CodeInvalidArgument, "Feedback must be at least 10 characters long.")
		return
	}
	if err := h.service.Submit(r.Context(), id, input.Text); err != nil {
		if errors.Is(err, services.ErrCampaignNotFound) {
			utils.Error(w, r, http.StatusNotFound, utils.CodeNotFound, "Campaign not found.")
			return
		}
		slog.Error("submitting feedback failed", "error", err)
		utils.Error(w, r, http.StatusBadGateway, utils.CodeInternal, "Feedback processing failed. Please try again.")
		return
	}
	utils.JSON(w, http.StatusOK, struct {
		Sent bool `json:"sent"`
	}{Sent: true})
}

type feedbackResponse struct {
	ID         uuid.UUID `json:"id"`
	CampaignID uuid.UUID `json:"campaign_id"`
	Text       string    `json:"text"`
	CreatedAt  time.Time `json:"created_at"`
}

func (h *FeedbackHandler) List(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.URL.Query().Get("campaign_id"))
	if err != nil {
		utils.Error(w, r, http.StatusBadRequest, utils.CodeInvalidArgument, "Invalid campaign ID.")
		return
	}
	feedback, err := h.service.List(r.Context(), id)
	if errors.Is(err, services.ErrCampaignNotFound) {
		utils.Error(w, r, http.StatusNotFound, utils.CodeNotFound, "Campaign not found.")
		return
	}
	if err != nil {
		utils.Error(w, r, http.StatusInternalServerError, utils.CodeInternal, "Could not list feedback.")
		return
	}
	result := make([]feedbackResponse, 0, len(feedback))
	for _, f := range feedback {
		result = append(result, feedbackResponse{ID: f.ID, CampaignID: f.CampaignID, Text: f.Text, CreatedAt: f.CreatedAt})
	}
	utils.JSON(w, http.StatusOK, result)
}
