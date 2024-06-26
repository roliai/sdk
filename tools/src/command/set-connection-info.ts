import {getColor, logLocalError, logOk} from "../util/logging";
import {Command} from "commander";
import { ConnectionInfoFile, getConnectionInfoFilePath } from "../model/connection-info-file";
import chalk from "chalk";

function getStringFromToken(kind: string, token: string) : string | null {
    const regex = new RegExp(kind + "\\s*=\\s*(\\S+)", 'gm');
    let m = regex.exec(token);
    if(m && m.length > 1)
        return m[1];
    return null;
}

export function createSetConnectionInfoCommand(before: any): Command {
    return new Command('set-connection-info')
        .argument(`admin=<adminUrl>`, "Literally 'admin=' followed by the Roli Admin URL. Example: admin=https://admin.roli.app")
        .argument(`api=<apiUrl>`, "Literally 'api=' followed by the Roli API URL. Example: api=https://api.roli.app")
        .argument(`login=<loginUrl>`, "Literally 'login=' followed by the Roli Login URL. Example: login=https://admin.roli.app/login")
        .option(`--enterprise`, "Whether or not the Roli backend is Enterprise Edition. Include to enable Enterprise Edition communication.")
        .description("Sets the connection information to use when talking to the Roli backend and generating client connection code.")
        .action((token1: string, token2: string, token3: string, opts: any) => {
            if (before)
                before();

            let tokens = [token1, token2, token3];
            let apiUrl, adminUrl, loginUrl;
            for(const token of tokens) {
                let t;
                if(!apiUrl) {
                    t = getStringFromToken('api', token);
                    if(t) {
                        apiUrl = t;
                        continue;
                    }
                }
                if(!adminUrl) {
                    t = getStringFromToken('admin', token);
                    if(t) {
                        adminUrl = t;
                        continue;
                    }
                }
                if(!loginUrl) {
                    t = getStringFromToken('login', token);
                    if(t) {
                        loginUrl = t;
                    }
                }
            }

            if(!apiUrl) {
                logLocalError("Invalid api URL token. Expected format: api=url");
                return;
            }
        
            if(!adminUrl) {
                logLocalError("Invalid admin URL token. Expected format: admin=url");
                return;
            }

            if(!loginUrl) {
                logLocalError("Invalid login URL token. Expected format: login=url");
                return;
            }

            if (executeSetConnectionInfo(apiUrl, adminUrl, loginUrl, opts.enterprise)) {
                process.exit(0);
            } else {
                process.exit(1);
            }
        });
}


function canonicalizeUrl(what: string, url: string) : URL | null {
    try {
        const u = new URL(url);               

        if(!(u.protocol === `http:` || u.protocol === `https:`)) {
            logLocalError(`The ${what} URL ${getColor(chalk.bold, url)} is invalid. The protocol must be either http or https.`);
            return null;
        }

        if(u.search) {
            logLocalError(`The ${what} URL ${getColor(chalk.bold, url)} is invalid. The query must be empty.`);
            return null;
        }
        
        if(u.username || u.password) {
            logLocalError(`The ${what} URL ${getColor(chalk.bold, url)} is invalid. Username and password are not supported.`);
            return null;
        }

        return u;
    } catch (err) {
        logLocalError(`The ${what} URL ${getColor(chalk.bold, url)} is invalid. ${err}`);
        return null;
    }
}

export function executeSetConnectionInfo(apiUrlStr: string, adminUrlStr: string, loginUrlStr: string, isEnterprise: boolean): boolean {
    const apiUrl = canonicalizeUrl(getColor(chalk.blueBright, 'api'), apiUrlStr);
    if(!apiUrl) {
        //already logged
        return false;
    }

    const adminUrl = canonicalizeUrl(getColor(chalk.magentaBright, 'admin'), adminUrlStr);
    if(!adminUrl) {
        //already logged
        return false;
    }

    const loginUrl = canonicalizeUrl(getColor(chalk.magentaBright, 'login'), loginUrlStr);
    if(!loginUrl) {
        //already logged
        return false;
    }

    new ConnectionInfoFile(isEnterprise, apiUrl.toString(), adminUrl.toString(), loginUrl.toString()).write();

    const endpoints = ConnectionInfoFile.tryOpen();
    if(!endpoints) { 
        // already logged
        return false;
    }
    
    if(endpoints?.adminBaseUrl !== adminUrl.toString()) {
        logLocalError(`Unexpectedly the adminBaseUrl property value "${endpoints?.adminBaseUrl ?? '<empty>'}" in the newly written ${getConnectionInfoFilePath()} file didn't match '${adminUrl}'`);
        return false;
    }
    if(endpoints?.apiBaseUrl !== apiUrl.toString()) {
        logLocalError(`Unexpectedly the apiBaseUrl property value "${endpoints?.apiBaseUrl ?? '<empty>'}" in the newly written ${getConnectionInfoFilePath()} file didn't match '${apiUrl}'`);
        return false;
    }
    if(endpoints?.loginUrl !== loginUrl.toString()) {
        logLocalError(`Unexpectedly the loginUrl property value "${endpoints?.loginUrl ?? '<empty>'}" in the newly written ${getConnectionInfoFilePath()} file didn't match '${loginUrl}'`);
        return false;
    }

    logOk("Connection info set");
    return true;
}