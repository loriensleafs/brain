module github.com/peterkloss/brain/packages/validation

go 1.21

require (
	github.com/peterkloss/brain/packages/utils v0.0.0
	github.com/santhosh-tekuri/jsonschema/v6 v6.0.1
)

require golang.org/x/text v0.14.0 // indirect

replace github.com/peterkloss/brain/packages/utils => ../utils
