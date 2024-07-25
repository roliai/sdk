import chalk from "chalk";
import {Command} from "commander";
import {logOk, logRemoteError} from "../util/logging";
import {AdminSingleton} from "../service/admin";
import {createLogContext} from "../util/log-context";
import {executeLogin} from "./login";
import {authEnabled, loginWithStoredCredentials} from "../service/auth";
import {requiresTruthy} from "../util/requires";

export function createDeleteServiceCommand(before: any): Command {
    return new Command('delete-service')
        .arguments('<serviceName>')
        .description('Delete the service from Roli and all its data.')
        .requiredOption("--yes-im-sure-i-want-to-delete-this-service", "Required because this operation is destructive and cannot be undone (even by Roli support).")
        .action(async (serviceName: string) => {
            if (before)
                before();
            if (await executeServiceDelete(serviceName, true)) {
                process.exit(0);
            } else {
                process.exit(1);
            }
        });
}

export async function executeServiceDelete(serviceName: string, interactive: boolean): Promise<boolean> {
    requiresTruthy('serviceName', serviceName);

    if(authEnabled())
    {
        // Force an interactive login because this is destructive.
        if (interactive) {
            console.log("");
            console.log(chalk.redBright(`CAUTION: THIS WILL ${chalk.yellowBright("DELETE")} THE SERVICE "${chalk.yellowBright(serviceName)}" AND ALL ITS DATA.\n\nThis cannot be undone, even by Roli support.`));
            console.log("");
            console.log("Because this is a destructive operation, you must re-login.")
            if (!await executeLogin({kind: "interactive"}, false)) {
                return false;
            }
        } else {
            if (!await loginWithStoredCredentials()) {
                return false; //already logged
            }
        }
    }

    const logContext = createLogContext();
    try {
        await AdminSingleton.deleteService(logContext, serviceName);
        logOk(`The "${serviceName}" service has been deleted.`);
        return true;
    } catch (e: any) {
        logRemoteError(logContext, e.message);
        return false;
    }
}