package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"google.golang.org/api/idtoken"
	"gorm.io/gorm"

	"github.com/mushaidul/truth-be-told/backend/internal/models"
)

// sessionTTL is how long a sign-in lasts before Google is asked again.
const sessionTTL = 30 * 24 * time.Hour

var (
	ErrInvalidCredential = errors.New("invalid google credential")
	ErrInvalidSession    = errors.New("invalid or expired session")
)

// GoogleVerifier checks a Google ID token against our client ID. In production
// it is idtoken.Validate; tests pass a stub so they never call Google.
type GoogleVerifier func(ctx context.Context, idToken, audience string) (*idtoken.Payload, error)

type AuthService struct {
	db       *gorm.DB
	users    *UserService
	clientID string
	verify   GoogleVerifier
}

func NewAuthService(db *gorm.DB, users *UserService, clientID string, verify GoogleVerifier) *AuthService {
	return &AuthService{db: db, users: users, clientID: clientID, verify: verify}
}

type SignInResult struct {
	Token     string
	ExpiresAt time.Time
	User      models.User
}

// SignInWithGoogle turns the credential from the "Sign in with Google" button
// into a session.
//
// The credential is a signed token from Google. Validate checks the signature,
// that it has not expired, and that it was issued for our client ID -- a token
// minted for some other website is rejected here.
func (s *AuthService) SignInWithGoogle(ctx context.Context, credential string) (SignInResult, error) {
	payload, err := s.verify(ctx, credential, s.clientID)
	if err != nil {
		return SignInResult{}, fmt.Errorf("%w: %v", ErrInvalidCredential, err)
	}

	email, _ := payload.Claims["email"].(string)
	verified, _ := payload.Claims["email_verified"].(bool)
	name, _ := payload.Claims["name"].(string)
	if payload.Subject == "" || email == "" || !verified {
		return SignInResult{}, ErrInvalidCredential
	}

	user, err := s.users.EnsureUser(ctx, payload.Subject, email, name)
	if err != nil {
		return SignInResult{}, err
	}

	token, err := newSessionToken()
	if err != nil {
		return SignInResult{}, err
	}

	session := models.Session{
		UserID:    user.ID,
		TokenHash: hashToken(token),
		ExpiresAt: time.Now().Add(sessionTTL),
	}
	if err := s.db.WithContext(ctx).Create(&session).Error; err != nil {
		return SignInResult{}, fmt.Errorf("creating session: %w", err)
	}

	return SignInResult{Token: token, ExpiresAt: session.ExpiresAt, User: user}, nil
}

// UserIDForToken returns the user a session token belongs to.
func (s *AuthService) UserIDForToken(ctx context.Context, token string) (uuid.UUID, error) {
	var session models.Session

	err := s.db.WithContext(ctx).
		Where("token_hash = ? AND expires_at > ?", hashToken(token), time.Now()).
		First(&session).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return uuid.Nil, ErrInvalidSession
		}
		return uuid.Nil, fmt.Errorf("reading session: %w", err)
	}

	return session.UserID, nil
}

// SignOut deletes the session, so the token stops working immediately.
func (s *AuthService) SignOut(ctx context.Context, token string) error {
	err := s.db.WithContext(ctx).
		Where("token_hash = ?", hashToken(token)).
		Delete(&models.Session{}).Error
	if err != nil {
		return fmt.Errorf("deleting session: %w", err)
	}
	return nil
}

// newSessionToken returns 32 random bytes as URL-safe text: unguessable, and
// safe to put in a cookie.
func newSessionToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generating session token: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
