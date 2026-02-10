package cmd

import (
	"context"
	"fmt"
	"os"
	"runtime"
	"strings"

	"github.com/creativeprojects/go-selfupdate"
	"github.com/spf13/cobra"
)

const (
	repoOwner = "loriensleafs"
	repoName  = "brain"
)

var (
	upgradeCheck bool
	upgradeForce bool
)

var upgradeCmd = &cobra.Command{
	Use:   "upgrade",
	Short: "Upgrade the brain binary to the latest release",
	Long: `Checks GitHub Releases for a newer version of brain and upgrades in-place.

The binary is downloaded, verified against the published checksum, and
atomically replaces the running binary.

Use --check to see if an update is available without installing it.
Use --force to re-install even when already on the latest version.`,
	RunE: runUpgrade,
}

func init() {
	upgradeCmd.Flags().BoolVar(&upgradeCheck, "check", false, "check for updates without installing")
	upgradeCmd.Flags().BoolVar(&upgradeForce, "force", false, "upgrade even if already on latest version")
	rootCmd.AddCommand(upgradeCmd)
}

func runUpgrade(_ *cobra.Command, _ []string) error {
	ctx := context.Background()

	current := strings.TrimPrefix(Version, "v")

	source, err := selfupdate.NewGitHubSource(selfupdate.GitHubConfig{})
	if err != nil {
		return fmt.Errorf("init github source: %w", err)
	}

	updater, err := selfupdate.NewUpdater(selfupdate.Config{
		Source: source,
	})
	if err != nil {
		return fmt.Errorf("init updater: %w", err)
	}

	slug := repoOwner + "/" + repoName

	latest, found, err := updater.DetectLatest(ctx, selfupdate.ParseSlug(slug))
	if err != nil {
		return fmt.Errorf("check for updates: %w", err)
	}
	if !found {
		fmt.Println("No releases found.")
		return nil
	}

	latestVer := latest.Version()
	hasUpdate := latest.GreaterThan(current)

	if upgradeCheck {
		if !hasUpdate {
			fmt.Printf("brain v%s is already the latest version.\n", current)
		} else {
			fmt.Printf("Update available: v%s -> v%s\n", current, latestVer)
			fmt.Println("Run 'brain upgrade' to install it.")
		}
		return nil
	}

	if !hasUpdate && !upgradeForce {
		fmt.Printf("brain v%s is already the latest version. Use --force to reinstall.\n", current)
		return nil
	}

	exe, err := os.Executable()
	if err != nil {
		return fmt.Errorf("locate current binary: %w", err)
	}

	fmt.Printf("Upgrading brain v%s -> v%s (%s/%s)...\n", current, latestVer, runtime.GOOS, runtime.GOARCH)

	if err := updater.UpdateTo(ctx, latest, exe); err != nil {
		return fmt.Errorf("upgrade failed: %w", err)
	}

	fmt.Printf("Updated brain from v%s to v%s\n", current, latestVer)
	fmt.Println("\nRun 'brain install' to update plugins.")

	return nil
}
