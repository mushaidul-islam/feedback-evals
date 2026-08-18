module github.com/mushaidul/truth-be-told/backend

// Go 1.26 is the current stable line. 1.25 loses support when 1.27 ships.
go 1.26.0

// Pins the exact patch; an older local Go fetches this automatically.
toolchain go1.26.6

require (
	github.com/go-chi/chi/v5 v5.3.1
	github.com/google/uuid v1.6.0
)
