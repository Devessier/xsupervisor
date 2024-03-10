import { readAndParseConfigurationFile } from "./config-parsing";
import { join as pathJoin } from "node:path";
import { rootManagerMachine } from "./root-manager";
import { createActor } from "xstate";
import Fastify from "fastify";

async function main() {
  const configuration = await readAndParseConfigurationFile(
    pathJoin(__dirname, "../supervisor.yaml")
  );

  const rootManager = createActor(rootManagerMachine, {
    input: {
      configuration,
    },
  });

  rootManager.start();

  const httpServer = Fastify({});

  await httpServer.listen({ port: 3000 });
}

main().catch(console.error);
