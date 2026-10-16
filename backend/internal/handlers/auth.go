package handlers

import (
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/mushaidul/truth-be-told/backend/internal/middleware"
	"github.com/mushaidul/truth-be-told/backend/internal/models"
	"github.com/mushaidul/truth-be-told/backend/internal/services"
	"github.com/mushaidul/truth-be-told/backend/pkg/utils"
)

type AuthHandler struct {
	auth  *services.AuthService
	users *services.UserService
}

func NewAuthHandler(auth *services.AuthService, users *services.UserService) *AuthHandler {
	return &AuthHandler{auth: auth, users: users}
}

type userResponse struct {
	ID    uuid.UUID `json:"id"`
	Email string    `json:"email"`
	Name  string    `json:"name"`
}

func userView(u models.User) userResponse {
	return userResponse{ID: u.ID, Email: u.Email, Name: u.Name}
}

// Google exchanges the credential from the "Sign in with Google" button for
// a session token.
func (h *AuthHandler) Google(w http.ResponseWriter, r *http.Request) {
	input, err := utils.Decode[struct {
		Credential string `json:"credential"`
	}](r)
	if err != nil || input.Credential == "" {
		utils.Error(w, r, http.StatusBadRequest, utils.CodeInvalidArgument, "A Google credential is required.")
		return
	}

	result, err := h.auth.SignInWithGoogle(r.Context(), input.Credential)
	if errors.Is(err, services.ErrInvalidCredential) {
		slog.Info("google sign-in rejected", "error", err)
		utils.Error(w, r, http.StatusUnauthorized, utils.CodeUnauthorized, "Google sign-in failed.")
		return
	}
	if err != nil {
		slog.Error("google sign-in failed", "error", err)
		utils.Error(w, r, http.StatusInternalServerError, utils.CodeInternal, "Could not sign in.")
		return
	}

	utils.JSON(w, http.StatusOK, struct {
		Token     string       `json:"token"`
		ExpiresAt time.Time    `json:"expires_at"`
		User      userResponse `json:"user"`
	}{Token: result.Token, ExpiresAt: result.ExpiresAt, User: userView(result.User)})
}

// Me returns the signed-in user.
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	id, _ := middleware.UserID(r.Context())

	user, err := h.users.GetUser(r.Context(), id)
	if errors.Is(err, services.ErrUserNotFound) {
		utils.Error(w, r, http.StatusUnauthorized, utils.CodeUnauthorized, "Sign in required.")
		return
	}
	if err != nil {
		utils.Error(w, r, http.StatusInternalServerError, utils.CodeInternal, "Could not load user.")
		return
	}

	utils.JSON(w, http.StatusOK, userView(user))
}

// Logout ends the current session.
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	token, _ := middleware.BearerToken(r)

	if err := h.auth.SignOut(r.Context(), token); err != nil {
		utils.Error(w, r, http.StatusInternalServerError, utils.CodeInternal, "Could not sign out.")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
