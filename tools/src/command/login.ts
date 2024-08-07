import chalk from "chalk";
import http from "node:http";
import url from "url";
import open from "open";
import {logVerbose, logLocalError, logRemoteError, logOk} from "../util/logging";
import {Command} from "commander";
import {sleep} from "../util/sleep";
import {readTemplate} from "../util/template";
import {AdminSingleton} from "../service/admin";
import {createLogContext} from "../util/log-context";
import {
    overrwriteLogin,
    loginWithUserJson,
    getIsLoggedInUserAnonymous, loginAnonymously,
    loginWithEmailAndPassword
} from "../service/auth";

import {HostURL} from "@webcontainer/env";
import { getLoginUrl } from "../model/connection-info-file";

const CALLBACK_SERVER_START_PORT=3080;

export function createLoginCommand(before: any) : Command {
    return new Command('login')
        .description('Login to Roli')
        .option('--file <file>', "Log in using the specific login file")
        .option('--anonymous', "Login anonymously. Anonymous accounts are removed after 4 hours.")
        .action(async (opts: any) => {
            if (before) {
                before();
            }

            let login;
            if(opts.anonymous) {
                login = <AnonymousLogin>{kind: "anonymous"};
            } else if(opts.file) {
                login = <FileLogin>{kind: 'file', file: opts.file};
            } else {
                login = <InteractiveLogin>{kind: 'interactive'};
            }

            if (await executeLogin(login, true)) {
                process.exit(0);
            } else {
                process.exit(1);
            }
        });
}

async function openLoginPageAndWait(callbackPort: number) {
    const callbackUrl = HostURL.parse(`http://localhost:${callbackPort}`);
    const encoded = Buffer.from(callbackUrl.href).toString('base64');
    const loginUrl = getLoginUrl();
    const url = `${loginUrl}?cb=${encoded}`;
    await open(url);
    console.log(chalk.blueBright("Your browser has been opened to visit:"));
    console.log("");
    console.log("    " + url);
    console.log("");
}

interface LoginData {
    user: any;
}

let sockets = new Set();

function startCallbackServer(startingPort: number, callback: (loginData: LoginData) => void) : Promise<[number, http.Server]> {
    const server = http.createServer(function (req, res) {
        const queryData = url.parse(req.url!, true).query;
        const encoded = queryData.d as string;
        if(!encoded) {
            logVerbose("Ignoring unknown request");
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end();
            return;            
        }

        const json = Buffer.from(encoded, 'base64').toString();

        const loginData = JSON.parse(json) as LoginData;

        res.writeHead(200, {'Content-Type': 'text/html'});
        res.write(readTemplate("logged-in/logged-in.html"));
        res.end();

        callback(loginData);
    });

    let port = startingPort;

    return new Promise((accept) => {
        const onError = (err: any) => {
            // @ts-ignore
            if (err.code === 'EADDRINUSE') {
                ++port;
                logVerbose('Address in use, retrying with different port...');
                setTimeout(() => {
                    server.close();
                    server.once('error', onError);
                    server.listen(port);
                }, 1000);
            }
        };
        server.once('error', onError);
        server.once('listening', () => {
            logVerbose(`Callback server listening on ${port}`);
            accept([port, server]);
        });
        server.on('connection', (socket) => {
            sockets.add(socket);
            server.once('close', () => {
                sockets.delete(socket);
            });
        });
        server.listen(port);
    });
}

export interface InteractiveLogin {
    kind: 'interactive';
}

export interface FileLogin {
    kind: 'file';
    file: string;
}

export interface AnonymousLogin {
    kind: 'anonymous';
}

export interface EmailLogin {
    kind: 'email';
    username: string;
    password: string;
}

export async function executeLogin(login: FileLogin | AnonymousLogin | EmailLogin | InteractiveLogin, log: boolean): Promise<boolean> {
    if(login.kind === "file") {
        if(!await overrwriteLogin(login.file))
            return false;
        if(log)
            logOk("Login");
        return true;
    }
    else if(login.kind === "anonymous") {
        await loginAnonymously();
    }
    else if(login.kind === "email") {
        await loginWithEmailAndPassword(login.username, login.password);
    }
    else if(login.kind === "interactive") {
        let called = false;
        let loginData: LoginData;

        const [port, server] = await startCallbackServer(CALLBACK_SERVER_START_PORT,
            (ld : LoginData) => {
                loginData = ld;
                called = true;
            });

        await openLoginPageAndWait(port);

        while (!called) {
            await sleep(100);
        }

        logVerbose("Closing callback server...");

        for (const socket of sockets) {
            // @ts-ignore
            socket.destroy();
            sockets.delete(socket);
        }
        server.close(() => {
            logVerbose("Closed callback server");
        })

        // @ts-ignore
        if(!loginData || !loginData.user) {
            logLocalError("Login failed because no data was returned");
            return false;
        }

        await loginWithUserJson(loginData.user);
    }
    else {
        logLocalError("Invalid login kind");
        return false;
    }

    const logContext = createLogContext();
    try {
        if(getIsLoggedInUserAnonymous()) {
            await AdminSingleton.loginAnonymousAccount(logContext);
            if(log)
                logOk("Anonymous account logged in");
        } else {
            await AdminSingleton.loginAccount(logContext);
            if(log)
                logOk("Account logged in");
        }
    } catch (e: any) {
        logRemoteError(logContext, e.message);
        return false;
    }

    return true;
}