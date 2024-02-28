import path from "path";
import {logLocalError, logOk, logSuccess, logVerbose} from "../util/logging";
import fs from 'fs';
import {Command} from "commander";
import {ServiceIdentity, ServiceConfig, SERVICE_CONFIG_FILE_NAME} from "../model/service-config";
import {writeRuntime} from "../util/runtime";
import {SERVICE_RUNTIME_PACKAGE_NAME} from "../constants";
import { serviceNameRules, serviceNameValidator, validateServiceNameOrError } from "../util/validators";
import inquirer from "inquirer";
import chalk from "chalk";
import {copyTemplate} from "../util/template";
import {authEnabled, loginWithStoredCredentials} from "../service/auth";

export function createInitServiceCommand(before: any): Command {
    return new Command('init-service')
        .argument('[serviceName]', "The name of the new Roli service. Will prompt if not specified.")
        .option(`-d, --dir <name>`, "Directory where the new service code should live. This should be kept in source control.")
        .description("Initializes a new Roli service folder that can be deployed to the Roli backend and connected to from clients.")
        .action(async (serviceName: string, opts: any) => {
            if (before)
                before();
            if (await executeInitService(opts.dir, serviceName, true)) {
                process.exitCode = 0;
            } else {
                process.exitCode = 1;
            }
        });
}


function promptServiceName(def: string): Promise<string> {
    return new Promise<string>(resolve => {
        console.log(`Please choose a name for your service. This can be changed later in the ${SERVICE_CONFIG_FILE_NAME} file.`);
        console.log(chalk.gray(serviceNameRules));
        console.log();
        inquirer.prompt([{
            name: 'username',
            message: 'Service Name:',
            default: def,
            validate: serviceNameValidator
        }]).then(usernameAnswer => {
            resolve(usernameAnswer.username);
        });
    });
}

export async function executeInitService(dir: string | null, name: string | null, last: boolean): Promise<boolean> {
    if (authEnabled() && !await loginWithStoredCredentials()) {
        return false;
    }

    if(!dir) {
        dir = process.cwd();
    }

    dir = path.resolve(dir);
    if(ServiceConfig.fileExists(dir)) {
        logLocalError(`A service already exists in the ${dir} directory.`);
        return false;
    }

    name = name ?? await promptServiceName(path.basename(dir));
    
    if(!validateServiceNameOrError(name))
        return false; //already logged

    if(!fs.existsSync(dir))
        fs.mkdirSync(dir, {recursive: true});
    
    //Write the service source config file
    let serviceIdentity = new ServiceIdentity();
    let serviceConfig = new ServiceConfig(dir, name!, [], serviceIdentity, null);
    let serviceConfigFile = serviceConfig.writeToDir(dir);
    logVerbose(`Wrote ${serviceConfigFile}`);

    const runtimeFiles = writeRuntime(path.resolve(dir, SERVICE_RUNTIME_PACKAGE_NAME), true, false);
    for(const file of runtimeFiles) {
        logVerbose(`Wrote ${file}`);
    }

    copyTemplate("service.gitignore", path.join(dir, ".gitignore"));

    const message = `The "${serviceConfig.name}" service has been initialized in the directory "${dir}".`;

    if(last)
        logSuccess(message);
    else
        logOk(message);

    return true;
}