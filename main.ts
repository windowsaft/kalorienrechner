import {
  Application,
  Context,
  Status,
  Router,
} from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts"

import { deleteIngridientById, getAllIngridients, getIngridientById, upsertIngridient } from "./util/db.ts";
import { createIngridientFromBody, FormatError } from "./util/util.ts";
import { logger } from "./util/logger.ts";

// env vars
import "jsr:@std/dotenv/load";

const IS_DEV = Deno.env.get("IS_DEV") == 'true';
const CORS_ORIGIN = Deno.env.get("CORS_ORIGIN");
const PORT = Deno.env.get("PORT") || "8000";

logger.info("Starting server...", { IS_DEV, CORS_ORIGIN, PORT });

const router = new Router();

router
  // Get all ingridients or a filtered subset
  .get("/api/ingridients", async (ctx) => {
    // Format query params
    const paramsMap: { [key: string]: string | number} = {};
    ctx.request.url.searchParams.forEach(
      (value : string | number, key: string) => paramsMap[key] = value
    );

    logger.debug("Received GET /api/ingridients request");
  
    // Get ingridients
    let ingridients;
    try {
      ingridients = await getAllIngridients();
      logger.info("Fetched all ingridientss from DB", { count: ingridients.length });
    } catch (error) {
      logger.error("Failed to fetch ingridientss", error);
      ctx.response.status = 500;
      ctx.response.body = { message: "Internal Server Error" };
      return;
    }
    
    let filteredIngridients = ingridients;
    
    // If 'search' param
    if ('search' in paramsMap && paramsMap.search != "") {
      const searchValue = paramsMap.search.toString().trim().toLowerCase();
      logger.debug("Filtering with search", searchValue);
      filteredIngridients = ingridients.filter(ingridient => {
        return ingridient.name.toLowerCase().includes(searchValue);
      });
    }

    // Sorting
    if ('sort' in paramsMap && paramsMap.sort != "") {
      const sortValue = paramsMap.search.toString().trim();
      if (
        sortValue == "calories" ||
        sortValue == "carbs" ||
        sortValue == "fat" ||
        sortValue == "protein"
      ) {
        logger.debug("Sorting with sortValue", sortValue);
        filteredIngridients = filteredIngridients.sort(
          (a, b) => a[sortValue] - b[sortValue]
        );
      }
    } else {
      // default - sort alphabetically in ascending order
      filteredIngridients = filteredIngridients.sort(
        (a, b) => a.name.localeCompare(b.name)
      );
    }

    if (paramsMap.order?.toString().trim() == "desc") {
      filteredIngridients = filteredIngridients.reverse();
    }


    ctx.response.body = filteredIngridients;
    ctx.response.status = Status.OK;
    logger.info("GET /api/ingridients successful", { count: filteredIngridients.length });
  })
  
  // Get an ingridients by its id
  .get("/api/ingridients/:id", async (ctx) => {
    const id = ctx.params.id;
    logger.debug(`Received GET /api/ingridients/${id}`);

    if (id.length !== 36) {
      logger.warn("ID did not match expected pattern!", id);
      ctx.response.body = { "message" : "ID did not match expected pattern!"};
      ctx.response.status = 400;
    }

    try {
      const ingridient = await getIngridientById(id);
      ctx.response.body = ingridient;
      ctx.response.status = 200;
      logger.info("Fetched ingredient by ID", { id, ingridient });
    } catch (error) {
      logger.error("Failed to fetch ingredient by ID", { id, error });
      ctx.response.body = { message: "Failed to fetch ingredient" };
      ctx.response.status = 500;
    }
  })

  // Serve homepage
  .get('/', async (ctx) => {
    logger.debug("Received GET / for index.html");
    try {
      const text = await Deno.readTextFile('./ui/index.html');
      ctx.response.headers.set("Content-Type", "text/html")
      ctx.response.body = text;
      logger.info("Served index.html");
    } catch (error) {
      logger.error("Error serving index.html", error);
      ctx.response.status = 500;
      ctx.response.body = "Internal Server Error";
    } 
  })

  // To verify if the api is alive
  .get("/api/health", (ctx) => {
    logger.debug("Received GET /api/health");

    // Return a simple JSON response
    ctx.response.body = { status: "ok", time: new Date().toISOString() };
    ctx.response.status = 200;
    logger.info("Health check OK");
  })

  // Serve the api docs page
  .get('/api/docs', async (ctx) => {
    logger.debug("Received GET /api/docs");

    try {
      const text = await Deno.readTextFile("./ui/docs.html");
      ctx.response.headers.set("Content-Type", "text/html");
      ctx.response.body = text;
      logger.info("Served docs.html");
    } catch (error) {
      logger.error("Error serving docs.html", error);
      ctx.response.status = 500;
      ctx.response.body = "Internal Server Error";
    }
  })

  // Add a new ingridients
  .post("/api/ingridients", async (ctx: Context) => {
    logger.debug("Received POST /api/ingridients");
    const body = ctx.request.body;

    // Just checking if body is empty
    // For my experience .body.has / .hasBody have been unreliable
    if (await body.text() == "") {
      logger.warn("Request body was empty for POST /api/ingridients");
      ctx.response.status = 400;
      return;
    }

    // parse as JSON
    const bodyInJson = await body.json();
    logger.debug("Parsed request body", bodyInJson);

    try {
      const ingridient = createIngridientFromBody(bodyInJson);
      const ingridientId = await upsertIngridient(ingridient);
      
      ctx.response.body = {
        "id": ingridientId,
        "message": "Ingridients added successfully."
      };
      ctx.response.status = 201;
      logger.info("New ingredient added successfully", { id: ingridientId });
    }
    catch (error) {
      if (error instanceof FormatError) {
        logger.warn("FormatError encountered in POST /api/ingridients", error.message);
        ctx.response.body = {"message" : error.message};
        ctx.response.status = 400;
      } else {
        logger.error("Unknown error in POST /api/ingridients", error);
        ctx.response.status = 500;
        ctx.response.body = { message: "Internal Server Error" };
      }
    }
  })

  // Update an ingridients by its id
  .put("/api/ingridients/:id", async (ctx) => {
    const id = ctx.params.id;
    logger.debug(`Received PUT /api/ingridients/${id}`);

    if (id.length !== 36) {
      logger.warn("ID did not match expected pattern!", id);
      ctx.response.body = {"message" : "ID did not match expected pattern!"};
      ctx.response.status = 400;
      return;
    }

    const body = ctx.request.body;

    if ((await body.text()) == "") {
      logger.warn("Request body was empty for PUT /api/ingridients/:id", id);
      ctx.response.status = 400;
      return;
    }

    const bodyInJson = await body.json();
    bodyInJson.id = id

    logger.debug("Parsed request body for update", bodyInJson);

    try {
      const ingridient = createIngridientFromBody(bodyInJson);
      const ingridientId = await upsertIngridient(ingridient);
      
      ctx.response.body = {
        "id": ingridientId,
        "message": "ingridients was updated successfully."
      };
      ctx.response.status = 200;
      logger.info("Ingredient updated successfully", { id: ingridientId });
    }
    catch (error) {
      if (error instanceof FormatError) {
        logger.warn("FormatError encountered in PUT /api/ingridients/:id", error.message);
        ctx.response.body = { message: error.message };
        ctx.response.status = 400;
      } else {
        logger.error("Unknown error in PUT /api/ingridients/:id", error);
        ctx.response.status = 500;
        ctx.response.body = { message: "Internal Server Error" };
      }
    }
    
  })

  // Delete multiple ingridients 
  .delete("/api/ingridients", async (ctx) => {
    logger.debug("Received DELETE /api/ingridients (bulk)");
    const body = ctx.request.body;

    if ((await body.text()) == "") {
      logger.warn("Request body was empty for bulk DELETE /api/ingridients");
      ctx.response.body = {"message" : "No body was found!"};
      ctx.response.status = 400;
      return;
    }

    const bodyInJson = await body.json();
    logger.debug("Parsed request body for bulk delete", bodyInJson);

    if (!('ids' in bodyInJson)) {
      logger.warn("Missing 'ids' in request body for bulk DELETE /api/ingridients");
      ctx.response.body = {"message" : "'ids' are missing in the body!"};
      ctx.response.status = 400;
      return;
    }

    const ids : string[] = bodyInJson.ids;

    try {
      // make sure all ids match the format
      for (const id of ids) {
        if (id.length != 36)  {
          throw new Error("ID does not match expected format!");
        }
      }

      for (const id of ids) {
        await deleteIngridientById(id);
      }

      logger.info("Deleted multiple ingredients", { count: ids.length });
      ctx.response.body = {
        "message": `${ids.length} ingridients(s) deleted successfully.`
      }
      ctx.response.status = 200;
    }
    catch (error) {
      logger.error("Error in bulk delete", error);
      ctx.response.body = {"message" : "Error - ID does not match expected format!"};
      ctx.response.status = 400;
    }
  })

  // Delete an ingridients by its id
  .delete("/api/ingridients/:id", async (ctx) => {
    const id = ctx.params.id;
    logger.debug(`Received DELETE /api/ingridients/${id}`);

    if (id.length !== 36) {
      logger.warn("ID did not match expected pattern!", id);
      ctx.response.body = {"message" : "ID did not match expected pattern!"};
      ctx.response.status = 400;
    }

    try {
      await deleteIngridientById(id);
      ctx.response.body = { "message" : "Ingredient deleted successfully." };
      ctx.response.status = 200;
      logger.info("Ingredient deleted successfully", { id });
    } catch (error) {
      logger.error("Error deleting ingredient by ID", { id, error });
      ctx.response.status = 500;
      ctx.response.body = { message: "Internal Server Error" };
    }
  });

const app = new Application();

// Set the CORS settings depending on the environement
//  - in dev: allow all origins
//  - in prod: allow only the origin from the env file
if (IS_DEV) {
  logger.debug("Running in development mode - allowing all origins");
  app.use(oakCors());
}
else if (!CORS_ORIGIN != undefined && !IS_DEV) {
  logger.debug("Running in production mode - restricting origins");
  app.use(oakCors({ origin: CORS_ORIGIN }));
}
 
app.use(router.routes());
app.use(router.allowedMethods());

logger.info(`Server is listening on port ${PORT}`);
await app.listen({ port: Number(PORT) });