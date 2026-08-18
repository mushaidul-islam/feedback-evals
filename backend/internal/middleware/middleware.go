// Package middleware holds cross-cutting HTTP concerns. Everything here is
// func(http.Handler) http.Handler — the stdlib shape — so anything from the
// ecosystem (Sentry, OpenTelemetry) drops into the chain with no adapter.
package middleware

import (
	"log/slog"
	"net/http"
	"runtime/debug"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/mushaidul/truth-be-told/backend/pkg/utils"
)

// Tracing assigns each request a tracing ID and echoes it back.
func Tracing(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get(utils.TracingIDHeader)

		// An inbound ID is reused only if it is short and alphanumeric.
		// Echoing an arbitrary client string into a header and every log line
		// is a header-injection and log-forging vector.
		if !safeID(id) {
			id = uuid.NewString()
		}

		w.Header().Set(utils.TracingIDHeader, id)
		next.ServeHTTP(w, r.WithContext(utils.WithTracingID(r.Context(), id)))
	})
}

func safeID(id string) bool {
	if id == "" || len(id) > 64 {
		return false
	}
	for _, c := range id {
		ok := (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
			(c >= '0' && c <= '9') || c == '-' || c == '_'
		if !ok {
			return false
		}
	}
	return true
}

// Logger writes one line per request, after the handler returns so it can
// carry the status and duration.
func Logger(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			rec := &recorder{ResponseWriter: w, status: http.StatusOK}

			next.ServeHTTP(rec, r)

			log.Info("request",
				"method", r.Method,
				"path", r.URL.Path,
				"status", rec.status,
				"duration", time.Since(start).String(),
				"tracing_id", utils.TracingIDFrom(r.Context()),
			)
		})
	}
}

// Recovery turns a panic into a JSON 500 instead of a severed connection.
func Recovery(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					log.Error("panic recovered",
						"panic", rec,
						"stack", string(debug.Stack()),
						"tracing_id", utils.TracingIDFrom(r.Context()),
					)
					// The panic value never reaches the client.
					utils.Error(w, r, http.StatusInternalServerError,
						utils.CodeInternal, "Something went wrong. Please try again.")
				}
			}()

			next.ServeHTTP(w, r)
		})
	}
}

// CORS answers preflight requests and sets the headers the browser frontend
// needs. It reflects a matched origin rather than echoing whatever arrived.
func CORS(origins string) func(http.Handler) http.Handler {
	allowed := map[string]bool{}
	for _, o := range strings.Split(origins, ",") {
		if o = strings.TrimSpace(o); o != "" {
			allowed[o] = true
		}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin == "" || !allowed[origin] {
				next.ServeHTTP(w, r)
				return
			}

			h := w.Header()
			// Without Vary a shared cache can serve one origin's permissive
			// response to a different origin.
			h.Add("Vary", "Origin")
			h.Set("Access-Control-Allow-Origin", origin)
			h.Set("Access-Control-Allow-Credentials", "true")

			if r.Method == http.MethodOptions {
				h.Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
				h.Set("Access-Control-Allow-Headers", "Accept, Authorization, Content-Type, "+utils.TracingIDHeader)
				h.Set("Access-Control-Max-Age", "43200")
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// recorder captures the status code for the access log. It delegates Flush so
// streaming responses keep working.
type recorder struct {
	http.ResponseWriter
	status int
	wrote  bool
}

func (r *recorder) WriteHeader(status int) {
	if r.wrote {
		return
	}
	r.status = status
	r.wrote = true
	r.ResponseWriter.WriteHeader(status)
}

func (r *recorder) Write(b []byte) (int, error) {
	if !r.wrote {
		r.WriteHeader(http.StatusOK)
	}
	return r.ResponseWriter.Write(b)
}

func (r *recorder) Flush() {
	if f, ok := r.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}
