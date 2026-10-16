package services

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/mushaidul/truth-be-told/backend/internal/models"
)

var ErrUserNotFound = errors.New("user not found")

type UserService struct {
	db *gorm.DB
}

func NewUserService(db *gorm.DB) *UserService {
	return &UserService{db: db}
}

func (s *UserService) EnsureUser(ctx context.Context, googleSubject, email, name, picture string) (models.User, error) {
	user := models.User{
		GoogleSubject: googleSubject,
		Email:         email,
		Name:          name,
		Picture:       picture,
	}

	err := s.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "google_subject"}},
			DoUpdates: clause.AssignmentColumns([]string{"email", "name", "picture", "updated_at"}),
		}).
		Create(&user).Error
	if err != nil {
		return models.User{}, fmt.Errorf("upserting user: %w", err)
	}

	// On a returning user Postgres keeps the existing row's id, but GORM
	// leaves the id BeforeCreate just generated on the struct. Read the row
	// back so the caller gets the id that is actually stored.
	var saved models.User
	if err := s.db.WithContext(ctx).First(&saved, "google_subject = ?", googleSubject).Error; err != nil {
		return models.User{}, fmt.Errorf("reading user: %w", err)
	}

	return saved, nil
}

func (s *UserService) GetUser(ctx context.Context, id uuid.UUID) (models.User, error) {
	var user models.User

	err := s.db.WithContext(ctx).First(&user, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return models.User{}, ErrUserNotFound
		}
		return models.User{}, fmt.Errorf("reading user: %w", err)
	}

	return user, nil
}

type SearchParams struct {
	Limit  int
	Offset int
}
