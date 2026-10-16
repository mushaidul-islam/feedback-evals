package middleware

import (
	"context"
	"log/slog"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"github.com/mushaidul/truth-be-told/backend/pkg/utils"
)

type userIDKey struct{}

// SessionLookup returns the user a session token belongs to, or an error if
// the token is unknown or expired.
type SessionLookup func(ctx context.Context, token string) (uuid.UUID, error)

// RequireUser rejects requests without a valid session token and puts the
// signed-in user's id on the request context for handlers to read.
func RequireUser(lookup SessionLookup) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token, ok := BearerToken(r)
			if !ok {
				utils.Error(w, r, http.StatusUnauthorized, utils.CodeUnauthorized, "Sign in required.")
				return
			}

			userID, err := lookup(r.Context(), token)
			if err != nil {
				slog.Debug("session rejected", "error", err)
				utils.Error(w, r, http.StatusUnauthorized, utils.CodeUnauthorized, "Sign in required.")
				return
			}

			ctx := context.WithValue(r.Context(), userIDKey{}, userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// UserID returns the signed-in user's id. It is only set on routes behind
// RequireUser.
func UserID(ctx context.Context) (uuid.UUID, bool) {
	id, ok := ctx.Value(userIDKey{}).(uuid.UUID)
	return id, ok
}

// BearerToken reads the token from an "Authorization: Bearer <token>" header.
func BearerToken(r *http.Request) (string, bool) {
	token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
	if !ok || token == "" {
		return "", false
	}
	return token, true
}
