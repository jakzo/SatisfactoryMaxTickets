import fs from "fs/promises";
import path from "path";

import { Model, Solution } from "javascript-lp-solver";

import { POWER, SINK_POINTS } from "./utils";

export const REPORTS_DIR = path.join(__dirname, "..", "reports");

export const generateReports = async (
  model: Model<string, string, string>,
  solution: Solution<string, string, string>
): Promise<void> => {
  try {
    await fs.mkdir(REPORTS_DIR);
  } catch (err) {
    if ((err as { code?: string }).code !== "EEXIST") throw err;
  }

  await fs.writeFile(
    path.join(REPORTS_DIR, "model-constraints.csv"),
    `Constraint,Type,Value\n${Object.entries(model.constraints)
      .map(([key, value]) => `${key},${Object.entries(value!)}`)
      .join("\n")}`
  );

  await fs.writeFile(
    path.join(REPORTS_DIR, "model-variables.csv"),
    `Variable,Sink Points,${Object.keys(model.constraints)}\n${Object.entries(
      model.variables
    )
      .map(
        ([key, value]) =>
          `${key},${value[SINK_POINTS] ?? 0},${Object.keys(
            model.constraints
          ).map((constraint) => value[constraint] ?? 0)}`
      )
      .join("\n")}`
  );

  await fs.writeFile(
    path.join(REPORTS_DIR, "result.csv"),
    `Variable,Value\n${Object.entries(solution.solutionSet).join("\n")}`
  );

  await fs.writeFile(
    path.join(REPORTS_DIR, "power-and-points.csv"),
    `Variable,Value,Power Consumption,Sink Points\n${Object.entries(
      solution.solutionSet
    )
      .filter(([, value]) => value !== 0)
      .map(
        ([key, value]) =>
          `${key},${value},${value * -(model.variables[key][POWER] ?? 0)},${
            value * -(model.variables[key][SINK_POINTS] ?? 0)
          }`
      )
      .join("\n")}`
  );

  console.log("Reports generated!");
};
