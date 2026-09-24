package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/mushaidul/truth-be-told/backend/internal/services"
)

func TestCreateFeedbackCallsBaseten(t *testing.T) {
	baseten := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/v1/chat/completions" {
			t.Errorf("unexpected Baseten request: %s %s", r.Method, r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Api-Key test-key" {
			t.Errorf("authorization = %q", got)
		}
		var request struct {
			Model    string `json:"model"`
			Messages []struct {
				Role    string `json:"role"`
				Content string `json:"content"`
			} `json:"messages"`
			ResponseFormat struct {
				Type string `json:"type"`
			} `json:"response_format"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Errorf("decode Baseten request: %v", err)
		}
		if request.Model != "test-model" || len(request.Messages) != 2 || request.Messages[0].Role != "system" || !strings.Contains(request.Messages[0].Content, "You are screening feedback") || request.Messages[1].Role != "user" || request.ResponseFormat.Type != "json_schema" {
			t.Errorf("unexpected Baseten payload: %+v", request)
		} else {
			var input map[string]string
			if err := json.Unmarshal([]byte(request.Messages[1].Content), &input); err != nil || input["campaign_description"] != "Team communication" || input["feedback_text"] != "Helpful feedback" {
				t.Errorf("user message = %q, error = %v", request.Messages[1].Content, err)
			}
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"choices":[{"message":{"content":"{\"category\":1,\"rewrite\":null}"}}]}`))
	}))
	defer baseten.Close()

	client := services.NewBasetenClient(baseten.Client(), baseten.URL+"/v1/chat/completions", "test-key", "test-model")
	handler := NewAppHandler(services.NewAppService(client))
	request := httptest.NewRequest(http.MethodPost, "/api/v1/feedback", strings.NewReader(`{"text":"Helpful feedback","campaign_description":"Team communication"}`))
	response := httptest.NewRecorder()
	handler.CreateFeedback(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", response.Code, response.Body.String())
	}
	var feedback Feedback
	if err := json.Unmarshal(response.Body.Bytes(), &feedback); err != nil {
		t.Fatal(err)
	}
	if feedback.Text != "Helpful feedback" || feedback.Category != 1 || feedback.Rewrite != nil {
		t.Errorf("feedback = %+v", feedback)
	}
	var body map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if _, exists := body["name"]; exists {
		t.Errorf("feedback response unexpectedly has a name: %s", response.Body.String())
	}
}

func TestCreateFeedbackHandlesBasetenFailure(t *testing.T) {
	baseten := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "private upstream detail", http.StatusBadGateway)
	}))
	defer baseten.Close()

	client := services.NewBasetenClient(baseten.Client(), baseten.URL, "test-key", "test-model")
	handler := NewAppHandler(services.NewAppService(client))
	request := httptest.NewRequest(http.MethodPost, "/api/v1/feedback", strings.NewReader(`{"text":"Helpful feedback","campaign_description":"Team communication"}`))
	response := httptest.NewRecorder()
	handler.CreateFeedback(response, request)

	if response.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, body = %s", response.Code, response.Body.String())
	}
	if strings.Contains(response.Body.String(), "private upstream detail") {
		t.Errorf("upstream details leaked: %s", response.Body.String())
	}
}

func TestCreateFeedbackRejectsEmptyText(t *testing.T) {
	called := false
	baseten := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
	}))
	defer baseten.Close()

	client := services.NewBasetenClient(baseten.Client(), baseten.URL, "test-key", "test-model")
	handler := NewAppHandler(services.NewAppService(client))
	request := httptest.NewRequest(http.MethodPost, "/api/v1/feedback", strings.NewReader(`{"text":"   ","campaign_description":"Team communication"}`))
	response := httptest.NewRecorder()
	handler.CreateFeedback(response, request)

	if response.Code != http.StatusBadRequest || called {
		t.Errorf("status = %d, Baseten called = %v", response.Code, called)
	}
}

func TestCreateFeedbackRequiresTenCharacters(t *testing.T) {
	for _, tc := range []struct {
		name       string
		text       string
		wantStatus int
		wantCalls  int
	}{
		{name: "nine characters", text: "123456789", wantStatus: http.StatusBadRequest},
		{name: "surrounding spaces do not count", text: " 123456789 ", wantStatus: http.StatusBadRequest},
		{name: "ten Unicode characters", text: "éééééééééé", wantStatus: http.StatusOK, wantCalls: 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			calls := 0
			baseten := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls++
				w.Write([]byte(`{"choices":[{"message":{"content":"{\"category\":1,\"rewrite\":null}"}}]}`))
			}))
			defer baseten.Close()
			client := services.NewBasetenClient(baseten.Client(), baseten.URL, "test-key", "test-model")
			handler := NewAppHandler(services.NewAppService(client))
			body, err := json.Marshal(map[string]string{"text": tc.text, "campaign_description": "Team communication"})
			if err != nil {
				t.Fatal(err)
			}
			request := httptest.NewRequest(http.MethodPost, "/api/v1/feedback", strings.NewReader(string(body)))
			response := httptest.NewRecorder()
			handler.CreateFeedback(response, request)
			if response.Code != tc.wantStatus || calls != tc.wantCalls {
				t.Errorf("status = %d, Baseten calls = %d; want %d and %d", response.Code, calls, tc.wantStatus, tc.wantCalls)
			}
		})
	}
}

func TestCreateFeedbackRejectsNameField(t *testing.T) {
	client := services.NewBasetenClient(http.DefaultClient, "http://example.invalid", "test-key", "test-model")
	handler := NewAppHandler(services.NewAppService(client))
	request := httptest.NewRequest(http.MethodPost, "/api/v1/feedback", strings.NewReader(`{"name":"Ada","text":"Helpful feedback","campaign_description":"Team communication"}`))
	response := httptest.NewRecorder()
	handler.CreateFeedback(response, request)
	if response.Code != http.StatusBadRequest {
		t.Errorf("status = %d, body = %s", response.Code, response.Body.String())
	}
}

func TestCreateFeedbackRequiresCampaignDescription(t *testing.T) {
	client := services.NewBasetenClient(http.DefaultClient, "http://example.invalid", "test-key", "test-model")
	handler := NewAppHandler(services.NewAppService(client))
	request := httptest.NewRequest(http.MethodPost, "/api/v1/feedback", strings.NewReader(`{"text":"Helpful feedback","campaign_description":"  "}`))
	response := httptest.NewRecorder()
	handler.CreateFeedback(response, request)
	if response.Code != http.StatusBadRequest {
		t.Errorf("status = %d, body = %s", response.Code, response.Body.String())
	}
}

func TestCreateFeedbackRejectsInvalidDecision(t *testing.T) {
	baseten := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"choices":[{"message":{"content":"{\"category\":2,\"rewrite\":null}"}}]}`))
	}))
	defer baseten.Close()
	client := services.NewBasetenClient(baseten.Client(), baseten.URL, "test-key", "test-model")
	handler := NewAppHandler(services.NewAppService(client))
	request := httptest.NewRequest(http.MethodPost, "/api/v1/feedback", strings.NewReader(`{"text":"Helpful feedback","campaign_description":"Team communication"}`))
	response := httptest.NewRecorder()
	handler.CreateFeedback(response, request)
	if response.Code != http.StatusBadGateway {
		t.Errorf("status = %d, body = %s", response.Code, response.Body.String())
	}
}

func TestCreateFeedbackReturnsRewriteForCategoryTwo(t *testing.T) {
	baseten := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"choices":[{"message":{"content":"{\"category\":2,\"rewrite\":\"The report lacks dates.\"}"}}]}`))
	}))
	defer baseten.Close()
	client := services.NewBasetenClient(baseten.Client(), baseten.URL, "test-key", "test-model")
	handler := NewAppHandler(services.NewAppService(client))
	request := httptest.NewRequest(http.MethodPost, "/api/v1/feedback", strings.NewReader(`{"text":"This report is a joke; it lists no dates.","campaign_description":"Review this report"}`))
	response := httptest.NewRecorder()
	handler.CreateFeedback(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", response.Code, response.Body.String())
	}
	var feedback Feedback
	if err := json.Unmarshal(response.Body.Bytes(), &feedback); err != nil {
		t.Fatal(err)
	}
	if feedback.Category != 2 || feedback.Rewrite == nil || *feedback.Rewrite != "The report lacks dates." {
		t.Errorf("feedback = %+v", feedback)
	}
}
