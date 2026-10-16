package services

import (
	"strings"
	"testing"
)

func TestCampaignContent(t *testing.T) {
	cases := []struct {
		name, input, provider, embedURL string
	}{
		{"YouTube watch", "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10", "YouTube", "https://www.youtube.com/embed/dQw4w9WgXcQ"},
		{"YouTube short link", "https://youtu.be/dQw4w9WgXcQ?si=tracking", "YouTube", "https://www.youtube.com/embed/dQw4w9WgXcQ"},
		{"YouTube Shorts", "https://youtube.com/shorts/dQw4w9WgXcQ", "YouTube", "https://www.youtube.com/embed/dQw4w9WgXcQ"},
		{"X", "https://x.com/example/status/123456789", "X", ""},
		{"Twitter", "https://twitter.com/example/status/123456789", "X", ""},
		{"TikTok", "https://www.tiktok.com/@example/video/123456789", "TikTok", "https://www.tiktok.com/player/v1/123456789"},
		{"TikTok photo post", "https://www.tiktok.com/@example/photo/123456789", "TikTok", "https://www.tiktok.com/player/v1/123456789"},
		{"TikTok share link fallback", "https://vm.tiktok.com/ABC123/", "TikTok", ""},
		{"LinkedIn post", "https://www.linkedin.com/posts/example_a-post-activity-123456789-abcd", "LinkedIn", "https://www.linkedin.com/embed/feed/update/urn:li:activity:123456789"},
		{"LinkedIn feed", "https://www.linkedin.com/feed/update/urn:li:share:123456789/", "LinkedIn", "https://www.linkedin.com/embed/feed/update/urn:li:share:123456789"},
		{"LinkedIn activity after username", "https://www.linkedin.com/posts/example_activity-123456789-abcd", "LinkedIn", "https://www.linkedin.com/embed/feed/update/urn:li:activity:123456789"},
		{"Instagram post", "https://www.instagram.com/p/ABC_def-123/?utm_source=example", "Instagram", "https://www.instagram.com/p/ABC_def-123/embed/"},
		{"Instagram reel", "https://instagram.com/reel/ABC_def-123/", "Instagram", "https://www.instagram.com/reel/ABC_def-123/embed/"},
		{"Facebook", "https://www.facebook.com/example/posts/123456789", "Facebook", "https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2Fexample%2Fposts%2F123456789&show_text=true&width=500"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			content, err := ParseCampaignContent(tc.input)
			if err != nil {
				t.Fatal(err)
			}
			if content.Provider != tc.provider || content.EmbedURL != tc.embedURL {
				t.Fatalf("content = %+v, want provider %q and embed %q", content, tc.provider, tc.embedURL)
			}
		})
	}
	if content, err := ParseCampaignContent(" \n "); err != nil || content != nil {
		t.Fatalf("optional empty link = %+v, %v", content, err)
	}
}

func TestCampaignContentRejectsInvalidLinks(t *testing.T) {
	for _, raw := range []string{
		"javascript:alert(1)", "http://youtube.com/watch?v=dQw4w9WgXcQ",
		"https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
		"https://youtube.com@evil.example/watch?v=dQw4w9WgXcQ",
		"https://user:password@youtube.com/watch?v=dQw4w9WgXcQ",
		"https://youtube.com:9000/watch?v=dQw4w9WgXcQ",
		"https://youtube.com/watch?v=invalid", "https://youtube.com/",
		"https://x.com/example", "https://instagram.com/example",
		"https://linkedin.com/in/example", "https://facebook.com/",
		"https://example.com/video", "https://youtu.be/" + strings.Repeat("a", 2100),
	} {
		t.Run(raw[:min(len(raw), 80)], func(t *testing.T) {
			if _, err := ParseCampaignContent(raw); err == nil {
				t.Fatal("accepted invalid content link")
			}
		})
	}
}
