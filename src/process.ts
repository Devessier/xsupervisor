import {
  ActorRefFrom,
  assertEvent,
  assign,
  fromCallback,
  log,
  setup,
} from "xstate";
import { ProgramConfiguration } from "./config-parsing";
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
      startRetries: number;
    },
  },
  actors: {
    "Spawn process": fromCallback<any, { configuration: ProgramConfiguration }>(
      ({ input, sendBack }) => {
        console.log("Spawning process...");

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
    "Increment start retries in context": assign({
      startRetries: ({ context }) => context.startRetries + 1,
    }),
    "Reset start retries in context": assign({
      startRetries: 0,
    }),
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
  guards: {
    "Reached max start tries": ({ context }) =>
      context.startRetries >= context.configuration.startretries,
  },
}).createMachine({
  id: "Process",
  context: ({ input }) => {
    return {
      configuration: input.configuration,
      childProcess: undefined,
      processStartedAt: undefined,
      processEndedAt: undefined,
      startRetries: 0,
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
      entry: log("Enters Stopped state"),
      on: {
        Start: {
          target: "Executing",
        },
      },
    },
    Executing: {
      entry: log("Enters Executing state"),
      exit: "Stop process lifetime chronometer",
      initial: "Starting",
      invoke: {
        src: "Spawn process",
        input: ({ context }) => ({ configuration: context.configuration }),
      },
      states: {
        Spawning: {
          entry: log("Enters Executing.Spawning state"),
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
          entry: log("Enters Executing.Starting state"),
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
          entry: [
            log("Enters Executing.Running state"),
            "Reset start retries in context",
          ],
          on: {
            "Process exited": {
              target: "#Process.Exited",
            },
          },
        },
      },
    },
    Backoff: {
      entry: log("Enters Backoff state"),
      always: [
        {
          guard: "Reached max start tries",
          target: "Fatal",
        },
        {
          target: "Executing",
          actions: "Increment start retries in context",
        },
      ],
    },
    Exited: {
      entry: log("Enters Exited state"),
    },
    Fatal: {
      entry: log("Enters Fatal state"),
    },
  },
});

export type ProcessActor = ActorRefFrom<typeof processMachine>;
