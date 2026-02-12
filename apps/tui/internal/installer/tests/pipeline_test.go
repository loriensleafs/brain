package installer_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/peterkloss/brain-tui/internal/installer"
)

func TestExecute_SuccessPath(t *testing.T) {
	var order []string
	p := installer.Pipeline{
		Steps: []installer.Step{
			{Name: "a", Action: func(ctx context.Context) error { order = append(order, "a"); return nil }},
			{Name: "b", Action: func(ctx context.Context) error { order = append(order, "b"); return nil }},
			{Name: "c", Action: func(ctx context.Context) error { order = append(order, "c"); return nil }},
		},
	}

	if err := p.Execute(context.Background()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	got := strings.Join(order, ",")
	if got != "a,b,c" {
		t.Errorf("execution order = %q, want a,b,c", got)
	}
}

func TestExecute_FailureRollsBackCompletedSteps(t *testing.T) {
	var undone []string
	fail := errors.New("boom")

	p := installer.Pipeline{
		Steps: []installer.Step{
			{
				Name:   "a",
				Action: func(ctx context.Context) error { return nil },
				Undo:   func(ctx context.Context) error { undone = append(undone, "a"); return nil },
			},
			{
				Name:   "b",
				Action: func(ctx context.Context) error { return nil },
				Undo:   func(ctx context.Context) error { undone = append(undone, "b"); return nil },
			},
			{
				Name:   "c",
				Action: func(ctx context.Context) error { return fail },
				Undo:   func(ctx context.Context) error { undone = append(undone, "c"); return nil },
			},
		},
	}

	err := p.Execute(context.Background())
	if err == nil {
		t.Fatal("expected error")
	}

	if !strings.Contains(err.Error(), `step "c" failed`) {
		t.Errorf("error = %q, want step name in message", err.Error())
	}
	if !errors.Is(err, fail) {
		t.Errorf("error chain should contain original error")
	}

	// Undo called in reverse on completed steps (a, b) -- not on c which failed.
	got := strings.Join(undone, ",")
	if got != "b,a" {
		t.Errorf("undo order = %q, want b,a", got)
	}
}

func TestExecute_ConditionSkipsStep(t *testing.T) {
	var ran []string
	p := installer.Pipeline{
		Steps: []installer.Step{
			{Name: "a", Action: func(ctx context.Context) error { ran = append(ran, "a"); return nil }},
			{
				Name:      "b-skip",
				Condition: func() bool { return false },
				Action:    func(ctx context.Context) error { ran = append(ran, "b"); return nil },
			},
			{Name: "c", Action: func(ctx context.Context) error { ran = append(ran, "c"); return nil }},
		},
	}

	if err := p.Execute(context.Background()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	got := strings.Join(ran, ",")
	if got != "a,c" {
		t.Errorf("ran = %q, want a,c (b should be skipped)", got)
	}
}

func TestExecute_NilUndoSkippedDuringRollback(t *testing.T) {
	var undone []string

	p := installer.Pipeline{
		Steps: []installer.Step{
			{
				Name:   "a",
				Action: func(ctx context.Context) error { return nil },
				Undo:   func(ctx context.Context) error { undone = append(undone, "a"); return nil },
			},
			{
				Name:   "b-no-undo",
				Action: func(ctx context.Context) error { return nil },
				// Undo is nil
			},
			{
				Name:   "c-fail",
				Action: func(ctx context.Context) error { return errors.New("fail") },
			},
		},
	}

	err := p.Execute(context.Background())
	if err == nil {
		t.Fatal("expected error")
	}

	got := strings.Join(undone, ",")
	if got != "a" {
		t.Errorf("undone = %q, want a (b has nil Undo)", got)
	}
}

func TestExecute_UndoFailureSurfacedInError(t *testing.T) {
	p := installer.Pipeline{
		Steps: []installer.Step{
			{
				Name:   "a",
				Action: func(ctx context.Context) error { return nil },
				Undo:   func(ctx context.Context) error { return errors.New("undo-a-failed") },
			},
			{
				Name:   "b",
				Action: func(ctx context.Context) error { return nil },
				Undo:   func(ctx context.Context) error { return errors.New("undo-b-failed") },
			},
			{
				Name:   "c",
				Action: func(ctx context.Context) error { return errors.New("action-failed") },
			},
		},
	}

	err := p.Execute(context.Background())
	if err == nil {
		t.Fatal("expected error")
	}

	msg := err.Error()
	if !strings.Contains(msg, "action-failed") {
		t.Errorf("error missing original cause: %q", msg)
	}
	if !strings.Contains(msg, "undo-a-failed") {
		t.Errorf("error missing undo-a failure: %q", msg)
	}
	if !strings.Contains(msg, "undo-b-failed") {
		t.Errorf("error missing undo-b failure: %q", msg)
	}
}

func TestExecute_ContextCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	var undone []string

	p := installer.Pipeline{
		Steps: []installer.Step{
			{
				Name: "a",
				Action: func(ctx context.Context) error {
					cancel() // cancel before next step runs
					return nil
				},
				Undo: func(ctx context.Context) error { undone = append(undone, "a"); return nil },
			},
			{
				Name:   "b-never-runs",
				Action: func(ctx context.Context) error { t.Error("step b should not run"); return nil },
			},
		},
	}

	err := p.Execute(ctx)
	if err == nil {
		t.Fatal("expected error from cancellation")
	}

	if !strings.Contains(err.Error(), "pipeline cancelled") {
		t.Errorf("error = %q, want pipeline cancelled message", err.Error())
	}

	if !errors.Is(err, context.Canceled) {
		t.Errorf("error chain should contain context.Canceled")
	}

	got := strings.Join(undone, ",")
	if got != "a" {
		t.Errorf("undone = %q, want a (completed step should be rolled back)", got)
	}
}

func TestExecute_EmptyPipeline(t *testing.T) {
	p := installer.Pipeline{}
	if err := p.Execute(context.Background()); err != nil {
		t.Fatalf("empty pipeline should succeed, got: %v", err)
	}
}

func TestExecute_ConditionTrueRunsStep(t *testing.T) {
	ran := false
	p := installer.Pipeline{
		Steps: []installer.Step{
			{
				Name:      "a",
				Condition: func() bool { return true },
				Action:    func(ctx context.Context) error { ran = true; return nil },
			},
		},
	}

	if err := p.Execute(context.Background()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !ran {
		t.Error("step with Condition returning true should have run")
	}
}
