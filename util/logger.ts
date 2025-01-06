import { Logger } from "https://deno.land/x/logger@v1.1.8/mod.ts"

export const logger = new Logger();

// init logging to file
const LOGS_FOLDER = Deno.env.get("LOGS_FOLDER") || "./log";
await logger.initFileLogger(LOGS_FOLDER, {
    rotate: true
});