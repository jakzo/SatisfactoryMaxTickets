import { Constraints, Vars } from "javascript-lp-solver";

import data from "./data.json";
import map from "./map.json";
import {
  BUILDINGS,
  Data,
  GEOTHERMAL_GENERATOR_KEY,
  GEOTHERMAL_POWER,
  GEYSER_KEY,
  GeneratorKey,
  LP_MODEL,
  MAX_OVERCLOCK,
  POWER,
  PURITIES,
  Purity,
  purityModifier,
} from "./utils";

const GEOTHERMAL_GENERATOR_CLOCK = 2.5;

const powerProductionOf = (
  generator: Data["generators"][GeneratorKey],
  clockSpeed = MAX_OVERCLOCK
): number =>
  generator.powerProduction * clockSpeed ** generator.powerProductionExponent;

/** Assumes power storage units accompany each generator. See wiki for optimal
 * amounts: https://satisfactory.fandom.com/wiki/Geothermal_Generator */
export const powerGenerators: LP_MODEL = () => {
  const constraints: Constraints<string> = {};
  const variables: Vars<string, string> = {};

  for (const [key, generator] of Object.entries(data.generators)) {
    for (const fuel of generator.fuel) {
      variables[`${key}__${fuel}`] = {
        [fuel]: -1,
        [POWER]: powerProductionOf(generator),
        [BUILDINGS]: 1,
      };
    }
  }

  const geysers: Record<Purity, number> = { impure: 0, normal: 0, pure: 0 };
  for (const resource of map.options.find(
    (opt) => opt.tabId === "resource_wells"
  )!.options) {
    if (!("type" in resource) || !resource.type) continue;
    if (resource.type === GEYSER_KEY) {
      for (const node of resource.options) {
        if (!("purity" in node)) continue;
        if (resource.type === GEYSER_KEY)
          geysers[node.purity as Purity] += node.markers.length;
      }
      continue;
    }
  }
  for (const purity of PURITIES) {
    const geyserKey = `${GEYSER_KEY}__${purity}`;
    constraints[geyserKey] = { min: -geysers[purity] };
    variables[`${GEOTHERMAL_GENERATOR_KEY}__${purity}`] = {
      [geyserKey]: -1,
      [POWER]:
        GEOTHERMAL_POWER *
        purityModifier(purity) *
        GEOTHERMAL_GENERATOR_CLOCK **
          data.generators[GEOTHERMAL_GENERATOR_KEY].powerProductionExponent,
      [BUILDINGS]: 1,
    };
  }

  return { constraints, variables };
};

export const getPowerStats = (
  result: Record<string, number>,
  variables: Record<string, Record<string, number>>
): {
  powerProduced: number;
  powerConsumed: number;
  generators: Record<string, number>;
} =>
  Object.entries(result).reduce<{
    powerProduced: number;
    powerConsumed: number;
    generators: Record<string, number>;
  }>(
    (res, [key, value]) => {
      if (key in variables && variables[key][POWER]) {
        if (variables[key][POWER] > 0)
          res.powerProduced += variables[key][POWER] * value;
        else res.powerConsumed -= variables[key][POWER] * value;
      }

      const k = key.split("__");
      if (k[0] in data.generators) res.generators[key] = value;

      return res;
    },
    { powerProduced: 0, powerConsumed: 0, generators: {} }
  );
