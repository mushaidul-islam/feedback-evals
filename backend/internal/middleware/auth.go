package middleware

import (
	"net/http"

	"github.com/mushaidul/truth-be-told/backend/pkg/utils"
)

// RequireTestKey is a temporary check for creator-facing API routes.
func RequireTestKey(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-key" {
			utils.Error(w, r, http.StatusUnauthorized, utils.CodeUnauthorized, "Unauthorized.")
			return
		}
		next.ServeHTTP(w, r)
	})
}
