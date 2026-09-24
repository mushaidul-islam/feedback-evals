package services

import "context"

type CreateFeedbackInput struct {
	Text                string
	CampaignDescription string
}

type Feedback struct {
	Text     string
	Category int
	Rewrite  *string
}

type AppService struct{ llm *BasetenClient }

func NewAppService(llm *BasetenClient) *AppService {
	return &AppService{llm: llm}
}

func (s *AppService) CreateFeedback(
	ctx context.Context,
	input CreateFeedbackInput,
) (Feedback, error) {
	decision, err := s.llm.Classify(ctx, input.CampaignDescription, input.Text)
	if err != nil {
		return Feedback{}, err
	}
	return Feedback{
		Text:     input.Text,
		Category: decision.Category,
		Rewrite:  decision.Rewrite,
	}, nil
}
