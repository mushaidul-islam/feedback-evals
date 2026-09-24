package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Feedback struct {
	ID         uuid.UUID `gorm:"type:uuid;primaryKey"`
	CampaignID uuid.UUID `gorm:"type:uuid;not null;index"`
	Campaign   Campaign  `gorm:"foreignKey:CampaignID;constraint:OnDelete:CASCADE"`
	Text       string    `gorm:"not null"`
	CreatedAt  time.Time
}

func (f *Feedback) BeforeCreate(_ *gorm.DB) error {
	if f.ID == uuid.Nil {
		id, err := uuid.NewV7()
		if err != nil {
			return err
		}
		f.ID = id
	}
	return nil
}
