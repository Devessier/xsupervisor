import { readAndParseConfigurationFile } from "./config-parsing";
import { join as pathJoin } from "node:path";
import { rootManagerMachine } from "./root-manager";
import { createActor } from "xstate";

async function main() {
  const configuration = await readAndParseConfigurationFile(
    pathJoin(__dirname, "../supervisor.yaml")
  );

  console.log("configuration", JSON.stringify(configuration, null, 2));

  const rootManager = createActor(rootManagerMachine, {
    input: {
      configuration,
    },
  });

  rootManager.start();
}

main().catch(console.error);
