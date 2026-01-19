package main

import (
	"fmt"
	"os"

)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "Usage: brain-hooks <command>")
		fmt.Fprintln(os.Stderr, "Commands:")
		fmt.Fprintln(os.Stderr, "  session-start    Initialize session with bootstrap context")
		fmt.Fprintln(os.Stderr, "  user-prompt      Process user prompt for scenario detection")
		fmt.Fprintln(os.Stderr, "  pre-tool-use     Check if tool is allowed in current mode")
		fmt.Fprintln(os.Stderr, "  stop             Validate session before ending")
		fmt.Fprintln(os.Stderr, "  detect-scenario  Detect scenario from prompt")
		fmt.Fprintln(os.Stderr, "  load-skills      Load skill markdown files")
		fmt.Fprintln(os.Stderr, "  analyze          Step-by-step codebase analysis workflow")
		fmt.Fprintln(os.Stderr, "  validate-session Validate session before completion")
		os.Exit(1)
	}

	var err error
	switch os.Args[1] {
	case "session-start":
		err = RunSessionStart()
	case "user-prompt":
		err = RunUserPrompt()
	case "pre-tool-use":
		err = RunPreToolUse()
	case "stop":
		err = RunStop()
	case "detect-scenario":
		err = RunDetectScenario()
	case "load-skills":
		err = RunLoadSkills()
	case "analyze":
		err = RunAnalyze()
	case "validate-session":
		err = RunValidateSession()
	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n", os.Args[1])
		os.Exit(1)
	}

	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
