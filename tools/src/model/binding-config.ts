import {requiresTruthy} from "../util/requires";
import fs from "fs";
import path from "path";
import {logLocalError, logVerbose} from "../util/logging";
import {parseJsonFromFile} from "../util/json-parse";
import { Unsigned, UnsignedOne } from "../util/unsigned";
import { serviceNameValidator } from "../util/validators";
import { tryOpenAndParse, validateConfigVersion, writeToFile } from "../util/config-file";

export const BINDING_CONFIG_FILE_NAME = "binding.json";
export const CONFIG_VERSION = 1;
export const ROLI_BINDING_DIR = ".roli/bindings"

function getConfigFile(dir: string) {
    return path.resolve(dir, BINDING_CONFIG_FILE_NAME);
}

export class BindingConfig {
    private readonly configVersion: number;
    constructor(
        public loadedFromDir: string,
        public serviceName: string,
        public serviceVersion: Unsigned) {
        requiresTruthy('loadedFromDir', loadedFromDir);
        requiresTruthy('serviceName', serviceName);
        if(!serviceVersion || serviceVersion < UnsignedOne) {
            throw new Error('invalid service version. Must be greater than or equal to 1.');
        }
        this.configVersion = CONFIG_VERSION;
    }

    public write() {
        const file = getConfigFile(this.loadedFromDir);
        let dir = path.dirname(file);
        if(!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        const obj = {
            configVersion: this.configVersion,
            serviceName: this.serviceName,
            serviceVersion: this.serviceVersion.toString()
        }
        writeToFile(obj, file);
        logVerbose(`Binding written to ${file}`);
    }

    public get configFile() {
        return getConfigFile(this.loadedFromDir);
    }

    public static fileExists(dir: string) {
        return fs.existsSync(getConfigFile(dir));
    }

    public static tryOpen(dir: string): BindingConfig | null {
        const file = getConfigFile(dir);

        let fileObj = tryOpenAndParse(file);
        if(!fileObj)
            return null; //already logged

        if(!validateConfigVersion(fileObj, BINDING_CONFIG_FILE_NAME, CONFIG_VERSION))
            return null; //already logged

        if (!fileObj.hasOwnProperty("serviceName") || 
            !fileObj.hasOwnProperty("serviceVersion")) {
            logLocalError(`Invalid or corrupt ${file}`);
            return null;
        }

        if (!serviceNameValidator(fileObj.serviceName)) {
            logLocalError(`Invalid service name in ${file}`);
            return null;
        }

        const serviceVersion = Unsigned.tryParse(fileObj.serviceVersion);
        if(!serviceVersion || serviceVersion < UnsignedOne)  {
            logLocalError("Invalid service version. Must be greater than or equal to 1.");
            return null;
        }
        
        return new BindingConfig(dir, fileObj.serviceName, serviceVersion);
    }
}