import { readAndParseConfigurationFile } from "./config-parsing";
import { join as pathJoin } from "node:path";

async function main() {
  const configuration = await readAndParseConfigurationFile(
    pathJoin(__dirname, "../supervisor.yaml")
  );

  console.log("configuration", JSON.stringify(configuration, null, 2));
}

main().catch(console.error);
