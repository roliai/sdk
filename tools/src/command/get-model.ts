import {bold, getColor, logLocalError, logRemoteError} from "../util/logging";
import {Command} from "commander";
import {authEnabled, loginWithStoredCredentials} from "../service/auth";
import {createRoliClientAsAdmin, ModelRegistration, ModelRegistry} from "../service/model-registry";
import {tryGetAdminServiceAuthorization} from "../util/admin-service-authorization";
import {sysLogError} from "../client/internal/util/logging";
import {AsciiTable3} from "ascii-table3";
import chalk from "chalk";
import {validateModelKeyOrError, validateServiceNameOrError} from "../util/validators";
import {GlobalOptions} from "../util/global-options";

export function createGetModelCommand(before: any): Command {
    return new Command('get-model')
        .description("Get a model from a service's Model Registry.")
        .argument('<serviceName>', "The service whose model you wish to retrieve.")
        .requiredOption('-k, --key <key>', "The key of the model registered with the service's Model Registry you wish to retrieve.")
        .option('-j, --json', "Output the model in JSON format so you can easily pipe it to a file.")
        .action(async (serviceName: string, opts: any) => {
            if (before)
                before(!opts.json);

            if (opts.json) {
                GlobalOptions.quiet = true;
                GlobalOptions.showServiceWarning = false;
            }

            if (await executeGetModel(serviceName, opts.key, opts.json)) {
                process.exitCode = 0;
            } else {
                process.exitCode = 1;
            }
        });
}

export async function tryGetModelRegistration(serviceName: string, key: string): Promise<ModelRegistration | null> {
    const authorization = await tryGetAdminServiceAuthorization(serviceName);
    if (!authorization) {
        return null; // already logged
    }

    // Use the admin key to create a Roli Client
    const client = createRoliClientAsAdmin(authorization);

    try {
        const modelRegistry = client.getEndpoint(ModelRegistry, "default");

        const registrations = await modelRegistry.getRegistrations(key);

        if (!registrations || registrations.size < 1) {
            sysLogError("Model not found by key");
            return null;
        }

        if (registrations.size != 1) {
            sysLogError("Unexpectedly more than a single model registration was returned");
            return null;
        }

        return Array.from(registrations.values())[0];
    } catch (e) {
        // @ts-ignore
        logLocalError(e.message);
        return null;
    } finally {
        client.closeConnections();
    }
}

export async function executeGetModel(serviceName: string, key: string, json: boolean): Promise<boolean> {
    if (authEnabled() && !await loginWithStoredCredentials()) {
        return false; //already logged
    }

    if (!validateServiceNameOrError(serviceName))
        return false; // already logged

    if (!validateModelKeyOrError(key))
        return false; // already logged

    const registration = await tryGetModelRegistration(serviceName, key);
    if (!registration)
        return false; // already logged

    if (json) {
        console.log(JSON.stringify(registration.model, null, 4));
    } else {
        let table = new AsciiTable3(bold(getColor(chalk.cyanBright, registration.primaryKey)))
            .setHeading('Property', 'Value')
            .setAlignLeft(1);

        table.addRow(getColor(chalk.greenBright, "registered"), getColor(chalk.yellowBright, registration.registered.toLocaleString()));

        function formatValue(value: any): string {
            if(typeof value === "string" || typeof value === "number") {
                return value.toString();
            }
            return JSON.stringify(value);
        }

        let settingsFound;
        let headersFound;
        for (const name of Object.getOwnPropertyNames(registration.model)) {
            const prop = registration.model[name];
            if (name === "settings") {
                settingsFound = true;
            } else if (name === "headers") {
                headersFound = true;
            } else {
                table.addRow(getColor(chalk.greenBright, name), getColor(chalk.yellowBright, formatValue(prop)));
            }
        }

        // output the settings and headers last (because it looks better)

        if (settingsFound) {
            let first = false;
            for (const settingsName of Object.getOwnPropertyNames(registration.model.settings)) {
                if (!first) {
                    table.addRow(getColor(chalk.greenBright, `settings`), "");
                    first = true;
                }
                const settingsProp = registration.model.settings[settingsName];
                table.addRow(getColor(chalk.gray, ` ${settingsName}`), getColor(chalk.white, formatValue(settingsProp)));
            }
        }

        if(headersFound) {
            let first = false;
            for (const settingsName of Object.getOwnPropertyNames(registration.model.headers)) {
                if (!first) {
                    table.addRow(getColor(chalk.greenBright, `headers`), "");
                    first = true;
                }
                const settingsProp = registration.model.headers[settingsName];
                table.addRow(getColor(chalk.gray, ` ${settingsName}`), getColor(chalk.white, formatValue(settingsProp)));
            }
        }

        table.setStyle('compact');
        console.log(table.toString());
    }

    return true;
}