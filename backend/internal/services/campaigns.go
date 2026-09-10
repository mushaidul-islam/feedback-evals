package services

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/mushaidul/truth-be-told/backend/internal/models"
)

var ErrCampaignNotFound = errors.New("campaign not found")

type CampaignService struct {
	db *gorm.DB
}

func NewCampaignService(db *gorm.DB) *CampaignService {
	return &CampaignService{db: db}
}

func (s *CampaignService) GetCampaign(ctx context.Context, id uuid.UUID) (models.Campaign, error) {
	var campaign models.Campaign

	err := s.db.WithContext(ctx).First(&campaign, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return models.Campaign{}, ErrCampaignNotFound
		}
		return models.Campaign{}, fmt.Errorf("reading campaign: %w", err)
	}

	return campaign, nil
}

type CreateCampaignInput struct {
	UserID uuid.UUID
	Name   string
}

func (s *CampaignService) CreateCampaign(ctx context.Context, input CreateCampaignInput) (models.Campaign, error) {
	var campaign models.Campaign = models.Campaign{
		Name:   input.Name,
		UserID: input.UserID,
	}

	err := s.db.WithContext(ctx).Create(&campaign).Error
	if err != nil {
		return models.Campaign{}, fmt.Errorf("creating campaign: %w", err)
	}

	return campaign, nil
}

func (s *CampaignService) ListCampaigns(ctx context.Context, queryParams SearchParams, userID uuid.UUID) ([]models.Campaign, error) {
	var campaigns []models.Campaign
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).Limit(queryParams.Limit).Offset(queryParams.Offset).Order("created_at ASC").Find(&campaigns).Error
	if err != nil {
		return nil, fmt.Errorf("list campaigns: %w", err)
	}
	return campaigns, nil
}
