import { Constraints, Vars } from "javascript-lp-solver";

import data from "./data.json";
import map from "./map.json";
import {
  BUILDINGS,
  EXTRACTOR_SPEED,
  GEYSER_KEY,
  LP_MODEL,
  MAX_OVERCLOCK,
  PIPE_MK2_SPEED,
  POWER,
  PRESSURIZER_KEY,
  Purity,
  powerConsumptionOf,
  purityModifier,
} from "./utils";

export const resourceWells: LP_MODEL = () => {
  const constraints: Constraints<string> = {};
  const variables: Vars<string, string> = {};
  const wells: Record<string, Record<string, Record<Purity, number>>> = {};
  for (const resource of map.options.find(
    (opt) => opt.tabId === "resource_wells"
  )!.options) {
    if (!("type" in resource) || !resource.type || resource.type === GEYSER_KEY)
      continue;

    if (!wells[resource.type]) wells[resource.type] = {};

    for (const node of resource.options) {
      if (!("purity" in node)) continue;

      for (const marker of node.markers) {
        if (!("core" in marker)) continue;

        if (!wells[resource.type][marker.core])
          wells[resource.type][marker.core] = { impure: 0, normal: 0, pure: 0 };
        wells[resource.type][marker.core][node.purity as Purity]++;
      }
    }
  }

  for (const [type, cores] of Object.entries(wells)) {
    for (const amounts of Object.values(cores)) {
      const amount = Object.entries(amounts).reduce(
        (amount, [purity, count]) =>
          amount +
          Math.min(
            EXTRACTOR_SPEED * purityModifier(purity as Purity),
            PIPE_MK2_SPEED
          ) *
            count,
        0
      );
      const amountsKey = Object.entries(amounts)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${k} x ${v}`)
        .join(" + ");
      const coreKey = `${type}__${amountsKey}`;
      constraints[coreKey] = { min: -1 };
      variables[`${coreKey}__${PRESSURIZER_KEY}__${MAX_OVERCLOCK * 100}x`] = {
        [coreKey]: -1,
        [POWER]: -powerConsumptionOf(
          data.buildings[PRESSURIZER_KEY],
          MAX_OVERCLOCK
        ),
        [type]: amount * MAX_OVERCLOCK,
        [BUILDINGS]: Object.values(amounts).reduce(
          (count, num) => count + num,
          1
        ),
      };
    }
  }
  return { constraints, variables };
};
