// Package services holds the business logic. Nothing here knows about HTTP.
package services

import (
	"context"
	"sync"
	"time"
)

// Check is one named dependency probe. Register the database, cache, or any
// external service here as they are added.
type Check struct {
	Name  string
	Probe func(ctx context.Context) error
}

// Liveness answers "is this process alive?"
type Liveness struct {
	Status  string `json:"status"`
	Version string `json:"version"`
	Uptime  string `json:"uptime"`
}

// Readiness answers "should this instance receive traffic?"
type Readiness struct {
	Status string        `json:"status"`
	Checks []CheckResult `json:"checks"`
}

// CheckResult is the outcome of one dependency probe.
type CheckResult struct {
	Name    string `json:"name"`
	OK      bool   `json:"ok"`
	Latency string `json:"latency"`
	Error   string `json:"error,omitempty"`
}

// Healthy reports whether every check passed.
func (r Readiness) Healthy() bool {
	for _, c := range r.Checks {
		if !c.OK {
			return false
		}
	}
	return true
}

// Health reports process and dependency health.
type Health struct {
	version string
	started time.Time
	checks  []Check
	timeout time.Duration
}

// NewHealth builds a Health service. version is stamped in at build time.
func NewHealth(version string, checks ...Check) *Health {
	return &Health{
		version: version,
		started: time.Now(),
		checks:  checks,
		// Bounds the whole sweep, so one hanging dependency cannot hang /readyz.
		timeout: 3 * time.Second,
	}
}

// Live reports that the process can serve. It touches no dependency on
// purpose: if it checked the database, an outage would restart every replica
// at once and leave nothing running when the database recovered.
func (h *Health) Live(ctx context.Context) Liveness {
	return Liveness{
		Status:  "ok",
		Version: h.version,
		Uptime:  time.Since(h.started).Round(time.Second).String(),
	}
}

// Ready runs every check concurrently, so latency is the slowest probe rather
// than the sum of all of them.
func (h *Health) Ready(ctx context.Context) Readiness {
	ctx, cancel := context.WithTimeout(ctx, h.timeout)
	defer cancel()

	results := make([]CheckResult, len(h.checks))

	var wg sync.WaitGroup
	for i, check := range h.checks {
		wg.Add(1)
		go func(i int, c Check) {
			defer wg.Done()

			start := time.Now()
			err := c.Probe(ctx)

			// Each goroutine owns its own index, so no mutex is needed.
			results[i] = CheckResult{
				Name:    c.Name,
				OK:      err == nil,
				Latency: time.Since(start).Round(time.Millisecond).String(),
			}
			if err != nil {
				results[i].Error = err.Error()
			}
		}(i, check)
	}
	wg.Wait()

	out := Readiness{Status: "ready", Checks: results}
	if !out.Healthy() {
		out.Status = "not_ready"
	}
	return out
}
