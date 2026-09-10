package database

import (
	"context"
	"fmt"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/mushaidul/truth-be-told/backend/internal/models"
)

// Pool sizing. Small and fixed on purpose: these are only worth moving into
// the environment once there is traffic
const (
	maxOpenConns    = 10
	maxIdleConns    = 5
	connMaxLifetime = time.Hour
)

// Connect opens the connection and verifies the database actually answers.
func Connect(url string, debug bool) (*gorm.DB, error) {
	// Warn is the sane default: slow queries and errors, not every statement.
	level := logger.Warn
	if debug {
		level = logger.Info
	}

	db, err := gorm.Open(postgres.Open(url), &gorm.Config{
		Logger: logger.Default.LogMode(level),
	})
	if err != nil {
		return nil, fmt.Errorf("connecting to database: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("reading connection pool: %w", err)
	}
	sqlDB.SetMaxOpenConns(maxOpenConns)
	sqlDB.SetMaxIdleConns(maxIdleConns)
	sqlDB.SetConnMaxLifetime(connMaxLifetime)

	if err := sqlDB.Ping(); err != nil {
		return nil, fmt.Errorf("pinging database: %w", err)
	}

	return db, nil
}

// Migrate brings the schema in line with the models.
// Add every new model to this list -- a model that is not here has no table.
func Migrate(db *gorm.DB) error {
	if err := db.AutoMigrate(
		&models.User{},
	); err != nil {
		return fmt.Errorf("migrating schema: %w", err)
	}
	return nil
}

// Ping returns a probe for the /readyz health check.
func Ping(db *gorm.DB) func(ctx context.Context) error {
	return func(ctx context.Context) error {
		sqlDB, err := db.DB()
		if err != nil {
			return err
		}
		return sqlDB.PingContext(ctx)
	}
}

// Close releases the pool. Call it on shutdown.
func Close(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}
