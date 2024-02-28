import {requiresTruthy} from "../util/requires";
import path from "path";
import fs, {PathLike} from "fs";
import {logLocalError, logVerbose} from "../util/logging";
import {homedir} from "os";
import {writeToFile} from "../util/config-file";

const LOGIN_FILE_MODE = 0o600; //like ~/.ssh/id_rsa (etc)

function getConfigDir() : string {
    const homeDir = homedir();
    return path.join(homeDir, '.config', 'roli');
}

function getLoginFilePath() : string {
    return path.join(getConfigDir(), 'login.json');
}

export class LoginFile {
    constructor(public token: string) {
        requiresTruthy('token', token);
    }
    public write() {
        let file = getLoginFilePath();
        let dir = path.dirname(file);
        if(!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        writeToFile(this, file, LOGIN_FILE_MODE);
        logVerbose(`Login written to ${file}`);
    }

    public static delete() {
        const p = getLoginFilePath();
        logVerbose(`Login file deleted from ${p}`)
        fs.unlinkSync(p);
    }

    public static exists() {
        return fs.existsSync(getLoginFilePath());
    }

    public static tryOpen() : LoginFile | null {
        return this.tryFromFile(getLoginFilePath());
    }

    public static tryFromFile(file: PathLike) : LoginFile | null {
        if (!fs.existsSync(file)) {
            logLocalError(`${file} does not exist`)
            return null;
        }

        let keyJson = fs.readFileSync(file, {encoding: 'utf8', flag: 'r'});
        if (!keyJson) {
            logLocalError("Invalid or corrupt login file");
            return null;
        }

        let keyObj = JSON.parse(keyJson);
        if (!keyObj || !keyObj.hasOwnProperty("token")) {
            logLocalError("Invalid or corrupt login file");
            return null;
        }

        if(!keyObj.token || keyObj.token.length <= 0) {
            logLocalError("Invalid token value in login file");
            return null;
        }

        return new LoginFile(keyObj.token);
    }
}