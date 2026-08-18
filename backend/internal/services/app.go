package services

import "context"

type CreateFeedbackInput struct {
	Name string
	Text string
}

type Feedback struct {
	Name string
	Text string
}

type AppService struct{}

func NewAppService() *AppService {
	return &AppService{}
}

func (s *AppService) CreateFeedback(
	ctx context.Context,
	input CreateFeedbackInput,
) Feedback {
	return Feedback{
		Name: input.Name,
		Text: input.Text,
	}
}
