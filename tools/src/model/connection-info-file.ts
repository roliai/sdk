import {requiresTruthy} from "../util/requires";
import path from "path";
import fs, {PathLike} from "fs";
import {logLocalError, logVerbose} from "../util/logging";
import {homedir} from "os";
import { DEFAULT_ADMIN_SERVICE_BASE_URL, DEFAULT_API_SERVICE_BASE_URL } from "../config";
import { writeToFile } from "../util/config-file";
import { URL } from "url";

const ENDPOINTS_FILE_MODE = 0o600; //like ~/.ssh/id_rsa (etc)

function getConfigDir() : string {
    const homeDir = homedir();
    return path.join(homeDir, '.config', 'roli');
}

export function getConnectionInfoFilePath() : string {
    return path.join(getConfigDir(), 'connection-info.json');
}

export class ConnectionInfoFile {
    constructor(
        public isEnterprise: boolean,
        public apiBaseUrl: string,
        public adminBaseUrl: string
    ){
        requiresTruthy('apiBaseUrl', apiBaseUrl);
        requiresTruthy('adminBaseUrl', adminBaseUrl);
    }

    public write() {
        let file = getConnectionInfoFilePath();
        let dir = path.dirname(file);
        if(!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        writeToFile(this, file, ENDPOINTS_FILE_MODE);
        logVerbose(`Connection info written to ${file}`);
    }

    public static delete() {
        const p = getConnectionInfoFilePath();
        logVerbose(`Connection info deleted from ${p}`)
        fs.unlinkSync(p);
    }

    public static exists() {
        return fs.existsSync(getConnectionInfoFilePath());
    }

    public static tryOpen() : ConnectionInfoFile | null {
        return this.tryFromFile(getConnectionInfoFilePath());
    }

    public static tryFromFile(file: PathLike) : ConnectionInfoFile | null {
        if (!fs.existsSync(file)) {
            logLocalError(`${file} does not exist`)
            return null;
        }

        let connectionInfoJson = fs.readFileSync(file, {encoding: 'utf8', flag: 'r'});
        if (!connectionInfoJson) {
            logLocalError("Invalid or corrupt endpoints file");
            return null;
        }

        let connectionInfoObj = JSON.parse(connectionInfoJson);
        if (!connectionInfoObj ||
            !connectionInfoObj.hasOwnProperty("apiBaseUrl") ||
            !connectionInfoObj.hasOwnProperty("adminBaseUrl")) {
            logLocalError("Invalid or corrupt login file");
            return null;
        }

        if(!connectionInfoObj.apiBaseUrl || connectionInfoObj.apiBaseUrl.length <= 0) {
            logLocalError("Invalid apiBaseUrl value in connection info file");
            return null;
        }

        if(!connectionInfoObj.adminBaseUrl || connectionInfoObj.adminBaseUrl.length <= 0) {
            logLocalError("Invalid adminBaseUrl value in connection info file");
            return null;
        }

        return new ConnectionInfoFile(connectionInfoObj?.isEnterprise === true,
            connectionInfoObj.apiBaseUrl, connectionInfoObj.adminBaseUrl);
    }
}

export function getConnectionInfoFile() : ConnectionInfoFile {
    if(!ConnectionInfoFile.exists()) {
        new ConnectionInfoFile(false,
            DEFAULT_API_SERVICE_BASE_URL, 
            DEFAULT_ADMIN_SERVICE_BASE_URL
            ).write();
    }

    const connectionInfo = ConnectionInfoFile.tryOpen()
    if(!connectionInfo) {
        throw new Error('Unable to open endpoints file');
    }
    return connectionInfo;
}

function withPath(url: string, path: string): string {
    if (url && !url.endsWith('/'))
        url += '/';
    return url + path;
}

export function getIsEnterprise() : boolean {
    return getConnectionInfoFile()?.isEnterprise === true;
}

export function getApiUrl() {
    return getConnectionInfoFile().apiBaseUrl;
}

export function getAdminApiUrl() {
    return withPath(getConnectionInfoFile().adminBaseUrl, 'admin-api');
}

export function getLoginUrl() {
    return withPath(getConnectionInfoFile().adminBaseUrl, 'login');
}