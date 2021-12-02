import chalk from "chalk";
import { Constraints, Model, Solution, Vars } from "javascript-lp-solver";

// See also https://www.reddit.com/r/satisfactory/comments/ph878m/i_have_calculated_theoretical_maximum_of_coupon/

// From https://github.com/greeny/SatisfactoryTools/blob/dev/data/data.json
// Scraped from game files, see its readme
import data from "./data.json";

export type Data = typeof data;
export type ItemKey = keyof Data["items"];
export type RecipeKey = keyof Data["recipes"];
export type GeneratorKey = keyof Data["generators"];

export type Purity = "impure" | "normal" | "pure";

export interface Config {
  clockSpeeds: {
    production: {
      min: number;
      step: number;
      max: number;
    };
    miner: {
      min: number;
      step: number;
      max: number;
    };
  };
}

export type LP_MODEL = (config: Config) => {
  constraints: Constraints<string>;
  variables: Vars<string, string>;
};

export const BELT_MK5_SPEED = 780;
export const PIPE_MK2_SPEED = 600;
export const EXTRACTOR_SPEED = 60;
export const GEOTHERMAL_POWER = 200;
export const MAX_OVERCLOCK = 2.5;

export const GEYSER_KEY = "Desc_Geyser_C";
export const GEOTHERMAL_GENERATOR_KEY = "Build_GeneratorGeoThermal_C";
export const PRESSURIZER_KEY = "Desc_FrackingSmasher_C";
export const WATER_PUMP_KEY = "Desc_WaterPump_C";
export const WATER_KEY = "Desc_Water_C";

export const POWER = "power";
export const SINK_POINTS = "sinkPoints";
export const BUILDINGS = "buildings";

export const PURITIES = ["impure", "normal", "pure"] as const;

export const PRODUCTION_BUILDINGS = Object.fromEntries(
  Object.entries(data.buildings).filter(([, building]) =>
    (building.categories as string[]).some(
      (category) =>
        category === "SC_Manufacturers_C" || category === "SC_Smelters_C"
    )
  )
);

export const getMinerBuilding = (
  minerKey: string
): Data["buildings"][keyof Data["buildings"]] =>
  data.buildings[
    minerKey.replace(/^Build_/, "Desc_") as keyof Data["buildings"]
  ];

export const minerSpeedOf = (
  miner: Data["miners"][keyof Data["miners"]]
): number =>
  (miner.itemsPerCycle /
    (miner.allowLiquids ? 1000 : 1) /
    miner.extractCycleTime) *
  60;

export const powerConsumptionOf = (
  building: Data["buildings"][keyof Data["buildings"]],
  clockSpeed = 1
): number => {
  if (building.className === "Desc_HadronCollider_C") return Infinity; // TODO
  const { powerConsumption = 0, powerConsumptionExponent = 1 } =
    building.metadata as Record<string, number>;
  return clockSpeed ** powerConsumptionExponent * powerConsumption;
};

export const purityModifier = (purity: Purity): number =>
  2 ** (PURITIES.indexOf(purity) - 1);

export const composeLpModel = (
  lpModelPartials: LP_MODEL[],
  config: Config
): Model<string, string, string> => {
  const model: Model<string, string, string> = {
    optimize: SINK_POINTS,
    opType: "max",
    constraints: {},
    variables: {},
  };
  for (const partial of lpModelPartials) {
    const res = partial(config);
    Object.assign(model.constraints, res.constraints);
    Object.assign(model.variables, res.variables);
    // console.log(partial.name, res);
  }
  return model;
};

export const withClockSpeeds = (
  opts: { max: number; step: number; min: number },
  callback: (clockSpeed: number) => boolean | void
): void => {
  let clockSpeed = opts.max;
  while (clockSpeed > opts.min) {
    if (callback(clockSpeed / 100)) return;
    clockSpeed -= opts.step;
  }
  callback(opts.min / 100);
};

export const printPlan = (result: Solution<string, string, string>): void => {
  const itemsMadeSoFar = new Set(
    Object.values(data.resources).map((resource) => resource.item as ItemKey)
  );
  const recipesToMake = new Set(
    Object.keys(result.solutionSet).filter(
      (key) => key.split("__")[0] in data.recipes && result.solutionSet[key] > 0
    )
  );
  while (recipesToMake.size > 0) {
    for (const key of recipesToMake) {
      const [recipeKey, manufacturerKey] = key.split("__") as [
        RecipeKey,
        string
      ];
      const recipe = data.recipes[recipeKey];
      const amount = result.solutionSet[key];
      if (
        recipe.ingredients.some(
          (ingredient) => !itemsMadeSoFar.has(ingredient.item as ItemKey)
        )
      )
        continue;
      const building = PRODUCTION_BUILDINGS[manufacturerKey];
      const recipesPerMinute = 60 / recipe.time;
      console.log(
        `${chalk.blueBright(recipe.name)} (${recipe.ingredients
          .map(
            (ingredient) =>
              `${chalk.cyan(ingredient.amount * amount)} x ${chalk.red(
                data.items[ingredient.item as ItemKey].name
              )}`
          )
          .join(", ")} -> ${
          result.solutionSet[key] /
          (("manufacturingSpeed" in building.metadata &&
            building.metadata.manufacturingSpeed) ||
            1) /
          recipesPerMinute
        } x ${building.name} -> ${recipe.products
          .map(
            (product) =>
              `${chalk.green(product.amount * amount)} x ${chalk.magenta(
                data.items[product.item as ItemKey].name
              )}`
          )
          .join(", ")})`
      );
      for (const product of recipe.products)
        itemsMadeSoFar.add(product.item as ItemKey);
      recipesToMake.delete(key);
    }
  }
};
