import {sysLogError} from "./logging.js";

export function requiresPositiveBigInt(name: string, value: bigint | undefined) {
    if(!value || value === BigInt(0)) {
        throw new Error(sysLogError(`${name} was <= 0 or empty`));
    }
}

export function requiresNumericPositive(name: string, value: any) {
    if(typeof value !== "number")
        throw new Error(sysLogError(`${name} wasn't a number`));
    if(value < 0)
        throw new Error(sysLogError(`${name} was < 0`));
}

export function requiresFalsy(name: string, value: any) {
    if(value) {
        throw new Error(sysLogError(`${name} was truthy when it needed to be falsy`));
    }
}

export function requiresTruthy(name: string, value: any) {
    if(!value) {
        throw new Error(sysLogError(`${name} was falsy when it needed to be truthy`));
    }
}

export function requiresAtLeastOneElement(name: string, value: any[]) {
    if(!value || value.length == 0) {
        throw new Error(sysLogError(`${name} array had no elements when it needed to have at least one`));
    }
}