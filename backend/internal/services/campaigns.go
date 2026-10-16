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

// GetCampaign reads any campaign by id. Only for public reads -- the
// collection page and feedback submission. Creator routes use
// GetOwnedCampaign.
func (s *CampaignService) GetCampaign(ctx context.Context, id uuid.UUID) (models.Campaign, error) {
	return s.first(ctx, "id = ?", id)
}

// GetOwnedCampaign reads a campaign only if userID owns it. Someone else's
// campaign is reported as not found rather than forbidden, so ids cannot be
// probed to learn which campaigns exist.
func (s *CampaignService) GetOwnedCampaign(ctx context.Context, id, userID uuid.UUID) (models.Campaign, error) {
	return s.first(ctx, "id = ? AND user_id = ?", id, userID)
}

func (s *CampaignService) first(ctx context.Context, query string, args ...any) (models.Campaign, error) {
	var campaign models.Campaign

	err := s.db.WithContext(ctx).Where(query, args...).First(&campaign).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return models.Campaign{}, ErrCampaignNotFound
		}
		return models.Campaign{}, fmt.Errorf("reading campaign: %w", err)
	}

	return campaign, nil
}

type CreateCampaignInput struct {
	UserID     uuid.UUID
	Name       string
	ContentURL string
}

func (s *CampaignService) CreateCampaign(ctx context.Context, input CreateCampaignInput) (models.Campaign, error) {
	content, err := ParseCampaignContent(input.ContentURL)
	if err != nil {
		return models.Campaign{}, err
	}
	campaign := models.Campaign{
		UserID: input.UserID,
		Name:   input.Name,
	}
	if content != nil {
		campaign.ContentURL = content.URL
	}

	err = s.db.WithContext(ctx).Create(&campaign).Error
	if err != nil {
		return models.Campaign{}, fmt.Errorf("creating campaign: %w", err)
	}

	return campaign, nil
}

type PublicCampaign struct {
	models.Campaign
	CreatorName    string
	CreatorPicture string
}

// GetPublicCampaign selects the creator's name without loading private account fields.
func (s *CampaignService) GetPublicCampaign(ctx context.Context, id uuid.UUID) (PublicCampaign, error) {
	var campaign PublicCampaign
	err := s.db.WithContext(ctx).Model(&models.Campaign{}).
		Select("campaigns.*, COALESCE(users.name, '') AS creator_name, COALESCE(users.picture, '') AS creator_picture").
		Joins("LEFT JOIN users ON users.id = campaigns.user_id").
		Where("campaigns.id = ?", id).Take(&campaign).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return PublicCampaign{}, ErrCampaignNotFound
	}
	if err != nil {
		return PublicCampaign{}, fmt.Errorf("reading public campaign: %w", err)
	}
	return campaign, nil
}

type CampaignSummary struct {
	ID            uuid.UUID
	Name          string
	CreatedAt     time.Time
	FeedbackCount int64
}

// ListCampaigns returns userID's campaigns, newest first.
func (s *CampaignService) ListCampaigns(ctx context.Context, userID uuid.UUID) ([]CampaignSummary, error) {
	var campaigns []CampaignSummary
	err := s.db.WithContext(ctx).Model(&models.Campaign{}).
		Select("campaigns.id, campaigns.name, campaigns.created_at, count(feedbacks.id) as feedback_count").
		Joins("left join feedbacks on feedbacks.campaign_id = campaigns.id").
		Where("campaigns.user_id = ?", userID).
		Group("campaigns.id").Order("campaigns.created_at DESC").Scan(&campaigns).Error
	if err != nil {
		return nil, fmt.Errorf("list campaigns: %w", err)
	}
	return campaigns, nil
}
