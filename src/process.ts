import { ActorRefFrom, assertEvent, assign, fromCallback, setup } from "xstate";
import { ProgramConfiguration, StdMode } from "./config-parsing";
import { ChildProcess, spawn as spawnChildProcess } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createWriteStream } from "node:fs";

export const processMachine = setup({
  types: {
    events: {} as
      | {
          type: "Start";
        }
      | {
          type: "Process spawned";
          childProcess: ChildProcess;
        }
      | {
          type: "Process error";
        }
      | {
          type: "Process exited";
        }
      | { type: "Stop" },
    input: {} as {
      configuration: ProgramConfiguration;
    },
    context: {} as {
      configuration: ProgramConfiguration;
      childProcess: ChildProcess | undefined;
      processStartedAt: Date | undefined;
      processEndedAt: Date | undefined;
    },
  },
  actors: {
    "Spawn process": fromCallback<any, { configuration: ProgramConfiguration }>(
      ({ input, sendBack }) => {
        const childProcess = spawnChildProcess(
          input.configuration.cmd.split(" ")[0],
          input.configuration.cmd.split(" ").slice(1),
          {
            env: input.configuration.env,
            cwd: input.configuration.workingdir,
          }
        );

        if (input.configuration.stdout !== "NONE") {
          const stdoutFileStream = createWriteStream(
            input.configuration.stdout === "AUTO"
              ? join(tmpdir(), `xsupervisor-0-stdout.txt`)
              : input.configuration.stdout
          );

          childProcess.stdout.pipe(stdoutFileStream);
        }

        if (input.configuration.stderr !== "NONE") {
          const stderrFileStream = createWriteStream(
            input.configuration.stderr === "AUTO"
              ? join(tmpdir(), `xsupervisor-0-stderr.txt`)
              : input.configuration.stderr
          );

          childProcess.stderr.pipe(stderrFileStream);
        }

        childProcess.on("spawn", () => {
          sendBack({
            type: "Process spawned",
            childProcess,
          });
        });

        childProcess.on("error", (err) => {
          console.error("child process error", err);

          sendBack({
            type: "Process error",
          });
        });

        childProcess.on("exit", () => {
          console.log("child process exit");

          sendBack({
            type: "Process exited",
          });
        });
      }
    ),
  },
  actions: {
    "Assign child process to context": assign({
      childProcess: ({ event }) => {
        assertEvent(event, "Process spawned");

        return event.childProcess;
      },
    }),
    "Start process lifetime chronometer": assign({
      processStartedAt: new Date(),
      processEndedAt: undefined,
    }),
    "Stop process lifetime chronometer": assign({
      processEndedAt: new Date(),
    }),
  },
  delays: {
    "Process start time": ({ context }) =>
      context.configuration.starttime * 1000,
  },
}).createMachine({
  id: "Process",
  context: ({ input }) => {
    console.log("creating process machine", input.configuration);

    return {
      configuration: input.configuration,
      childProcess: undefined,
      processStartedAt: undefined,
      processEndedAt: undefined,
    };
  },
  initial: "Checking initial state",
  states: {
    "Checking initial state": {
      always: [
        {
          guard: ({ context }) => context.configuration.autostart === true,
          target: "Executing",
        },
        {
          target: "Stopped",
        },
      ],
    },
    Stopped: {
      on: {
        Start: {
          target: "Executing",
        },
      },
    },
    Executing: {
      exit: "Stop process lifetime chronometer",
      initial: "Starting",
      invoke: {
        src: "Spawn process",
        input: ({ context }) => ({ configuration: context.configuration }),
      },
      states: {
        Spawning: {
          on: {
            "Process spawned": {
              target: "Starting",
              actions: [
                "Assign child process to context",
                "Start process lifetime chronometer",
              ],
            },
            "Process exited": {
              target: "#Process.Backoff",
            },
            "Process error": {
              target: "#Process.Backoff",
            },
          },
        },
        Starting: {
          description: `Wait for the process to stabilize according to the starttime property before considering it running.`,
          after: {
            "Process start time": {
              target: "Running",
            },
          },
          on: {
            "Process exited": {
              target: "#Process.Backoff",
            },
          },
        },
        Running: {
          on: {
            "Process exited": {
              target: "#Process.Exited",
            },
          },
        },
      },
    },
    Backoff: {},
    Exited: {},
    Fatal: {},
  },
});

export type ProcessActor = ActorRefFrom<typeof processMachine>;
