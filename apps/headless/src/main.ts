// Entry point of the headless runner: see cli.ts for the commands.
import { main } from "./cli.ts";

process.exitCode = await main(process.argv.slice(2));
