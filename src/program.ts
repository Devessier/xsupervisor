import { ActorRefFrom, setup } from "xstate";
import { ProgramConfiguration } from "./config-parsing";
import { ProcessActor, processMachine } from "./process";

export const programMachine = setup({
  types: {
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
});

export type ProgramActor = ActorRefFrom<typeof programMachine>;
