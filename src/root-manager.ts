import { setup } from "xstate";
import { Configuration } from "./config-parsing";
import { ProgramActor, programMachine } from "./program";

export const rootManagerMachine = setup({
  types: {
    input: {} as {
      configuration: Configuration;
    },
    context: {} as {
      configuration: Configuration;
      programActors: Record<string, ProgramActor>;
    },
  },
  actors: {
    "Program monitor": programMachine,
  },
}).createMachine({
  context: ({ input, spawn }) => {
    const programActors: Record<string, ProgramActor> = {};

    for (const [programName, programConfiguration] of Object.entries(
      input.configuration.programs
    )) {
      programActors[programName] = spawn("Program monitor", {
        input: {
          configuration: programConfiguration,
        },
      });
    }

    return {
      configuration: input.configuration,
      programActors,
    };
  },
});
