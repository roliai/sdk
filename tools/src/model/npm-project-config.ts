import {requiresTruthy} from "../util/requires";
import fs, { readdirSync } from "fs";
import path from "path";
import {logVerbose, logWarning} from "../util/logging";
import { tryFindAndOpen, tryOpenAndParse } from "../util/config-file";

export const NPM_PROJECT_CONFIG_FILE_NAME = "package.json";

function getConfigFile(dir: string) {
    return path.resolve(dir, NPM_PROJECT_CONFIG_FILE_NAME);
}

const getDirectories = (source: string) =>
  readdirSync(source, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

export class NpmProjectConfig {
    constructor(
        public loadedFromDir: string,
        public name: string | null,
        public dependencies: {} | null) {
        requiresTruthy('loadedFromDir', loadedFromDir);
    }

    public get hasReact() {
        return this.dependencies && Object.hasOwn(<{}>this.dependencies, "react");
    }

    public get configFile() {
        return getConfigFile(this.loadedFromDir);
    }

    public static fileExists(dir: string) {
        return fs.existsSync(getConfigFile(dir));
    }

    static tryOpen(dir: string) : NpmProjectConfig | null {
        const file = getConfigFile(dir);
        
        logVerbose(`Opening NPM project in ${file}`);
        let fileObj = tryOpenAndParse(file);
        if(!fileObj)
            return null; //already logged

        if(!fileObj.name) {
            logWarning(`${file} missing 'name'`);
        }

        return new NpmProjectConfig(dir, fileObj.name, fileObj.dependencies);
    }

    public static tryFindAndOpen(startDir: string): NpmProjectConfig | null {
        return tryFindAndOpen(startDir, NPM_PROJECT_CONFIG_FILE_NAME, this.tryOpen);
    }
}