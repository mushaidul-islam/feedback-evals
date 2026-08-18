package handlers

import (
	"net/http"

	"github.com/mushaidul/truth-be-told/backend/internal/services"
	"github.com/mushaidul/truth-be-told/backend/pkg/utils"
)

type Feedback struct {
	Name string `json:"name"`
	Text string `json:"text"`
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
	input, err := utils.Decode[Feedback](r)
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

	serviceInput := services.CreateFeedbackInput{
		Name: input.Name,
		Text: input.Text,
	}

	result := h.service.CreateFeedback(
		r.Context(),
		serviceInput,
	)

	response := Feedback{
		Name: result.Name,
		Text: result.Text,
	}

	utils.JSON(w, http.StatusOK, response)
}
