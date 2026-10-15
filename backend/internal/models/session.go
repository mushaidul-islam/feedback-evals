package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Session is one signed-in browser. The token itself is never stored, only
// its SHA-256 hash, so a leaked database dump cannot be used to sign in.
type Session struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey"`
	UserID    uuid.UUID `gorm:"type:uuid;not null;index"`
	User      User      `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE"`
	TokenHash string    `gorm:"uniqueIndex;not null"`
	ExpiresAt time.Time `gorm:"not null;index"`
	CreatedAt time.Time
}

func (s *Session) BeforeCreate(_ *gorm.DB) error {
	if s.ID != uuid.Nil {
		return nil
	}

	id, err := uuid.NewV7()
	if err != nil {
		return err
	}
	s.ID = id

	return nil
}
