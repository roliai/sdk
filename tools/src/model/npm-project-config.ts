import {requiresTruthy} from "../util/requires";
import fs, { readdirSync } from "fs";
import path from "path";
import {logLocalError, logVerbose, logWarning} from "../util/logging";
import {parseJsonFromFile} from "../util/json-parse";
import { tryFindAndOpen, tryOpenAndParse } from "../util/config-file";
import { BINDING_CONFIG_FILE_NAME, BindingConfig, ROLI_BINDING_DIR } from "./binding-config";

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

    public getAllBindingConfigs() : BindingConfig[] | null {
        let bindingConfigs: BindingConfig[] = [];
        
        const bindingRootDir = path.join(this.loadedFromDir, ROLI_BINDING_DIR);
        
        if(fs.existsSync(bindingRootDir)) {
            const dirs = getDirectories(bindingRootDir);
            for(const dir of dirs) {
                const bindingDir = path.join(bindingRootDir, dir);
                if(BindingConfig.fileExists(bindingDir)) {
                    const bindingConfig = BindingConfig.tryOpen(bindingDir);
                    if(bindingConfig) {
                        bindingConfigs.push(bindingConfig);
                    }
                }
            }
        }

        if(bindingConfigs.length > 0) {
            return bindingConfigs;
        } else {
            return null;
        }
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