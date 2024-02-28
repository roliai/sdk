export class PlatformError extends Error {
    constructor(message: string, public code: string, public logContext: string) {
        super(message);
        this.code = code;
        this.logContext = logContext;
    }
}

export class ScriptError extends Error {
    constructor(message: string, public serviceStack: string) {
        super(message);
        this.serviceStack = serviceStack;
    }
}