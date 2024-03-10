import { ActorRefFrom, setup } from "xstate";
import { ProgramConfiguration } from "./config-parsing";

export const processMachine = setup({
  types: {
    input: {} as {
      configuration: ProgramConfiguration;
    },
    context: {} as {
      configuration: ProgramConfiguration;
    },
  },
}).createMachine({
  context: ({ input }) => {
    console.log("creating process machine", input.configuration);

    return {
      configuration: input.configuration,
    };
  },
});

export type ProcessActor = ActorRefFrom<typeof processMachine>;
