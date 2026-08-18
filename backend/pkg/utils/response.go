// Package utils holds shared HTTP helpers with no application logic.
package utils

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

// Error codes returned to clients.
const (
	CodeInvalidArgument = "invalid_argument"
	CodeNotFound        = "not_found"
	CodeUnauthorized    = "unauthorized"
	CodeInternal        = "internal"
)

// ErrorBody is the shape of every non-2xx response, so a client needs one
// error branch rather than one per endpoint.
type ErrorBody struct {
	Error ErrorDetail `json:"error"`
}

// ErrorDetail is the client-safe description of a failure.
type ErrorDetail struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	TracingID string `json:"tracing_id,omitempty"`
}

// JSON writes v with the given status code. It marshals before writing the
// header so a marshal failure becomes a 500 rather than a truncated 200.
func JSON(w http.ResponseWriter, status int, v any) {
	if v == nil {
		w.WriteHeader(status)
		return
	}

	buf, err := json.Marshal(v)
	if err != nil {
		slog.Error("encoding response failed", "error", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	w.Write(buf) //nolint:errcheck // response already committed
}

// Error writes a JSON error response.
func Error(w http.ResponseWriter, r *http.Request, status int, code, message string) {
	JSON(w, status, ErrorBody{Error: ErrorDetail{
		Code:      code,
		Message:   message,
		TracingID: TracingIDFrom(r.Context()),
	}})
}

// Decode reads a JSON request body into T, rejecting unknown fields so a
// client that misspells a key is told rather than silently losing the value.
func Decode[T any](r *http.Request) (T, error) {
	var v T
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	// Decode on its own line: Go evaluates return expressions left to right,
	// so `return v, dec.Decode(&v)` would copy v before it is populated.
	err := dec.Decode(&v)
	return v, err
}
