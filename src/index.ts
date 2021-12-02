import fs from "fs/promises";
import path from "path";

import solver from "javascript-lp-solver";

import data from "./data.json";
import { getPowerStats, powerGenerators } from "./power-generators";
import { getMachineStats, recipes } from "./recipes";
import { REPORTS_DIR, generateReports } from "./reports";
import { getMinerStats, resourceNodes } from "./resource-nodes";
import { resourceWells } from "./resource-wells";
import {
  BUILDINGS,
  Config,
  ItemKey,
  LP_MODEL,
  POWER,
  WATER_KEY,
  WATER_PUMP_KEY,
  composeLpModel,
  powerConsumptionOf,
  printPlan,
} from "./utils";

const baseModel: LP_MODEL = () => ({
  constraints: {
    [POWER]: { min: 0 },
    ...Object.fromEntries(
      Object.keys(data.items).map((key) => [key, { min: 0 }])
    ),
  },
  variables: {},
});

const waterPumps: LP_MODEL = () => ({
  constraints: {},
  variables: {
    [WATER_PUMP_KEY]: {
      [POWER]: -powerConsumptionOf(data.buildings[WATER_PUMP_KEY]),
      [WATER_KEY]: 120,
      [BUILDINGS]: 1,
    },
  },
});

const solve = async (): Promise<void> => {
  const model = composeLpModel(
    [
      baseModel,
      waterPumps,
      resourceNodes,
      resourceWells,
      recipes,
      powerGenerators,
    ],
    {
      clockSpeeds: {
        production: {
          min: 100,
          step: 10,
          max: 100,
        },
        miner: {
          min: 250,
          step: 10,
          max: 250,
        },
      },
    }
  );
  const result = solver.Solve(model, undefined, true);

  printPlan(result);

  console.log("Result:", {
    totalSinkPoints: result.evaluation,
    ...getPowerStats(result.solutionSet, model.variables as any),
    ...getMachineStats(result.solutionSet, model.variables as any),
    miners: getMinerStats(result.solutionSet),
  });

  const sinkItems: Record<string, number> = {};
  for (const [key, value] of Object.entries(result.solutionSet)) {
    for (const [constraintKey, amount] of Object.entries(
      model.variables[key]
    )) {
      const item = data.items[constraintKey as ItemKey];
      if (!item) continue;
      sinkItems[item.name] = (sinkItems[item.name] ?? 0) + amount! * value;
    }
  }
  console.log(
    "Sunk items:",
    Object.fromEntries(
      Object.entries(sinkItems).filter(([, amount]) => amount > 1e-5)
    )
  );

  // console.log(
  //   Object.fromEntries(
  //     Object.entries(result.solutionSet)
  //       .filter(([, value]) => value !== 0)
  //       .map(([key, value]) => [
  //         key,
  //         Object.fromEntries(
  //           Object.entries(model.variables[key]).map(([k, v]) => [k, v! * value])
  //         ),
  //       ])
  //   )
  // );

  await generateReports(model, result);
};

const plotNumBuildings = async (): Promise<void> => {
  const config: Config = {
    clockSpeeds: {
      production: {
        min: 1,
        step: 10,
        max: 100,
      },
      miner: {
        min: 1,
        step: 10,
        max: 250,
      },
    },
  };
  const unrestrictedModel = composeLpModel(
    [
      baseModel,
      waterPumps,
      resourceNodes,
      resourceWells,
      recipes,
      powerGenerators,
    ],
    config
  );
  const unrestrictedResult = solver.Solve(unrestrictedModel, undefined, true);
  const maxBuildings = getMachineStats(
    unrestrictedResult.solutionSet,
    unrestrictedModel.variables
  ).totalBuildings;

  const data: [number, number][] = [];
  let n = 100;
  do {
    n = Math.min(Math.ceil(n ** 1.01), maxBuildings);
    const model = composeLpModel(
      [
        baseModel,
        waterPumps,
        resourceNodes,
        resourceWells,
        recipes,
        powerGenerators,
      ],
      config
    );
    model.constraints[BUILDINGS] = { max: n };
    const result = solver.Solve(model, undefined, true);
    data.push([n, result.evaluation]);
  } while (n < maxBuildings);

  await fs.writeFile(
    path.join(REPORTS_DIR, "plot-buildings.csv"),
    `Building Count,Points per Minute\n${data.join("\n")}`
  );

  console.log("Done!");
};

void solve();
void plotNumBuildings();
