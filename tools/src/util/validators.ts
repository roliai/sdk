import chalk from "chalk";
import {logDetails, logLocalError} from "./logging";

export const emailValidator = async (input: any) => {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(input).toLowerCase());
};

export const serviceNameValidator = (input: any) => {
    const re = /^[a-z][a-z0-9\-_]{2,49}$/;
    return re.test(String(input));
}

export const modelKeyValidator = (input: any) => {
    const re = /^[a-z][a-z0-9\-_]{2,49}$/;
    return re.test(String(input));
}

export const serviceNameRules = "\nThe name must consist of 3 to 50 characters and be entirely lowercase. It must begin with a letter. After the first letter, it must only contain letters, numbers, and the characters - (hyphen), and _ (underscore).\n" +
    `\n${chalk.green("Good:")}\tmy-cool-service\n\tjanes-grill\n` +
    `${chalk.yellowBright("Bad:")}\t1my-service (first letter)\n\tPlanning@Project (upper-case letters, @ symbol)\n\tet (too short)`;

export function serviceNameErrorMessage(name: string) : string {
    return `The service name "${name}" is invalid.`;
}

export function validateServiceNameOrError(serviceName: string | null) : boolean {
    if (!serviceNameValidator(serviceName)) {
        logLocalError(serviceNameErrorMessage(serviceName!));
        logDetails(serviceNameRules, true);
        return false;
    }
    return true;
}

export const modelKeyRules = "\nThe model key must consist of 3 to 50 characters and be entirely lowercase. It must begin with a letter. After the first letter, it must only contain letters, numbers, and the characters - (hyphen), and _ (underscore).\n" +
    `\n${chalk.green("Good:")}\tmy-model\n\tvalidator\n` +
    `${chalk.yellowBright("Bad:")}\t1my-model (first letter)\n\tHappy@Model (upper-case letters, @ symbol)\n\tmd (too short)`;

export function modelKeyErrorMessage(name: string) : string {
    return `The model key "${name}" is invalid.`;
}

export function validateModelKeyOrError(modelKey: string | null) : boolean {
    if (!modelKeyValidator(modelKey)) {
        logLocalError(modelKeyErrorMessage(modelKey!));
        logDetails(modelKeyRules, true);
        return false;
    }
    return true;
}

export const passwordValidator = (input: any) => {
    if (!input)
        return false;

    if (typeof input !== 'string')
        return false;

    return input.length >= 8;
};