import type { Ingridient } from "./db.ts";
import { logger } from "./logger.ts";

export class FormatError extends Error {
  constructor(
    property: string,
    options: { missingBody?: boolean; malformedProperty?: boolean; expectedType?: string }
  ) {
    const { missingBody, malformedProperty, expectedType } = options;

    let message = `FormatError - Issue with property '${property}'`;

    if (missingBody) {
      message = `FormatError - Body is missing property '${property}'!`;
    } else if (malformedProperty) {
      message = `FormatError - Property '${property}' is not of type '${expectedType}'!`;
    }

    // Call the parent constructor with the message
    super(message);

    // Set the name of the error
    this.name = "FormatError";

    // Maintain proper stack trace for where the error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FormatError);
    }
  }
}

interface IngredientBody {
  id?: string;
  name: string;
  calories: number;
  carbs: number;
  fat: number;
  protein: number;
}

export function createIngridientFromBody(body: IngredientBody) : Ingridient {
  logger.debug("Creating ingredient from body", body);

  if (!body.name) {
    logger.warn("Missing 'name' property in body");
    throw new FormatError("name", {missingBody: true});
  }
  else if (typeof(body?.name) != "string") {
    logger.warn("'name' property is malformed. Expected a string", { receivedType: typeof body.name });
    throw new FormatError("name", {malformedProperty: true, expectedType: "string"});
  }
  
  if (!body.calories && body.calories !== 0) {
    logger.warn("Missing 'calories' property in body");
    throw new FormatError("calories", {missingBody: true});
  }
  else if (typeof(body?.calories) != "number") {
    logger.warn("'calories' property is malformed. Expected a number", { receivedType: typeof body.calories });
    throw new FormatError("calories", {malformedProperty: true, expectedType: "number"});
  }

  if (!body.carbs && body.carbs !== 0) {
    logger.warn("Missing 'carbs' property in body");
    throw new FormatError("carbs", { missingBody: true });
  } else if (typeof body.carbs !== "number") {
    logger.warn("'carbs' property is malformed. Expected a number", { receivedType: typeof body.carbs });
    throw new FormatError("carbs", { malformedProperty: true, expectedType: "number" });
  }

  if (!body.fat && body.fat !== 0) {
    logger.warn("Missing 'fat' property in body");
    throw new FormatError("fat", { missingBody: true });
  } else if (typeof body.fat !== "number") {
    logger.warn("'fat' property is malformed. Expected a number", { receivedType: typeof body.fat });
    throw new FormatError("fat", { malformedProperty: true, expectedType: "number" });
  }

  if (!body.protein && body.protein !== 0) {
    logger.warn("Missing 'protein' property in body");
    throw new FormatError("protein", { missingBody: true });
  } else if (typeof body.protein !== "number") {
    logger.warn("'protein' property is malformed. Expected a number", { receivedType: typeof body.protein });
    throw new FormatError("protein", { malformedProperty: true, expectedType: "number" });
  }

  const newIngredient: Ingridient = {
    id: body.id,
    name: body.name,
    calories: body.calories,
    carbs: body.carbs,
    fat: body.fat,
    protein: body.protein,
  };

  logger.debug("Successfully created ingredient object", newIngredient);

  return newIngredient;
}