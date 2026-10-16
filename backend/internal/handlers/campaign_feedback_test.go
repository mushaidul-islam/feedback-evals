package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/google/uuid"
	"google.golang.org/api/idtoken"

	"github.com/mushaidul/truth-be-told/backend/internal/config"
	"github.com/mushaidul/truth-be-told/backend/internal/database"
	"github.com/mushaidul/truth-be-told/backend/internal/middleware"
	"github.com/mushaidul/truth-be-told/backend/internal/services"
)

// fakeGoogle accepts any credential starting with "valid:" and treats the rest
// as the Google subject, so tests can sign in as anyone without calling Google.
func fakeGoogle(_ context.Context, credential, audience string) (*idtoken.Payload, error) {
	subject, ok := strings.CutPrefix(credential, "valid:")
	if !ok || audience != "test-client-id" {
		return nil, errors.New("bad credential")
	}
	return &idtoken.Payload{
		Subject: subject,
		Claims: map[string]any{
			"email":          subject + "@example.com",
			"email_verified": true,
			"name":           "Test " + subject,
			"picture":        "https://lh3.googleusercontent.com/test-avatar",
		},
	}, nil
}

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
	userSvc := services.NewUserService(db)
	authSvc := services.NewAuthService(db, userSvc, "test-client-id", fakeGoogle)
	router := NewRouter(
		config.Config{},
		slog.New(slog.NewTextHandler(io.Discard, nil)),
		NewHealthHandler(services.NewHealth("test")),
		NewAppHandler(classifier),
		NewCampaignHandler(campaignSvc),
		NewFeedbackHandler(services.NewFeedbackService(db, campaignSvc, classifier)),
		NewAuthHandler(authSvc, userSvc),
		middleware.RequireUser(authSvc.UserIDForToken),
	)
	call := func(method, path, token, body string) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		if token != "" {
			r.Header.Set("Authorization", "Bearer "+token)
		}
		w := httptest.NewRecorder()
		router.ServeHTTP(w, r)
		return w
	}

	ownerSubject := "owner-" + uuid.NewString()
	otherSubject := "other-" + uuid.NewString()
	defer db.Exec("DELETE FROM users WHERE google_subject IN (?, ?)", ownerSubject, otherSubject)

	signIn := func(subject string) (token string, userID uuid.UUID) {
		t.Helper()
		w := call("POST", "/api/v1/auth/google", "", `{"credential":"valid:`+subject+`"}`)
		if w.Code != http.StatusOK {
			t.Fatalf("sign in %s: %d %s", subject, w.Code, w.Body.String())
		}
		var body struct {
			Token string `json:"token"`
			User  struct {
				ID uuid.UUID `json:"id"`
			} `json:"user"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		return body.Token, body.User.ID
	}

	if got := call("POST", "/api/v1/auth/google", "", `{"credential":"forged"}`).Code; got != http.StatusUnauthorized {
		t.Fatalf("forged credential: %d", got)
	}
	owner, ownerID := signIn(ownerSubject)
	// A returning user must get the same account, not a new id each time.
	ownerAgain, ownerIDAgain := signIn(ownerSubject)
	if ownerIDAgain != ownerID {
		t.Fatalf("second sign-in returned user %s, want %s", ownerIDAgain, ownerID)
	}
	other, _ := signIn(otherSubject)

	me := call("GET", "/api/v1/auth/me", owner, "")
	if me.Code != http.StatusOK || !strings.Contains(me.Body.String(), ownerSubject+"@example.com") {
		t.Fatalf("me: %d %s", me.Code, me.Body.String())
	}

	if got := call("GET", "/api/v1/campaign/", "", "").Code; got != http.StatusUnauthorized {
		t.Fatalf("campaign list without session: %d", got)
	}
	if got := call("GET", "/api/v1/campaign/", "wrong", "").Code; got != http.StatusUnauthorized {
		t.Fatalf("campaign list with unknown session: %d", got)
	}
	if got := call("POST", "/api/v1/campaign/", owner, `{"name":"Invalid link","content_url":"javascript:alert(1)"}`).Code; got != http.StatusBadRequest {
		t.Fatalf("invalid campaign content: %d, want 400", got)
	}
	created := call("POST", "/api/v1/campaign/", owner, `{"name":"Campaign A","content_url":"https://youtu.be/dQw4w9WgXcQ"}`)
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
	public := call("GET", "/api/v1/campaign/"+id+"/public", "", "")
	var publicBody struct {
		CreatorName    string `json:"creator_name"`
		CreatorPicture string `json:"creator_picture"`
		ContentURL     string `json:"content_url"`
		Content        struct {
			Provider string `json:"provider"`
			EmbedURL string `json:"embed_url"`
		} `json:"content"`
	}
	if err := json.Unmarshal(public.Body.Bytes(), &publicBody); err != nil {
		t.Fatal(err)
	}
	if publicBody.CreatorPicture != "https://lh3.googleusercontent.com/test-avatar" {
		t.Errorf("missing creator picture: %+v", publicBody)
	}
	if publicBody.CreatorName != "Test "+ownerSubject || publicBody.ContentURL != "https://youtu.be/dQw4w9WgXcQ" || publicBody.Content.EmbedURL != "https://www.youtube.com/embed/dQw4w9WgXcQ" {
		t.Errorf("public campaign did not retain creator and content: %+v", publicBody)
	}
	for _, privateField := range []string{"email", "google_subject", "user_id", "token"} {
		var fields map[string]json.RawMessage
		_ = json.Unmarshal(public.Body.Bytes(), &fields)
		if _, found := fields[privateField]; found {
			t.Errorf("public campaign exposes %s", privateField)
		}
	}
	if err := db.Exec("UPDATE users SET name = '', picture = '' WHERE id = ?", ownerID).Error; err != nil {
		t.Fatal(err)
	}
	unnamed := call("GET", "/api/v1/campaign/"+id+"/public", "", "")
	var unnamedBody struct {
		CreatorName    string `json:"creator_name"`
		CreatorPicture string `json:"creator_picture"`
	}
	if err := json.Unmarshal(unnamed.Body.Bytes(), &unnamedBody); err != nil {
		t.Fatal(err)
	}
	if unnamed.Code != http.StatusOK || unnamedBody.CreatorName != "" || unnamedBody.CreatorPicture != "" {
		t.Fatalf("campaign without creator name: %d %s", unnamed.Code, unnamed.Body.String())
	}
	// A later Google sign-in refreshes the photo for an existing account.
	signIn(ownerSubject)
	refreshed := call("GET", "/api/v1/campaign/"+id+"/public", "", "")
	var refreshedBody struct {
		CreatorPicture string `json:"creator_picture"`
	}
	if err := json.Unmarshal(refreshed.Body.Bytes(), &refreshedBody); err != nil {
		t.Fatal(err)
	}
	if refreshedBody.CreatorPicture != "https://lh3.googleusercontent.com/test-avatar" {
		t.Errorf("returning sign-in did not refresh picture: %s", refreshed.Body.String())
	}
	textOnly := call("POST", "/api/v1/campaign/", owner, `{"name":"Text-only campaign"}`)
	if textOnly.Code != http.StatusCreated {
		t.Fatalf("campaign without content: %d %s", textOnly.Code, textOnly.Body.String())
	}
	var textOnlyBody struct {
		ID      uuid.UUID                 `json:"id"`
		Content *services.CampaignContent `json:"content"`
	}
	if err := json.Unmarshal(textOnly.Body.Bytes(), &textOnlyBody); err != nil {
		t.Fatal(err)
	}
	defer db.Exec("DELETE FROM campaigns WHERE id = ?", textOnlyBody.ID)
	if textOnlyBody.Content != nil {
		t.Error("text-only campaign unexpectedly has an embed")
	}
	if got := call("GET", "/api/v1/campaign/"+id, "", "").Code; got != http.StatusUnauthorized {
		t.Errorf("private campaign without session: %d", got)
	}
	if got := call("GET", "/api/v1/campaign/"+id, owner, "").Code; got != http.StatusOK {
		t.Errorf("private campaign as owner: %d", got)
	}
	if got := call("GET", "/api/v1/feedback/?campaign_id="+id, "", "").Code; got != http.StatusUnauthorized {
		t.Errorf("feedback list without session: %d", got)
	}

	// Another signed-in creator must not see this campaign at all.
	if got := call("GET", "/api/v1/campaign/"+id, other, "").Code; got != http.StatusNotFound {
		t.Errorf("campaign as other creator: %d, want 404", got)
	}
	if got := call("GET", "/api/v1/feedback/?campaign_id="+id, other, "").Code; got != http.StatusNotFound {
		t.Errorf("feedback as other creator: %d, want 404", got)
	}
	if body := call("GET", "/api/v1/campaign/", other, "").Body.String(); strings.Contains(body, id) {
		t.Errorf("other creator's list includes the campaign: %s", body)
	}

	for _, text := range []string{"1 accepted text", "2 original abuse", "3 vague content", "4 rejected text"} {
		w := call("POST", "/api/v1/feedback/", "", `{"campaign_id":"`+id+`","text":"`+text+`"}`)
		if w.Code != http.StatusOK || w.Body.String() != `{"sent":true}` {
			t.Fatalf("submit %q: %d %s", text, w.Code, w.Body.String())
		}
	}
	listed := call("GET", "/api/v1/feedback/?campaign_id="+id, owner, "")
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
	campaigns := call("GET", "/api/v1/campaign/", owner, "")
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

	// Signing out kills that session only.
	if got := call("POST", "/api/v1/auth/logout", owner, "").Code; got != http.StatusNoContent {
		t.Fatalf("logout: %d", got)
	}
	if got := call("GET", "/api/v1/auth/me", owner, "").Code; got != http.StatusUnauthorized {
		t.Errorf("me after logout: %d, want 401", got)
	}
	if got := call("GET", "/api/v1/auth/me", ownerAgain, "").Code; got != http.StatusOK {
		t.Errorf("other session after logout: %d, want 200", got)
	}
}
