import { Constraints, Vars } from "javascript-lp-solver";

import data from "./data.json";
import map from "./map.json";
import {
  BELT_MK5_SPEED,
  BUILDINGS,
  Data,
  ItemKey,
  LP_MODEL,
  PIPE_MK2_SPEED,
  POWER,
  Purity,
  SINK_POINTS,
  getMinerBuilding,
  minerSpeedOf,
  powerConsumptionOf,
  purityModifier,
  withClockSpeeds,
} from "./utils";

/** Note: Miner output power consumption scales exponentially when overclocking
 * and it's possible that the optimal result has miners clocked at less than the
 * max of 250%. Because we can't solve for this exponential constraint using
 * linear optimization we assume that all miners and extractors will be clocked
 * at 250%. */
export const resourceNodes: LP_MODEL = (config) => {
  const constraints: Constraints<string> = {};
  const variables: Vars<string, string> = {};
  for (const resource of map.options.find(
    (opt) => opt.tabId === "resource_nodes"
  )!.options) {
    if (!("type" in resource) || !resource.type) continue;
    const miners = Object.values(data.miners)
      .filter((miner) => miner.allowedResources.includes(resource.type))
      .map((miner) => ({
        miner,
        building: getMinerBuilding(miner.className),
      }));
    if (miners.length === 0) continue;
    const item = data.items[resource.type as ItemKey];

    for (const node of resource.options) {
      if (!("purity" in node)) continue;

      const type = `${resource.type}__${node.purity}`;
      constraints[type] = {
        min: (constraints[type]?.min ?? 0) - node.markers.length,
      };

      for (const { miner, building } of miners) {
        const fullSpeed =
          minerSpeedOf(miner) * purityModifier(node.purity as Purity);
        withClockSpeeds(config.clockSpeeds.miner, (desiredClockSpeed) => {
          const desiredAmount = fullSpeed * desiredClockSpeed;
          const amount = Math.min(
            desiredAmount,
            Math.max(
              miner.allowLiquids ? PIPE_MK2_SPEED : 0,
              miner.allowSolids ? BELT_MK5_SPEED : 0
            )
          );
          const clockSpeed = amount / fullSpeed;
          variables[
            `${resource.type}__${node.purity}__${miner.className}__${Math.round(
              clockSpeed * 100
            )}x`
          ] = {
            [type]: -1,
            [POWER]: -powerConsumptionOf(building, clockSpeed),
            [SINK_POINTS]: item.liquid ? 0 : item.sinkPoints ?? 0,
            [resource.type]: amount,
            [BUILDINGS]: 1,
          };
          return amount < desiredAmount;
        });
      }
    }
  }
  return { constraints, variables };
};

export const getMinerStats = (
  result: Record<string, number>
): Record<string, number> =>
  Object.fromEntries(
    Object.entries(
      Object.entries(result).reduce<Record<string, number>>(
        (res, [key, value]) => {
          const [k0, purity, miner, clock] = key.split("__");
          if (k0 in data.resources && value > 0) {
            const desc = `${
              data.items[
                data.resources[k0 as keyof Data["resources"]].item as ItemKey
              ].name
            } (${purity}) - ${getMinerBuilding(miner).name} @ ${clock.replace(
              /x$/,
              "%"
            )}`;
            res[desc] = (res[desc] ?? 0) + value;
          }
          return res;
        },
        {}
      )
    ).sort()
  );
