import { z } from "zod";
import { readFile } from "node:fs/promises";
import * as Yaml from "yaml";

const secondsInOneHour = 3600;

const StopProcessSignal = z.enum([
  "TERM",
  "HUP",
  "INT",
  "QUIT",
  "KILL",
  "USR1",
  "USR2",
]);

export const ProgramConfiguration = z.object({
  cmd: z.string(),
  numprocs: z.number().int().min(1).max(100).optional().default(1),
  workingdir: z.string().optional(),
  autostart: z.boolean().optional().default(true),
  autorestart: z
    .literal("unexpected")
    .or(z.boolean())
    .optional()
    .default("unexpected"),
  exitcodes: z.array(z.number().int().min(0).max(255)).optional().default([0]),
  startretries: z.number().min(0).max(20).optional().default(5),
  /**
   * In seconds.
   */
  starttime: z
    .number()
    .int()
    .min(0)
    .max(secondsInOneHour)
    .optional()
    .default(3),
  stopsignal: StopProcessSignal.optional().default("QUIT"),
  /**
   * In seconds.
   */
  stoptime: z
    .number()
    .int()
    .min(0)
    .max(secondsInOneHour)
    .optional()
    .default(10),
  stdout: z
    .enum(["AUTO", "NONE"])
    .or(z.string().brand())
    .optional()
    .default("AUTO"),
  stderr: z
    .enum(["AUTO", "NONE"])
    .or(z.string().brand())
    .optional()
    .default("AUTO"),
  env: z
    .record(z.unknown().transform((v) => String(v)))
    .optional()
    .default(() => ({})),
});
export type ProgramConfiguration = z.infer<typeof ProgramConfiguration>;

export const Configuration = z.object({
  programs: z.record(ProgramConfiguration),
});
export type Configuration = z.infer<typeof Configuration>;

export async function readAndParseConfigurationFile(
  configurationPath: string
): Promise<Configuration> {
  const configurationContent = await readFile(configurationPath, "utf-8");

  const configurationAsObject = Yaml.parse(configurationContent);

  return Configuration.parse(configurationAsObject);
}
