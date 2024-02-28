import chalk from "chalk";
import {GlobalOptions} from "./global-options";
import {DISCORD_INVITE} from "../config";

export class ErrorAlreadyLogged extends Error {
    public readonly logged: true;

    constructor() {
        super();
        this.logged = true;
    }
}

export function logIfNotAlready(e: any) {
    if (!(e instanceof ErrorAlreadyLogged)) {
        if(e.message) {
            logLocalError(e.message);
        } else {
            logLocalError(`UNKNOWN EXCEPTION: ${JSON.stringify(e)}`);
        }
    }
}

export function bold(str: string) {
    return getColor(chalk.bold, str);
}

export function getColor(colorFunc:(...text: unknown[]) => string, str: string) {
    return GlobalOptions.color ? colorFunc(str) : str;
}

export function logDetails(msg: string, force: boolean = false) {
    if (force || !GlobalOptions.quiet)
        console.log(getColor(chalk.gray, msg));
}

export function logLocalError(msg: string) {
    msg = msg.replace("Error:", "").trim();
    console.log(getColor(chalk.redBright, "Error: ") + msg);
    return msg;
}

export function logRemoteError(logContext: string, msg: string) {
    msg = msg.replace("Error:", "").trim();
    console.log(getColor(chalk.redBright, "Roli Error: ") + msg);
    console.error(getColor(chalk.gray, `Support Discord: ${DISCORD_INVITE}\nWhen reporting this error to the #community-support channel, give them this request id: `) + getColor(chalk.redBright, logContext));
    return msg;
}

export function logWarning(msg: string) {
    msg = msg.replace("Error:", "").trim();
    console.log(getColor(chalk.yellowBright, "Warning: ") + msg);
    return msg;
}

export function logNotice(msg: string) {
    console.log(getColor(chalk.yellow, "Notice: ") + msg);
    return msg;
}

export function logVerbose(msg: string) {
    if (!GlobalOptions.quiet && GlobalOptions.verbose)
        console.log(getColor(chalk.gray, "(verbose) " + msg));
    return msg;
}

export function logOk(msg: string) {
    if (!GlobalOptions.quiet)
        console.log(getColor(chalk.green, "OK: ") + msg);
    return msg;
}

export function logSuccess(msg: string) {
    if (!GlobalOptions.quiet)
        console.log(getColor(chalk.greenBright, "Success: ") + msg);
    return msg;
}