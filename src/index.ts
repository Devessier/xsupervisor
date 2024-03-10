import { readAndParseConfigurationFile } from "./config-parsing";
import { join as pathJoin } from "node:path";
import { rootManagerMachine } from "./root-manager";
import { createActor } from "xstate";
import Fastify from "fastify";
import sade from "sade";
import {
  ZodTypeProvider,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import z from "zod";

const GetProgramStateResponseBody = z.object({
  processes: z.array(
    z.object({
      status: z.unknown(),
    })
  ),
});

const cli = sade("xsupervisor");

cli.version("0.0.0");

cli
  .command("server")
  .describe("Launch the xsupervisor server")
  .option(
    "--config, -c",
    "The configuration YAML file to define the initial setup of xsupervisor"
  )
  .action(() => {
    launchServer().catch(console.error);
  });

cli
  .command("dashboard get-state <program>")
  .describe("Get the state of a program")
  .action(async (program) => {
    try {
      const res = await fetch(`http://localhost:3000/program/${program}`);
      if (res.status === 404) {
        console.error(`The program "${program}" does not exist.`);

        return;
      }

      if (res.status !== 200) {
        throw new Error("Unknown error");
      }

      const body = GetProgramStateResponseBody.parse(await res.json());

      console.log(
        `The state of the "${program}" program:\n${JSON.stringify(
          body,
          null,
          2
        )}`
      );
    } catch (err) {
      console.error(err);
    }
  });

cli
  .command("dashboard start <program>")
  .describe(
    "Start a program that was never autostarted or that was exit or stopped."
  )
  .action(async (program) => {
    try {
      const res = await fetch(
        `http://localhost:3000/program/${program}/start`,
        { method: "POST" }
      );
      if (res.status === 404) {
        console.error(`The program "${program}" does not exist.`);

        return;
      }

      if (res.status !== 200) {
        throw new Error("Unknown error");
      }

      console.log(`The program "${program}" was started.`);
    } catch (err) {
      console.error(err);
    }
  });

async function launchServer() {
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

  httpServer.setValidatorCompiler(validatorCompiler);
  httpServer.setSerializerCompiler(serializerCompiler);

  httpServer
    .withTypeProvider<ZodTypeProvider>()
    .get(
      "/program/:id",
      {
        schema: {
          params: z.object({
            id: z.string(),
          }),
          response: {
            404: z.string(),
            200: GetProgramStateResponseBody,
          },
        },
      },
      (req, reply) => {
        const rootManagerSnapshot = rootManager.getSnapshot();

        const programActor =
          rootManagerSnapshot.context.programActors[req.params.id];
        if (programActor === undefined) {
          reply.code(404).send("Unknown program");

          return;
        }

        const programActorSnapshot = programActor.getSnapshot();

        return {
          processes: programActorSnapshot.context.processActors.map(
            (processActor) => {
              const processActorSnapshot = processActor.getSnapshot();

              return {
                status: processActorSnapshot.value,
              };
            }
          ),
        };
      }
    )
    .post(
      "/program/:id/start",
      {
        schema: {
          params: z.object({
            id: z.string(),
          }),
          response: {
            404: z.string(),
            200: z.literal("ok"),
          },
        },
      },
      (req, reply) => {
        const rootManagerSnapshot = rootManager.getSnapshot();

        const programActor =
          rootManagerSnapshot.context.programActors[req.params.id];
        if (programActor === undefined) {
          reply.code(404).send("Unknown program");

          return;
        }

        programActor.send({ type: "Start" });

        return "ok";
      }
    );

  await httpServer.listen({ port: 3000 });
}

cli.parse(process.argv);
