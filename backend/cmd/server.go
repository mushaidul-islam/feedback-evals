// Package cmd holds the application entry points.
package cmd

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/mushaidul/truth-be-told/backend/internal/config"
	"github.com/mushaidul/truth-be-told/backend/internal/handlers"
	"github.com/mushaidul/truth-be-told/backend/internal/services"
)

// Version is stamped at build time via -ldflags. See the Makefile.
var Version = "dev"

// Server starts the HTTP server and blocks until the process is signalled.
// This is the composition root: every dependency is constructed here and
// nowhere else.
func Server() error {
	cnf, err := config.Load()
	if err != nil {
		return err
	}

	log := newLogger(cnf)
	slog.SetDefault(log)

	// Add dependency probes here as they land and /readyz reports on them:
	//   services.NewHealth(Version, services.Check{Name: "postgres", Probe: pool.Ping})
	healthSvc := services.NewHealth(Version)
	healthHandler := handlers.NewHealthHandler(healthSvc)

	appSvc := services.NewAppService()
	appHandler := handlers.NewAppHandler(appSvc)

	srv := &http.Server{
		Addr:    cnf.Addr(),
		Handler: handlers.NewRouter(cnf, log, healthHandler, appHandler),
		// Without these a connection stays open indefinitely for a client
		// that never finishes its request.
		ReadTimeout:       cnf.ReadTimeout,
		ReadHeaderTimeout: cnf.ReadTimeout,
		WriteTimeout:      cnf.WriteTimeout,
	}

	// SIGTERM is how a container orchestrator asks a process to stop. Ignoring
	// it means being SIGKILLed seconds later, mid-request.
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	serverErr := make(chan error, 1)
	go func() {
		log.Info("server started", "addr", cnf.Addr(), "env", cnf.Env, "version", Version)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
			return
		}
		serverErr <- nil
	}()

	select {
	case err := <-serverErr:
		if err != nil {
			return fmt.Errorf("serving: %w", err)
		}
		return nil
	case <-ctx.Done():
		log.Info("shutting down", "grace", cnf.ShutdownTimeout.String())
	}

	// A fresh context: reusing the cancelled ctx would abort the drain
	// immediately.
	shutdownCtx, cancel := context.WithTimeout(context.Background(), cnf.ShutdownTimeout)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("draining server: %w", err)
	}

	log.Info("server stopped")
	return nil
}

func newLogger(cnf config.Config) *slog.Logger {
	level := slog.LevelInfo
	switch cnf.LogLevel {
	case "debug":
		level = slog.LevelDebug
	case "warn":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	}

	opts := &slog.HandlerOptions{Level: level}

	// Humans read dev logs; aggregators read production logs.
	if cnf.IsProduction() {
		return slog.New(slog.NewJSONHandler(os.Stdout, opts))
	}
	return slog.New(slog.NewTextHandler(os.Stdout, opts))
}
