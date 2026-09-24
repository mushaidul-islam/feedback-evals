package handlers

import (
	"log/slog"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/mushaidul/truth-be-told/backend/internal/services"
	"github.com/mushaidul/truth-be-told/backend/pkg/utils"
)

type createFeedbackRequest struct {
	Text                string `json:"text"`
	CampaignDescription string `json:"campaign_description"`
}

type Feedback struct {
	Text     string  `json:"text"`
	Category int     `json:"category"`
	Rewrite  *string `json:"rewrite"`
}

type AppHandler struct {
	service *services.AppService
}

func NewAppHandler(service *services.AppService) *AppHandler {
	return &AppHandler{
		service: service,
	}
}

func (h *AppHandler) CreateFeedback(w http.ResponseWriter, r *http.Request) {
	input, err := utils.Decode[createFeedbackRequest](r)
	if err != nil {
		utils.Error(
			w,
			r,
			http.StatusBadRequest,
			utils.CodeInvalidArgument,
			"Invalid JSON request.",
		)
		return
	}
	if utf8.RuneCountInString(strings.TrimSpace(input.Text)) < 10 {
		utils.Error(w, r, http.StatusBadRequest, utils.CodeInvalidArgument, "Feedback must be at least 10 characters long.")
		return
	}
	if strings.TrimSpace(input.CampaignDescription) == "" {
		utils.Error(w, r, http.StatusBadRequest, utils.CodeInvalidArgument, "Campaign description is required.")
		return
	}

	serviceInput := services.CreateFeedbackInput{
		Text:                input.Text,
		CampaignDescription: input.CampaignDescription,
	}

	result, err := h.service.CreateFeedback(
		r.Context(),
		serviceInput,
	)
	if err != nil {
		slog.Error("creating feedback failed", "error", err)
		utils.Error(w, r, http.StatusBadGateway, utils.CodeInternal, "Feedback processing failed. Please try again.")
		return
	}

	response := Feedback{
		Text:     result.Text,
		Category: result.Category,
		Rewrite:  result.Rewrite,
	}

	utils.JSON(w, http.StatusOK, response)
}
