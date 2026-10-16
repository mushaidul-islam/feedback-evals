package services

import (
	"errors"
	"net/url"
	"regexp"
	"strings"
)

var ErrInvalidContentURL = errors.New("use an HTTPS post or video link from YouTube, X, TikTok, LinkedIn, Facebook, or Instagram")

// CampaignContent contains only provider URLs constructed from recognized links.
// No remote HTML is fetched or stored.
type CampaignContent struct {
	Provider string `json:"provider"`
	URL      string `json:"url"`
	EmbedURL string `json:"embed_url,omitempty"`
}

var (
	youtubeVideoID = regexp.MustCompile(`^[A-Za-z0-9_-]{11}$`)
	xPost          = regexp.MustCompile(`^(?:[A-Za-z0-9_]+/status|i/web/status)/[0-9]+$`)
	tiktokVideo    = regexp.MustCompile(`^@[^/]+/(?:video|photo)/([0-9]+)$`)
	instagramPost  = regexp.MustCompile(`^(p|reel|tv)/([A-Za-z0-9_-]+)$`)
	linkedinFeed   = regexp.MustCompile(`^feed/update/(urn:li:(?:activity|share|ugcPost):[0-9]+)$`)
	linkedinPost   = regexp.MustCompile(`^posts/[^/]*[-_]activity-([0-9]+)(?:-[^/]*)?$`)
	facebookPost   = regexp.MustCompile(`^(?:.+/posts/[^/]+|share/p/[A-Za-z0-9]+)$`)
	facebookVideo  = regexp.MustCompile(`^(?:.+/videos/[0-9]+|reel/[0-9]+|share/v/[A-Za-z0-9]+)$`)
	shareCode      = regexp.MustCompile(`^[A-Za-z0-9]+$`)
)

func ParseCampaignContent(raw string) (*CampaignContent, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}
	u, err := url.Parse(raw)
	if err != nil || len(raw) > 2048 || u.Scheme != "https" || u.User != nil || (u.Port() != "" && u.Port() != "443") {
		return nil, ErrInvalidContentURL
	}
	u.Fragment = ""
	content := &CampaignContent{URL: u.String()}
	host := strings.TrimPrefix(strings.ToLower(u.Hostname()), "www.")
	path := strings.Trim(u.Path, "/")
	switch host {
	case "youtube.com", "m.youtube.com", "youtu.be":
		id := ""
		if host == "youtu.be" {
			id = path
		} else if path == "watch" {
			id = u.Query().Get("v")
		} else if parts := strings.Split(path, "/"); len(parts) == 2 && (parts[0] == "shorts" || parts[0] == "embed" || parts[0] == "live") {
			id = parts[1]
		}
		if youtubeVideoID.MatchString(id) {
			content.Provider = "YouTube"
			content.EmbedURL = "https://www.youtube.com/embed/" + id
		}
	case "x.com", "twitter.com", "mobile.twitter.com":
		if xPost.MatchString(path) {
			content.Provider = "X"
		}
	case "tiktok.com", "m.tiktok.com":
		if match := tiktokVideo.FindStringSubmatch(path); match != nil {
			content.Provider = "TikTok"
			content.EmbedURL = "https://www.tiktok.com/player/v1/" + match[1]
		}
	case "vm.tiktok.com", "vt.tiktok.com":
		// Short share links require resolution. Keep the original link usable
		// without making the API follow arbitrary external redirects.
		if shareCode.MatchString(path) {
			content.Provider = "TikTok"
		}
	case "instagram.com":
		if match := instagramPost.FindStringSubmatch(path); match != nil {
			content.Provider = "Instagram"
			content.EmbedURL = "https://www.instagram.com/" + match[1] + "/" + match[2] + "/embed/"
		}
	case "linkedin.com":
		identity := ""
		if match := linkedinFeed.FindStringSubmatch(path); match != nil {
			identity = match[1]
		} else if match := linkedinPost.FindStringSubmatch(path); match != nil {
			identity = "urn:li:activity:" + match[1]
		}
		if identity != "" {
			content.Provider = "LinkedIn"
			content.EmbedURL = "https://www.linkedin.com/embed/feed/update/" + identity
		}
	case "facebook.com", "m.facebook.com":
		plugin := ""
		if facebookPost.MatchString(path) || ((path == "permalink.php" || path == "story.php") && u.Query().Get("story_fbid") != "" && u.Query().Get("id") != "") {
			plugin = "post.php"
		} else if facebookVideo.MatchString(path) || (path == "watch" && u.Query().Get("v") != "") {
			plugin = "video.php"
		}
		if plugin != "" {
			content.Provider = "Facebook"
			content.EmbedURL = "https://www.facebook.com/plugins/" + plugin + "?href=" + url.QueryEscape(content.URL) + "&show_text=true&width=500"
		}
	}
	if content.Provider == "" {
		return nil, ErrInvalidContentURL
	}
	return content, nil
}
