module github.com/peterkloss/brain/apps/claude-plugin

go 1.21

require (
	github.com/peterkloss/brain/packages/utils v0.0.0
	github.com/peterkloss/brain/packages/validation v0.0.0
)

require (
	github.com/santhosh-tekuri/jsonschema/v6 v6.0.1 // indirect
	golang.org/x/text v0.14.0 // indirect
)

replace github.com/peterkloss/brain/packages/utils => ../../packages/utils

replace github.com/peterkloss/brain/packages/validation => ../../packages/validation
