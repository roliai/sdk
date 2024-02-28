import {requiresTruthy} from "../util/requires";
import fs from "fs";
import path from "path";
import {tryFindAndOpen, validateConfigVersion, writeToFile} from "../util/config-file";
import {logLocalError} from "../util/logging";
import {serviceNameValidator} from "../util/validators";
import {decodeBase64, encodeBase64} from "../util/base64";
import {parseJsonFromFile} from "../util/json-parse";
import {CompilerOptions} from "../util/compiler";

export const SERVICE_CONFIG_FILE_NAME = "service.json";
const SERVICE_CONFIG_VERSION = 1;

export class ServiceClassMapping {
    constructor(public className: string, public classId: number) {
    }
}

export class ServiceSrcClassTagMapping {
    constructor(public name: string, public tag: string) {
    }
}

export class IdentityClassMapping {
    constructor(public className: string, public classId: number, public tag: string) {
    }
}

export class ServiceIdentity {
    constructor(public checksum?: number,
                public serviceId?: string,
                public serviceVersion?: string,
                public identityClassMappings?: IdentityClassMapping[],
                public lastClassId?: number) {
        if(checksum || serviceId || serviceVersion) {
            requiresTruthy('checksum', checksum);
            requiresTruthy('serviceId', serviceId);
            requiresTruthy('serviceVersion', serviceVersion);
            requiresTruthy('identityClassMappings', identityClassMappings);
            requiresTruthy('lastClassId', lastClassId);
        }
    }
}

function getConfigFile(dir: string) : string {
    return path.resolve(dir, SERVICE_CONFIG_FILE_NAME);
}

export class ServiceConfig {
    private readonly configVersion: number;
    constructor(public loadedFromDir: string,
                public name: string,
                public classes: ServiceSrcClassTagMapping[],
                public identity: ServiceIdentity,
                public compilerOptions: CompilerOptions | null) {
        requiresTruthy('loadedFromDir', loadedFromDir);
        requiresTruthy('name', name);
        requiresTruthy('identity', identity);
        this.configVersion = SERVICE_CONFIG_VERSION;
    }

    public get fullFileName() {
        return path.join(this.loadedFromDir, SERVICE_CONFIG_FILE_NAME);
    }

    public writeToDir(dir: string) : string {
        if (!fs.existsSync(dir))
            throw new Error(`${dir} does not exist`);
        let file = getConfigFile(dir);

        let obj = {
            identity: encodeBase64(JSON.stringify(this.identity)),
            name: this.name,
            configVersion: this.configVersion,
            classes: this.classes,
            // I want to take a snapshot of the current default compiler options when the
            // service is first initialized and use those settings throughout their service development.
            // Basically, I only want to apply the defaults the very first time this file is written.
            compilerOptions: this.compilerOptions ??
                new CompilerOptions(),
        }

        writeToFile(obj, file);

        return file;
    }

    public static fileExists(dir: string) {
        return fs.existsSync(getConfigFile(dir));
    }

    public static delete(dir: string) {
        fs.unlinkSync(getConfigFile(dir));
    }

    public static tryGetServiceName(dir: string) : string | null {
        let fileObj = tryOpenServiceConfigFile(getConfigFile(dir));
        return fileObj?.name || null;
    }

    public static tryOpen(dir: string): ServiceConfig | null {
        const configFile = getConfigFile(dir)

        let fileObj = tryOpenServiceConfigFile(configFile);
        if(!fileObj)
            return null; //already logged

        if(!validateConfigVersion(fileObj, configFile, SERVICE_CONFIG_VERSION))
            return null; //already logged

        if (!fileObj.hasOwnProperty("name") ||
            !fileObj.hasOwnProperty("identity") ||
            !fileObj.hasOwnProperty('classes')) {
            logLocalError(`Invalid or corrupt ${configFile}`);
            return null;
        }

        if (!fileObj.name || !serviceNameValidator(fileObj.name)) {
            logLocalError(`Invalid service name in ${configFile}`);
            return null;
        }

        if(!fileObj.identity) {
            logLocalError(`Invalid service identity in ${configFile}`);
            return null;
        }

        if(!fileObj.classes) {
            logLocalError(`Invalid service class mappings in ${configFile}`);
            return null;
        }

        return new ServiceConfig(dir,
            fileObj.name,
            fileObj.classes,
            JSON.parse(decodeBase64(fileObj.identity)),
            fileObj.compilerOptions);
    }

    public static tryFindAndOpen(startDir: string): ServiceConfig | null {
        return tryFindAndOpen(startDir, SERVICE_CONFIG_FILE_NAME, this.tryOpen);
    }
}

function tryOpenServiceConfigFile(file: string) : any {
    if (!fs.existsSync(file)) {
        logLocalError(`${file} does not exist`);
        return;
    }
    return parseJsonFromFile(file);
}