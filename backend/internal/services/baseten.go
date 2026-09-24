package services

import (
	"bytes"
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

const BasetenURL = "https://inference.baseten.co/v1/chat/completions"

//go:embed feedback_prompt.txt
var feedbackPrompt string

type Decision struct {
	Category int     `json:"category"`
	Rewrite  *string `json:"rewrite"`
}

type BasetenClient struct {
	httpClient *http.Client
	url        string
	apiKey     string
	model      string
}

func NewBasetenClient(httpClient *http.Client, url, apiKey, model string) *BasetenClient {
	return &BasetenClient{httpClient: httpClient, url: url, apiKey: apiKey, model: model}
}

func (c *BasetenClient) Classify(ctx context.Context, campaignDescription, feedbackText string) (Decision, error) {
	type message struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}
	userMessage, err := json.Marshal(struct {
		CampaignDescription string `json:"campaign_description"`
		FeedbackText        string `json:"feedback_text"`
	}{CampaignDescription: campaignDescription, FeedbackText: feedbackText})
	if err != nil {
		return Decision{}, fmt.Errorf("encode feedback input: %w", err)
	}
	body, err := json.Marshal(struct {
		Model          string         `json:"model"`
		Messages       []message      `json:"messages"`
		ResponseFormat map[string]any `json:"response_format"`
	}{
		Model:    c.model,
		Messages: []message{{Role: "system", Content: feedbackPrompt}, {Role: "user", Content: string(userMessage)}},
		ResponseFormat: map[string]any{
			"type": "json_schema",
			"json_schema": map[string]any{
				"name":   "feedback_decision",
				"strict": true,
				"schema": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"category": map[string]any{"type": "integer", "enum": []int{1, 2, 3, 4}},
						"rewrite":  map[string]any{"type": []string{"string", "null"}},
					},
					"required":             []string{"category", "rewrite"},
					"additionalProperties": false,
				},
			},
		},
	})
	if err != nil {
		return Decision{}, fmt.Errorf("encode Baseten request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.url, bytes.NewReader(body))
	if err != nil {
		return Decision{}, fmt.Errorf("create Baseten request: %w", err)
	}
	req.Header.Set("Authorization", "Api-Key "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return Decision{}, fmt.Errorf("call Baseten: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return Decision{}, fmt.Errorf("Baseten returned status %d", resp.StatusCode)
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return Decision{}, fmt.Errorf("decode Baseten response: %w", err)
	}
	if len(result.Choices) == 0 || strings.TrimSpace(result.Choices[0].Message.Content) == "" {
		return Decision{}, fmt.Errorf("Baseten returned no message")
	}
	content := result.Choices[0].Message.Content
	var fields map[string]json.RawMessage
	if err := json.Unmarshal([]byte(content), &fields); err != nil || len(fields) != 2 || fields["category"] == nil || fields["rewrite"] == nil {
		return Decision{}, fmt.Errorf("Baseten returned an invalid decision")
	}
	var decision Decision
	if err := json.Unmarshal([]byte(content), &decision); err != nil || decision.Category < 1 || decision.Category > 4 || (decision.Category == 2 && (decision.Rewrite == nil || strings.TrimSpace(*decision.Rewrite) == "")) || (decision.Category != 2 && decision.Rewrite != nil) {
		return Decision{}, fmt.Errorf("Baseten returned an invalid decision")
	}
	return decision, nil
}
