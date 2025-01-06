import "jsr:@std/dotenv/load";
import { logger } from "./logger.ts";

const DENO_KV_URL = Deno.env.get("DENO_KV_URL");
const DENO_KV_ACCESS_TOKEN = Deno.env.get("DENO_KV_ACCESS_TOKEN");

// If DENO_KV_URL is defined, we are using a remote KV store,
// so let's check for an access token
if (DENO_KV_URL) {
  logger.debug("Remote KV URL defined:", DENO_KV_URL);

  if (!DENO_KV_ACCESS_TOKEN) {
    logger.error("No ACCESS_TOKEN found in the environment, but DENO_KV_URL is set.");
    logger.error("FATAL: Missing ACCESS_TOKEN for remote Deno KV usage. Exiting...");
    Deno.exit(1);
  } else {
    logger.info("ACCESS_TOKEN found. Proceeding with remote KV usage.");
  }
} else {
  logger.debug("No remote KV URL; using local DenoKV instance.");
}

export interface Ingridient {
  id?: string;
  name: string;
  calories: number;
  carbs: number;
  fat: number;
  protein: number;
}

// Deno KV uses the URL given by the ENV Var,
// if the var is undefined, it will use a local instance
let kv : Deno.Kv;
try {
  logger.debug("Attempting to open Deno KV instance...");
  kv = await Deno.openKv(DENO_KV_URL);
  logger.info("Deno KV connection established successfully.");
} catch (error) {
  logger.error("FATAL: Failed to open Deno KV instance. Exiting...", error);
  Deno.exit(1);
}

export async function getAllIngridients() : Promise<Ingridient[]> {
  logger.debug("Retrieving all ingredients from KV store...");
  const ingridients: Ingridient[] = [];
  
  try {
    for await (const res of kv.list<Ingridient>({prefix: ["ingridients"]})) {
      ingridients.push(res.value);
    }
    logger.info("Fetched all ingredients from KV", { count: ingridients.length });
  } catch (error) {
    logger.error("Error listing all ingredients from KV", error);
    throw error;
  }
  
  return ingridients;
}

export async function getIngridientById(id: string): Promise<Ingridient> {
  logger.debug("Attempting to retrieve ingredient by ID", { id });
  const key = ["ingridients", id];

  try {
    const result = await kv.get<Ingridient>(key);
    if (!result.value) {
      logger.warn("No ingredient found for this ID", { id });
      return Promise.reject(new Error("Ingredient not found"));
    }
    logger.info("Ingredient retrieved successfully", result.value);
    return result.value;
  } catch (error) {
    logger.error("Error retrieving ingredient by ID", { id, error });
    throw error;
  }
}

export async function upsertIngridient(ingridient: Ingridient) : Promise<string> {
  logger.debug("Upserting ingredient", ingridient);

  if (!ingridient.id) {
    ingridient.id = crypto.randomUUID();
    logger.debug("Generated new UUID for ingredient", { id: ingridient.id });
  }

  // Set the id as primary key
  const key = ["ingridients", ingridient.id];

  try {
    const commitResult = await kv.set(key, ingridient);
    logger.debug("Primary key set in KV", { key, commitResult });

    // Set the ingredient name as a secondary key
    const secondaryKey = ["ingridientsByName", ingridient.name];
    await kv.set(secondaryKey, key);
    logger.debug("Secondary key set in KV", { secondaryKey, pointsTo: key });

    logger.info("Ingredient upserted successfully", { id: ingridient.id });
    return ingridient.id;
  } catch (error) {
    logger.error("Error upserting ingredient", { error, ingridient });
    throw error;
  }
}

export async function deleteIngridientById(id: string) {
  logger.debug("Attempting to delete ingredient by ID", { id });
  const key = ["ingridients", id];
  
  try {
    await kv.delete(key);
    logger.info("Ingredient deleted successfully", { id });
  } catch (error) {
    logger.error("Error deleting ingredient by ID", { id, error });
    throw error;
  }
}