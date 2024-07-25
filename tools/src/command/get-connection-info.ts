import {Command} from "commander";
import { getConnectionInfoFile, getConnectionInfoFilePath } from "../model/connection-info-file";
import { getColor } from "../util/logging";
import chalk from "chalk";

export function createGetConnectionInfoCommand(before: any): Command {
    return new Command('get-connection-info')
        .description(`Gets the Roli connection information`)
        .action(() => {
            if (before)
                before();

            if (executeGetConnectionInfo()) {
                process.exit(0);
            } else {
                process.exit(1);
            }
        });
}

export function executeGetConnectionInfo(): boolean {
    const connectionInfoFile = getConnectionInfoFile();
    console.log(getColor(chalk.whiteBright, `${getColor(chalk.green, getConnectionInfoFilePath())}:`));
    console.log(`${getColor(chalk.bold, 'Enterprise: ')}${getColor(connectionInfoFile.isEnterprise ? chalk.greenBright : chalk.yellowBright, connectionInfoFile.isEnterprise.toString())}`);
    console.log(`${getColor(chalk.bold, 'Admin URL: ')}${getColor(chalk.magentaBright , connectionInfoFile.adminBaseUrl)}`);
    console.log(`${getColor(chalk.bold, 'Api URL: ')}${getColor(chalk.blueBright , connectionInfoFile.apiBaseUrl)}`);
    console.log(`${getColor(chalk.bold, 'Login URL: ')}${getColor(chalk.blueBright , connectionInfoFile.loginUrl)}`);
    console.log(`Cmd: ${getColor(chalk.gray, `roli set-connection-info admin=${connectionInfoFile.adminBaseUrl} api=${connectionInfoFile.apiBaseUrl} login=${connectionInfoFile.loginUrl} ${connectionInfoFile.isEnterprise ? "--enterprise" : ""}`)}`);
    console.log();
    return true;
}