package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// - uuid primary key, filled in by BeforeCreate
// - CreatedAt and UpdatedAt named exactly that, so GORM maintains them
// - constraints in the gorm tag, not left to be enforced by hand later
type Campaign struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey"`
	UserID    uuid.UUID `gorm:"type:uuid;not null;index"`
	Name      string    `gorm:"not null;default:''"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

// BeforeCreate assigns the id if the caller did not.
func (c *Campaign) BeforeCreate(tx *gorm.DB) error {
	if c.ID != uuid.Nil {
		return nil
	}

	id, err := uuid.NewV7()
	if err != nil {
		return err
	}
	c.ID = id

	return nil
}
