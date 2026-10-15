package middleware

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
)

func TestRequireUser(t *testing.T) {
	want := uuid.New()
	lookup := func(_ context.Context, token string) (uuid.UUID, error) {
		if token == "good-token" {
			return want, nil
		}
		return uuid.Nil, errors.New("unknown session")
	}

	for _, tc := range []struct {
		name, header string
		status       int
	}{
		{"missing", "", http.StatusUnauthorized},
		{"not bearer", "Basic good-token", http.StatusUnauthorized},
		{"empty bearer", "Bearer ", http.StatusUnauthorized},
		{"unknown token", "Bearer bad-token", http.StatusUnauthorized},
		{"valid token", "Bearer good-token", http.StatusNoContent},
	} {
		t.Run(tc.name, func(t *testing.T) {
			h := RequireUser(lookup)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if got, ok := UserID(r.Context()); !ok || got != want {
					t.Errorf("user id = %v, %v; want %v", got, ok, want)
				}
				w.WriteHeader(http.StatusNoContent)
			}))
			r := httptest.NewRequest(http.MethodGet, "/api/v1/campaign", nil)
			if tc.header != "" {
				r.Header.Set("Authorization", tc.header)
			}
			w := httptest.NewRecorder()
			h.ServeHTTP(w, r)
			if w.Code != tc.status {
				t.Fatalf("status = %d, want %d", w.Code, tc.status)
			}
		})
	}
}
