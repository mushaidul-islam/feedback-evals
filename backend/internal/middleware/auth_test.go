package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRequireTestKey(t *testing.T) {
	for _, tc := range []struct {
		name, key string
		want      int
	}{
		{"missing", "", http.StatusUnauthorized},
		{"wrong", "Bearer wrong", http.StatusUnauthorized},
		{"exact", "Bearer test-key", http.StatusNoContent},
	} {
		t.Run(tc.name, func(t *testing.T) {
			h := RequireTestKey(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }))
			r := httptest.NewRequest(http.MethodGet, "/api/v1/campaign", nil)
			r.Header.Set("Authorization", tc.key)
			w := httptest.NewRecorder()
			h.ServeHTTP(w, r)
			if w.Code != tc.want {
				t.Fatalf("status = %d, want %d", w.Code, tc.want)
			}
		})
	}
}
