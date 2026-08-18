package utils

import "context"

// TracingIDHeader is read from the request and echoed back on the response.
// Spelling is canonical (…-Id): Go normalises header keys that way.
const TracingIDHeader = "X-Tracing-Id"

// tracingKey is unexported so no other package can collide with it.
// A bare string key here is what go vet flags as SA1029.
type tracingKey struct{}

// WithTracingID returns a copy of ctx carrying id.
func WithTracingID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, tracingKey{}, id)
}

// TracingIDFrom returns the tracing ID on ctx, or "" if there is none.
func TracingIDFrom(ctx context.Context) string {
	id, _ := ctx.Value(tracingKey{}).(string)
	return id
}
