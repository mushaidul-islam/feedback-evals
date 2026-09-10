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

func (s *UserService) EnsureUser(ctx context.Context, googleSubject, email, name string) (models.User, error) {
	user := models.User{
		GoogleSubject: googleSubject,
		Email:         email,
		Name:          name,
	}

	err := s.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "google_subject"}},
			DoUpdates: clause.AssignmentColumns([]string{"email", "name", "updated_at"}),
		}).
		Create(&user).Error
	if err != nil {
		return models.User{}, fmt.Errorf("upserting user: %w", err)
	}

	return user, nil
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
