import {logRemoteError, logOk} from "../util/logging";
import {AdminSingleton} from "../service/admin";
import {Command} from "commander";
import {createLogContext} from "../util/log-context";
import chalk from "chalk";
import {executeLogin} from "./login";
import {logout, loginWithStoredCredentials} from "../service/auth";

export function createDeleteAccountCommand(before: any) : Command {
    return new Command('delete-account')
        .description('Delete your Roli account including all its code, data, and backups.')
        .requiredOption("--yes-im-sure-i-want-to-delete-my-account", "Required because this operation is destructive and cannot be undone (even by Roli support).")
        .action(async () => {
            if (before)
                before();
            if (await executeAccountDelete(true)) {
                process.exit(0);
            } else {
                process.exit(1);
            }
        });
}


export async function executeAccountDelete(interactive: boolean): Promise<boolean> {   
    // Force an interactive login because this is destructive.
    if (interactive) {
        console.log("");
        console.log(chalk.redBright(`CAUTION: THIS WILL ${chalk.yellowBright("DELETE")} YOUR ACCOUNT INCLUDING ALL ITS SERVICES AND DATA.\n\nThis cannot be undone, even by Roli support.`));
        console.log("");
        console.log("Because this is a destructive operation, you must re-login.")
        if (!await executeLogin(null, false, false)) {
            return false;
        }
    } else {
        if (!await loginWithStoredCredentials()) {
            return false; //already logged
        }
    }

    const logContext = createLogContext();
    try {
        await AdminSingleton.deleteAccount(logContext);
        await logout();
        logOk("Roli account deleted");
        return true;
    } catch (e: any) {
        logRemoteError(logContext, e.message);
        return false;
    }
}