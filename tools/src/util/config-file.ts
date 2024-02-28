import fs, {Mode} from "fs";
import { logLocalError } from "./logging";
import path from "node:path";
import { parseJsonFromFile } from "./json-parse";

export function tryOpenAndParse(file: string) : any {
    if (!fs.existsSync(file)) {
        logLocalError(`${file} does not exist`);
        return;
    }
    return parseJsonFromFile(file);
}

export function tryFindAndOpen<T>(dir: string, fileName: string, tryOpen: (dir: string) => T): T | null {
    const file = path.join(dir, fileName);
    if(fs.existsSync(file)) {
        return tryOpen(dir);
    } else {
        const d = path.dirname(dir);
        if(d !== dir) {
            return tryFindAndOpen(d, fileName, tryOpen);
        } else {
            return null; //at root
        }
    }
}

export function writeToFile(what: any, file: string, mode?: Mode) {
    let json = JSON.stringify(what, null, 4);
    if(!mode) {
        fs.writeFileSync(file, json, {
            encoding: "utf8",
            flag: "w"
        });
    } else {
        fs.writeFileSync(file, json, {
            encoding: "utf8",
            flag: "w",
            mode: mode
        });
    }
}

export function validateConfigVersion(fileObj: any, configFileName: string, currentVersion: number) : boolean {
    if (!fileObj) {
        logLocalError(`Invalid or corrupt ${configFileName}`);
        return false;
    }

    if(!fileObj.hasOwnProperty("configVersion") || !fileObj.configVersion) {
        logLocalError(`Invalid configVersion value in ${configFileName}`);
        return false;
    }

    if(fileObj.configVersion !== currentVersion) {
        logLocalError(`Incompatible project configVersion ${fileObj.version}.`);
        return false;
    }

    return true;
}