# xsupervisor

A simple reimplementation of the supervisor program with Node.js and XState.

## Specifications

xsupervisor uses the `supervisor.yaml` file to define its initial configuration. As many programs as you want can be managed by xsupervisor, and each program needs to define a command to run. Many properties of the command can be configured, like the number of processes to launch, whether processes should be restarted if they exit with an unexpected exit code, etc.

Users can use the CLI and Web UI to control processes after xsupervisor boots up.
