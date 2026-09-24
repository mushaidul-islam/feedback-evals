package services

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/mushaidul/truth-be-told/backend/internal/models"
)

type FeedbackService struct {
	db         *gorm.DB
	campaigns  *CampaignService
	classifier *AppService
}

func NewFeedbackService(db *gorm.DB, campaigns *CampaignService, classifier *AppService) *FeedbackService {
	return &FeedbackService{db: db, campaigns: campaigns, classifier: classifier}
}

func (s *FeedbackService) Submit(ctx context.Context, campaignID uuid.UUID, text string) error {
	campaign, err := s.campaigns.GetCampaign(ctx, campaignID)
	if err != nil {
		return err
	}
	decision, err := s.classifier.CreateFeedback(ctx, CreateFeedbackInput{Text: text, CampaignDescription: campaign.Name})
	if err != nil {
		return fmt.Errorf("classifying feedback: %w", err)
	}
	var saved string
	switch decision.Category {
	case 1:
		saved = text
	case 2:
		saved = *decision.Rewrite
	default:
		return nil
	}
	if err := s.db.WithContext(ctx).Create(&models.Feedback{CampaignID: campaignID, Text: saved}).Error; err != nil {
		return fmt.Errorf("saving feedback: %w", err)
	}
	return nil
}

func (s *FeedbackService) List(ctx context.Context, campaignID uuid.UUID) ([]models.Feedback, error) {
	if _, err := s.campaigns.GetCampaign(ctx, campaignID); err != nil {
		return nil, err
	}
	var feedback []models.Feedback
	if err := s.db.WithContext(ctx).Where("campaign_id = ?", campaignID).Order("created_at DESC").Find(&feedback).Error; err != nil {
		return nil, fmt.Errorf("listing feedback: %w", err)
	}
	return feedback, nil
}
