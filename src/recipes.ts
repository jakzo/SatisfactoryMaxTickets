import { Vars } from "javascript-lp-solver";

import data from "./data.json";
import {
  BUILDINGS,
  Data,
  ItemKey,
  LP_MODEL,
  POWER,
  PRODUCTION_BUILDINGS,
  SINK_POINTS,
  powerConsumptionOf,
  withClockSpeeds,
} from "./utils";

export const recipes: LP_MODEL = (config) => {
  const variables: Vars<string, string> = {};
  for (const [key, recipe] of Object.entries(data.recipes)) {
    if (!recipe.producedIn.some((x) => x in PRODUCTION_BUILDINGS)) continue;
    for (const manufacturer of recipe.producedIn) {
      const building = PRODUCTION_BUILDINGS[manufacturer];
      if (!building) continue;

      withClockSpeeds(config.clockSpeeds.production, (clockSpeed) => {
        const params: Record<string, number> = {
          [POWER]: -powerConsumptionOf(building, clockSpeed),
          [SINK_POINTS]: 0,
          [BUILDINGS]: 1,
        };
        for (const ingredient of recipe.ingredients) {
          const amount = ingredient.amount * (60 / recipe.time) * clockSpeed;
          params[ingredient.item] = (params[ingredient.item] ?? 0) - amount;
          const item = data.items[ingredient.item as ItemKey];
          params[SINK_POINTS] -=
            (item?.liquid ? 0 : item?.sinkPoints ?? 0) * amount;
        }
        for (const product of recipe.products) {
          const amount = product.amount * (60 / recipe.time) * clockSpeed;
          params[product.item] = (params[product.item] ?? 0) + amount;
          const item = data.items[product.item as ItemKey];
          params[SINK_POINTS] +=
            (item?.liquid ? 0 : item?.sinkPoints ?? 0) * amount;
        }
        variables[`${key}__${manufacturer}__${Math.round(clockSpeed * 100)}x`] =
          params;
      });
    }
  }
  return { constraints: {}, variables };
};

export const getMachineStats = (
  result: Record<string, number>,
  variables: Vars<string, string>
): { machines: Record<string, number>; totalBuildings: number } =>
  Object.entries(result).reduce<{
    machines: Record<string, number>;
    totalBuildings: number;
  }>(
    (res, [key, value]) => {
      res.totalBuildings += Math.ceil((variables[key][BUILDINGS] ?? 0) * value);

      const [k0, k1] = key.split("__");
      if (k0 in data.recipes) {
        const name = data.buildings[k1 as keyof Data["buildings"]].name;
        res.machines[name] = (res.machines[name] ?? 0) + value;
      }
      return res;
    },
    { machines: {}, totalBuildings: 0 }
  );
