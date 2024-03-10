import { ActorRefFrom, enqueueActions, setup } from "xstate";
import { ProgramConfiguration } from "./config-parsing";
import { ProcessActor, processMachine } from "./process";

export const programMachine = setup({
  types: {
    events: {} as {
      type: "Start";
    },
    input: {} as {
      configuration: ProgramConfiguration;
    },
    context: {} as {
      configuration: ProgramConfiguration;
      processActors: Array<ProcessActor>;
    },
  },
  actors: {
    "Process monitor": processMachine,
  },
}).createMachine({
  context: ({ input, spawn }) => {
    const processActors: Array<ProcessActor> = [];

    for (
      let processIndex = 0;
      processIndex < input.configuration.numprocs;
      processIndex++
    ) {
      processActors[processIndex] = spawn("Process monitor", {
        input: {
          configuration: input.configuration,
        },
      });
    }

    return {
      configuration: input.configuration,
      processActors,
    };
  },
  on: {
    Start: {
      actions: enqueueActions(({ context, enqueue }) => {
        for (const processActor of context.processActors) {
          enqueue.sendTo(processActor, {
            type: "Start",
          });
        }
      }),
    },
  },
});

export type ProgramActor = ActorRefFrom<typeof programMachine>;
