import {logLocalError, logVerbose} from "./logging";
import fs from "fs";

export function parseJsonFromFile(file: string) : any {
    try {
        let json = fs.readFileSync(file, {encoding: "utf8", flag: 'r'});
        if (!json) {
            logLocalError(`Unable to read ${file}`);
            return null;
        }
        return JSON.parse(json);
    }
    catch (e) {
        logVerbose(`${e}`);
        logLocalError(`Invalid or corrupt ${file}`);
        return null;
    }
}