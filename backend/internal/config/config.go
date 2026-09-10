// Package config loads configuration from the environment. Nothing else in
// the codebase calls os.Getenv, so every knob is visible in this one file.
package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// Config holds everything the server needs to start.
type Config struct {
	Env             string
	Host            string
	Port            string
	LogLevel        string
	AllowedOrigins  string
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	ShutdownTimeout time.Duration

	DatabaseURL string
	AutoMigrate bool
}

// Addr returns the host:port the server listens on.
func (c Config) Addr() string { return c.Host + ":" + c.Port }

// IsProduction reports whether this is a production deployment.
func (c Config) IsProduction() bool { return c.Env == "production" }

// Load reads and validates configuration, once, at startup.
//
// There is no godotenv call here on purpose: a .env file is a developer
// convenience, and loading one at startup means the binary refuses to run in a
// container that has none.
func Load() (Config, error) {
	c := Config{
		Env:            env("APP_ENV", "development"),
		Host:           env("HOST", "0.0.0.0"),
		Port:           env("PORT", "8080"),
		LogLevel:       env("LOG_LEVEL", "info"),
		AllowedOrigins: env("CORS_ALLOWED_ORIGINS", "http://localhost:3000"),
		DatabaseURL:    os.Getenv("DATABASE_URL"),
	}

	if _, err := strconv.Atoi(c.Port); err != nil {
		return c, fmt.Errorf("PORT: %q is not a number", c.Port)
	}

	// No default. A connection string is deployment-specific, and a default
	// here would mean a misconfigured production server quietly talking to
	// localhost instead of refusing to start.
	if c.DatabaseURL == "" {
		return c, fmt.Errorf("DATABASE_URL: required, see .env.example")
	}

	var err error
	if c.AutoMigrate, err = boolean("DB_AUTO_MIGRATE", true); err != nil {
		return c, err
	}

	if c.ReadTimeout, err = duration("SERVER_READ_TIMEOUT", 15*time.Second); err != nil {
		return c, err
	}
	if c.WriteTimeout, err = duration("SERVER_WRITE_TIMEOUT", 30*time.Second); err != nil {
		return c, err
	}
	if c.ShutdownTimeout, err = duration("SERVER_SHUTDOWN_TIMEOUT", 15*time.Second); err != nil {
		return c, err
	}

	return c, nil
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func duration(key string, def time.Duration) (time.Duration, error) {
	v := os.Getenv(key)
	if v == "" {
		return def, nil
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return 0, fmt.Errorf("%s: %q is not a duration (try 30s, 5m)", key, v)
	}
	return d, nil
}

func boolean(key string, def bool) (bool, error) {
	v := os.Getenv(key)
	if v == "" {
		return def, nil
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return false, fmt.Errorf("%s: %q is not true or false", key, v)
	}
	return b, nil
}
