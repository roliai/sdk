import {logOk, logWarning} from "../util/logging";
import {Command} from "commander";
import {logout} from "../service/auth";
import {LoginFile} from "../model/login-file";

export function createLogoutCommand(before: any) : Command {
    return new Command('logout')
        .description('Log out from Roli')
        .action(async (opts: any) => {
            if (before) {
                before();
            }
            if (await executeLogout()) {
                process.exit(0);
            } else {
                process.exit(1);
            }
        });
}

export async function executeLogout(): Promise<boolean> {
    if(LoginFile.exists()) {
        await logout();
        logOk("Logged out");
        return true;
    } else {
        logWarning("Not logged in");
        return false;
    }
}