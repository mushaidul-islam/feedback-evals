package main

import (
	"fmt"
	"os"

	"github.com/mushaidul/truth-be-told/backend/cmd"
)

func main() {
	if err := cmd.Server(); err != nil {
		fmt.Fprintf(os.Stderr, "fatal: %v\n", err)
		os.Exit(1)
	}
}
