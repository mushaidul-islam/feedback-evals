package handlers

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/mushaidul/truth-be-told/backend/internal/config"
	"github.com/mushaidul/truth-be-told/backend/internal/database"
	"github.com/mushaidul/truth-be-told/backend/internal/services"
)

func TestCampaignFeedbackFlow(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set TEST_DATABASE_URL to run Postgres integration test")
	}
	db, err := database.Connect(url, false)
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close(db)
	if err := database.Migrate(db); err != nil {
		t.Fatal(err)
	}

	model := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Messages []struct {
				Content string `json:"content"`
			} `json:"messages"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Error(err)
		}
		if len(body.Messages) != 2 || !strings.Contains(body.Messages[1].Content, "Campaign A") {
			t.Errorf("missing campaign name in classifier input: %+v", body)
		}
		var input struct {
			FeedbackText string `json:"feedback_text"`
		}
		if len(body.Messages) == 2 {
			_ = json.Unmarshal([]byte(body.Messages[1].Content), &input)
		}
		category := int(input.FeedbackText[0] - '0')
		rewrite := "null"
		if category == 2 {
			rewrite = `"Clean rewrite"`
		}
		io.WriteString(w, `{"choices":[{"message":{"content":"{\"category\":`+string(rune('0'+category))+`,\"rewrite\":`+strings.ReplaceAll(rewrite, `"`, `\"`)+`}"}}]}`)
	}))
	defer model.Close()

	classifier := services.NewAppService(services.NewBasetenClient(model.Client(), model.URL, "provider-key", "test-model"))
	campaignSvc := services.NewCampaignService(db)
	app := NewAppHandler(classifier)
	router := NewRouter(config.Config{}, slog.New(slog.NewTextHandler(io.Discard, nil)), NewHealthHandler(services.NewHealth("test")), app, NewCampaignHandler(campaignSvc), NewFeedbackHandler(services.NewFeedbackService(db, campaignSvc, classifier)))
	call := func(method, path, key, body string) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		if key != "" {
			r.Header.Set("Authorization", key)
		}
		w := httptest.NewRecorder()
		router.ServeHTTP(w, r)
		return w
	}
	if got := call("GET", "/api/v1/campaign/", "", "").Code; got != http.StatusUnauthorized {
		t.Fatalf("campaign list without key: %d", got)
	}
	if got := call("GET", "/api/v1/campaign/", "Bearer wrong", "").Code; got != http.StatusUnauthorized {
		t.Fatalf("campaign list with wrong key: %d", got)
	}
	created := call("POST", "/api/v1/campaign/", "Bearer test-key", `{"name":"Campaign A"}`)
	if created.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", created.Code, created.Body.String())
	}
	var campaign struct {
		ID uuid.UUID `json:"id"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &campaign); err != nil {
		t.Fatal(err)
	}
	defer db.Exec("DELETE FROM feedbacks WHERE campaign_id = ?", campaign.ID)
	defer db.Exec("DELETE FROM campaigns WHERE id = ?", campaign.ID)
	id := campaign.ID.String()
	if got := call("GET", "/api/v1/campaign/"+id+"/public", "", "").Code; got != http.StatusOK {
		t.Errorf("public campaign: %d", got)
	}
	if got := call("GET", "/api/v1/campaign/"+id, "", "").Code; got != http.StatusUnauthorized {
		t.Errorf("private campaign: %d", got)
	}
	if got := call("GET", "/api/v1/feedback/?campaign_id="+id, "", "").Code; got != http.StatusUnauthorized {
		t.Errorf("feedback list: %d", got)
	}
	for _, text := range []string{"1 accepted text", "2 original abuse", "3 vague content", "4 rejected text"} {
		w := call("POST", "/api/v1/feedback/", "", `{"campaign_id":"`+id+`","text":"`+text+`"}`)
		if w.Code != http.StatusOK || w.Body.String() != `{"sent":true}` {
			t.Fatalf("submit %q: %d %s", text, w.Code, w.Body.String())
		}
	}
	listed := call("GET", "/api/v1/feedback/?campaign_id="+id, "Bearer test-key", "")
	if listed.Code != http.StatusOK {
		t.Fatalf("list: %d %s", listed.Code, listed.Body.String())
	}
	var feedback []struct {
		Text string `json:"text"`
	}
	if err := json.Unmarshal(listed.Body.Bytes(), &feedback); err != nil {
		t.Fatal(err)
	}
	if len(feedback) != 2 {
		t.Fatalf("saved feedback = %+v", feedback)
	}
	seen := map[string]bool{}
	for _, f := range feedback {
		seen[f.Text] = true
	}
	if !seen["1 accepted text"] || !seen["Clean rewrite"] {
		t.Errorf("wrong saved text: %+v", feedback)
	}
	campaigns := call("GET", "/api/v1/campaign/", "Bearer test-key", "")
	if campaigns.Code != http.StatusOK {
		t.Fatalf("campaign list: %d %s", campaigns.Code, campaigns.Body.String())
	}
	var summaries []struct {
		ID            uuid.UUID `json:"id"`
		FeedbackCount int       `json:"feedback_count"`
	}
	if err := json.Unmarshal(campaigns.Body.Bytes(), &summaries); err != nil {
		t.Fatal(err)
	}
	found := false
	for _, summary := range summaries {
		if summary.ID == campaign.ID {
			found = true
			if summary.FeedbackCount != 2 {
				t.Errorf("feedback count = %d, want 2", summary.FeedbackCount)
			}
		}
	}
	if !found {
		t.Error("created campaign missing from list")
	}
	missing := uuid.NewString()
	if got := call("GET", "/api/v1/campaign/"+missing+"/public", "", "").Code; got != http.StatusNotFound {
		t.Errorf("unknown campaign: %d", got)
	}
	if got := call("POST", "/api/v1/feedback/", "", `{"campaign_id":"`+missing+`","text":"valid feedback text"}`).Code; got != http.StatusNotFound {
		t.Errorf("unknown feedback campaign: %d", got)
	}
}
