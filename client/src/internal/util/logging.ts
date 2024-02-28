const SYSTEM_LOG_CONTEXT = "system"

const LOG_CONTEXT_LENGTH = 10;

export function createLogContext() {
    const randomChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < LOG_CONTEXT_LENGTH; i++) {
        result += randomChars.charAt(Math.floor(Math.random() * randomChars.length));
    }
    return result;
}

let _logHeader: string | null = null;
let _enableVerboseLogging: boolean = false;

export function setLogHeader(logHeader: string) {
    _logHeader = logHeader;
}

export function setEnableVerboseLogging(value: boolean) {
    _enableVerboseLogging = value;
}

export function getEnableVerboseLogging() {
    return _enableVerboseLogging;
}

export function getLogHeader() {
    return _logHeader;
}

export function logError(logContext: string, msg: string): string {
    console.error(`${getLogHeader()}[${logContext}] ${msg}`);
    return msg;
}

export function logWarn(logContext: string, msg: string): string {
    console.warn(`${getLogHeader()}[${logContext}] ${msg}`);
    return msg;
}

export function logInfo(logContext: string, msg: string): string {
    console.info(`${getLogHeader()}[${logContext}] ${msg}`);
    return msg;
}

export function logDebug(logContext: string, msg: string): string {
    console.log(`${getLogHeader()}[${logContext}] ${msg}`);
    return msg;
}

export function logVerbose(logContext: string, msg: string): string {
    if (getEnableVerboseLogging())
        console.info(`${getLogHeader()}[${logContext}] ${msg}`);
    return msg;
}

export function sysLogError(msg: string): string {
    return logError(SYSTEM_LOG_CONTEXT, msg);
}

export function sysLogWarn(msg: string): string {
    return logWarn(SYSTEM_LOG_CONTEXT, msg);
}

export function sysLogInfo(msg: string): string {
    return logInfo(SYSTEM_LOG_CONTEXT, msg);
}

export function sysLogVerbose(msg: string): string {
    return logVerbose(SYSTEM_LOG_CONTEXT, msg);
}