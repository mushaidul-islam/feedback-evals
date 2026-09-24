package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// - uuid primary key, filled in by BeforeCreate
// - CreatedAt and UpdatedAt named exactly that, so GORM maintains them
// - constraints in the gorm tag, not left to be enforced by hand later
type User struct {
	ID            uuid.UUID `gorm:"type:uuid;primaryKey"`
	GoogleSubject string    `gorm:"uniqueIndex;not null"`
	Email         string    `gorm:"not null"`
	Name          string    `gorm:"not null;default:''"`
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// BeforeCreate assigns the id if the caller did not.
func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID != uuid.Nil {
		return nil
	}

	id, err := uuid.NewV7()
	if err != nil {
		return err
	}
	u.ID = id

	return nil
}
