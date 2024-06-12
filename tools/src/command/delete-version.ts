import chalk from "chalk";
import {Command} from "commander";
import {getColor, logOk, logRemoteError} from "../util/logging";
import {AdminSingleton} from "../service/admin";
import {createLogContext} from "../util/log-context";
import {authEnabled, loginWithStoredCredentials} from "../service/auth";
import {requiresTruthy} from "../util/requires";

export function createDeleteServiceVersionCommand(before: any): Command {
    return new Command('delete-version')
        .arguments('<serviceName>')
        .requiredOption('-v, --version <version>', "The version of the service you wish to delete.")
        .description('Delete the a service version from Roli. The data stays intact.')
        .action(async (serviceName: string, version: string) => {
            if (before)
                before();
            if (await executeDeleteServiceVersion(serviceName, version)) {
                process.exit(0);
            } else {
                process.exit(1);
            }
        });
}

export async function executeDeleteServiceVersion(serviceName: string, serviceVersion: string): Promise<boolean> {
    requiresTruthy('serviceName', serviceName);

    if(authEnabled() && !await loginWithStoredCredentials())
        return false; //already logged

    const logContext = createLogContext();
    try {
        await AdminSingleton.deleteServiceVersion(logContext, serviceName, serviceVersion);
        logOk(`${getColor(chalk.magentaBright, serviceName)} version ${getColor(chalk.greenBright, serviceVersion)} has been deleted.`);
        return true;
    } catch (e: any) {
        logRemoteError(logContext, e.message);
        return false;
    }
}