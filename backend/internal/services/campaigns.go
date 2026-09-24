package services

import (
	"context"
	"errors"
	"fmt"
	"time"

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
	Name string
}

func (s *CampaignService) CreateCampaign(ctx context.Context, input CreateCampaignInput) (models.Campaign, error) {
	var campaign models.Campaign = models.Campaign{
		Name: input.Name,
	}

	err := s.db.WithContext(ctx).Create(&campaign).Error
	if err != nil {
		return models.Campaign{}, fmt.Errorf("creating campaign: %w", err)
	}

	return campaign, nil
}

type CampaignSummary struct {
	ID            uuid.UUID
	Name          string
	CreatedAt     time.Time
	FeedbackCount int64
}

func (s *CampaignService) ListCampaigns(ctx context.Context) ([]CampaignSummary, error) {
	var campaigns []CampaignSummary
	err := s.db.WithContext(ctx).Model(&models.Campaign{}).
		Select("campaigns.id, campaigns.name, campaigns.created_at, count(feedbacks.id) as feedback_count").
		Joins("left join feedbacks on feedbacks.campaign_id = campaigns.id").
		Group("campaigns.id").Order("campaigns.created_at DESC").Scan(&campaigns).Error
	if err != nil {
		return nil, fmt.Errorf("list campaigns: %w", err)
	}
	return campaigns, nil
}
