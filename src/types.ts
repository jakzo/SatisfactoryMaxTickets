declare module "javascript-lp-solver" {
  export type OptimizationType = "min" | "max";
  export type ConstraintType = "min" | "max" | "equal";

  export interface Model<
    Variables extends string,
    Attributes extends string,
    Optimize extends Attributes
  > {
    optimize: Optimize;
    opType?: OptimizationType;
    variables: Vars<Variables, Attributes>;
    constraints: Constraints<Attributes>;
    ints?: Partial<Record<Variables, boolean>>;
  }
  export type Constraints<Attributes extends string> = Partial<
    Record<Attributes, Partial<Record<ConstraintType, number>>>
  >;
  export type Vars<
    Variables extends string,
    Attributes extends string
  > = Record<Variables, Partial<Record<Attributes, number>>>;

  export type Result<Variables extends string> = {
    feasible: boolean;
    result: number;
    bounded?: boolean;
    isIntegral?: boolean;
  } & Record<Variables, number>;

  export class Solution<
    Variables extends string,
    Attributes extends string,
    Optimize extends Attributes
  > {
    feasible: boolean;
    evaluation: number;
    bounded: boolean;
    solutionSet: Record<Variables, number>;
    _tableau: Tableau<Variables, Attributes, Optimize>;
  }

  export class Tableau<
    Variables extends string,
    Attributes extends string,
    Optimize extends Attributes
  > {
    feasible: boolean;
    evaluation: number;
    bounded: boolean;
    model: Model<Variables, Attributes, Optimize>;
    matrix: number[][];
    width: number;
    height: number;
    costRowIndex: number;
    rhsColumn: number;
    variablesPerIndex: SlackVariable[];
    unrestrictedVars: unknown;
    simplexIters: number;
    varIndexByRow: number[];
    varIndexByCol: number[];
    rowByVarIndex: number[];
    colByVarIndex: number[];
    precision: number;
    optionalObjectives: unknown[];
    objectivesByPriority: unknown;
    savedState: unknown;
    availableIndexes: unknown[];
    lastElementIndex: number;
    variables: Variable[];
    nVars: number;
    unboundedVarIndex: null | number;
    branchAndCutIterations: number;
    bestPossibleEval: number;
  }

  export class Variable {}
  export class SlackVariable {}

  export class Solver {
    Solve<
      Variables extends string,
      Attributes extends string,
      Optimize extends Attributes
    >(
      model: Model<Variables, Attributes, Optimize>,
      precision?: number,
      full?: false,
      validate?: boolean
    ): Result<Variables>;
    Solve<
      Variables extends string,
      Attributes extends string,
      Optimize extends Attributes
    >(
      model: Model<Variables, Attributes, Optimize>,
      precision?: number,
      full?: true,
      validate?: boolean
    ): Solution<Variables, Attributes, Optimize>;
  }

  const solver: Solver;
  export default solver;
}
