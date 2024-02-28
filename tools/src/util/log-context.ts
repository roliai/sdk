const crypto = require("crypto");

const ROLI_LOG_CONTEXT_LENGTH = 10;

export function createLogContext() {
    return crypto.randomBytes(ROLI_LOG_CONTEXT_LENGTH / 2).toString('hex');
}