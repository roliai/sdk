import chalk from "chalk";
import {bold, getColor, logLocalError, logOk, logRemoteError, logVerbose, logWarning} from "../util/logging";
import fs from "fs";
import path from 'path';
import {Command} from "commander";
import {AdminSingleton} from "../service/admin";
import {deserializeServiceIndex} from "../util/deserializer";
import {createOrUpdateBinding} from "../util/binding-generator";
import {createLogContext} from "../util/log-context";
import {
    ClientPackageManager,
    spawnClientPackageInstaller,
    guessClientPackageManager
} from "../util/shell-package-manager";
import inquirer from "inquirer";
import { NpmProjectConfig } from "../model/npm-project-config";
import {authEnabled, loginWithStoredCredentials} from "../service/auth";
import { Unsigned, UnsignedOne } from "../util/unsigned";

const CLIENT_LIB_NAME = "roli-client";

function addServicePackageDependency(packageJsonFile: string, servicePackageName: string, relRootPath: string) {

    let packageJsonStr = fs.readFileSync(packageJsonFile, {encoding: "utf8"});
    let indentionRule = getPackageJsonIndentionRule(packageJsonStr);
    let packageJsonObj = JSON.parse(packageJsonStr);

    if (!packageJsonObj.hasOwnProperty("dependencies")) {
        packageJsonObj.dependencies = {};
    }

    packageJsonObj.dependencies[CLIENT_LIB_NAME] = "latest";
    packageJsonObj.dependencies[servicePackageName] = `file:./${relRootPath}`

    const indent = indentionRule.spaces ? indentionRule.count : "\t";
    let updatedPackageJsonStr = JSON.stringify(packageJsonObj, null, indent);
    fs.writeFileSync(packageJsonFile, updatedPackageJsonStr);
}

function getPackageJsonIndentionRule(jsonStr: string): any {
    const def = {spaces: true, count: 2};
    const re = /^(\s*)"name"/m;
    let match = re.exec(jsonStr);
    if (!match) {
        logWarning("Unknown indention found in package.json, using npm default of 2 spaces");
        return def;
    }
    const spaceCount = (match[1].match(/ /g) || []).length;
    const tabCount = (match[1].match(/\t/g) || []).length;
    if (spaceCount && tabCount) {
        logWarning("Inconsistent indention found in package.json, using npm default of 2 spaces");
        return def;
    }
    if (!spaceCount && !tabCount) {
        logWarning("Unknown indention found in package.json, using npm default of 2 spaces");
        return def;
    }

    if (spaceCount)
        return {spaces: true, count: spaceCount};

    if (tabCount)
        return {spaces: false};
}

export function createGenerateClientCommand(before: any): Command {
    return new Command('generate-client')
        .argument("[serviceName]", "The name of the service you wish to generate client code for. If not specified all existing generated clients in a client code project will be updated.")
        .option("-v, --version <version>", "The deployed version of the service to generate client code for. Left unspecified, the latest service version will be used.")
        .option("-d, --dir <directory>", "The directory containing a client NPM project that you wish to generate the client in. This wires up the client code to talk to the service.")
        .option("-ni, --no-install", "Don't ask to run client package installation after generating client code for the first time in a given client code project.")
        .description('Generates client code that lets a client NPM project talk to a service hosted on Roli.')
        .action(async function (serviceName: string, opts: any) {
            if (before)
                before();

            let install = opts.install;

            if (opts.ci) {
                install = false;
            }

            if (await executeGenerateClient(
                opts.dir,
                serviceName,
                opts.version,
                install,
                true)) {

                process.exitCode = 0;
            } else {
                process.exitCode = 1;
            }
        });
}

async function promptClientPackageInstall(def: ClientPackageManager): Promise<ClientPackageManager | null> {
    const no = "Do not install client modules";
    const installTypeAnswers = await inquirer.prompt([
        {
            type: 'list',
            name: 'installType',
            message: `Select a package manager:`,
            default: ClientPackageManager[def],
            choices: [
                ClientPackageManager[ClientPackageManager.pnpm],
                ClientPackageManager[ClientPackageManager.yarn],
                ClientPackageManager[ClientPackageManager.npm],
                no
            ]
        }
    ]);

    return installTypeAnswers.installType === no ?
        null :
        ClientPackageManager[installTypeAnswers.installType as keyof typeof ClientPackageManager];
}

export async function executeGenerateClient(
        projectDir: string | null,
        serviceName: string | null,
        versionStr: string | null,
        install: boolean,
        log: boolean
    ): Promise<boolean> {

    if(authEnabled() && !await loginWithStoredCredentials())
        return false; //already logged

    if(versionStr && !serviceName) {
        logLocalError("Service name is required when a version is specified.")
        return false;
    }

    // if the projectDir wasn't specified, start with the current directory and search upward for the project
    let projectConfig: NpmProjectConfig | null = null;
    if(!projectDir) {
        const dir = process.cwd();
        projectConfig = NpmProjectConfig.tryFindAndOpen(dir);
        if(!projectConfig) {
            logLocalError("package.json not found");
            return false;
        }
    } else {
        projectConfig = NpmProjectConfig.tryOpen(projectDir);
    }

    // unable to find the project
    if(!projectConfig) {
        return false; //already logged
    }

    if(!serviceName) {
        const bindingConfigs = projectConfig.getAllBindingConfigs();
        if(!bindingConfigs) {
            logLocalError('No bindings found to update');
            return false;
        }
    
        for(const bindingConfig of bindingConfigs) {
            if(!await generateClient(projectConfig, bindingConfig.serviceName, null, install, log))
                return false; // already logged
        }
        
        return true;
    } else {
        let version: Unsigned | null = null;
        if(versionStr) {
            version = Unsigned.tryParse(versionStr);
            if(!version) {
                logLocalError("Invalid version specified");
                return false;
            }
        }
        return await generateClient(projectConfig, serviceName, version, install, log);
    }
}
async function generateClient(
    projectConfig: NpmProjectConfig, 
    serviceName: string, 
    serviceVersion: Unsigned | null,
    install: boolean,
    log: boolean) : Promise<boolean> {

    if(!serviceName) {
        logLocalError("The service name is missing and required.");
        return false;
    }

    if(serviceVersion && serviceVersion < UnsignedOne) {
        logLocalError("Invalid service version. Must be greater than or equal to 1.");
        return false;
    }

    //get the service index for the service name
    const logContext = createLogContext();
    let response;
    try {
        response = await AdminSingleton.getServiceConnectionInfo(logContext, serviceName, serviceVersion);
        logVerbose('Service connection information retrieved');
    } catch (e) {
        // @ts-ignore
        logRemoteError(logContext, e.message);
        return false;
    }

    let userKey = response.userKey;
    let serviceIndex = deserializeServiceIndex(response.serviceIndexStr);

    logVerbose('Service index retrieved and validated')

    const regenCommand = `roli generate-client . ${serviceName}`;

    const {clientPackageName, clientPackageDir, wasUpdate} =
        createOrUpdateBinding(logContext, userKey, serviceIndex, regenCommand, projectConfig.loadedFromDir, 
            response.compressedServiceTypeDefinitionsStr);

    logVerbose(`Service package code written`);
    addServicePackageDependency(projectConfig.configFile, clientPackageName, clientPackageDir);
    logVerbose('Project updated');
    
    const updatedServiceVersion = Unsigned.fromLong(serviceIndex.serviceVersion());
    const connectedServiceVersion = Unsigned.tryParse(response.serviceVersionStr)!;

    if(updatedServiceVersion.value !== connectedServiceVersion.value) {
        logLocalError(`Unexpectedly the index version ${updatedServiceVersion} and the service version ${connectedServiceVersion} were different`);
        return false;
    }

    path.resolve()
    const for_ = `for the ${bold(getColor(chalk.magentaBright, serviceName))} service version ${bold(getColor(chalk.greenBright, `${updatedServiceVersion}`))} in the project located at ${getColor(chalk.yellowBright, projectConfig.loadedFromDir)}.`;

    const messagePrefix = wasUpdate ? "An existing" : "A new";
    const updatedOrCreated = wasUpdate ? "updated" : "created";

    if (install) {
        const cpm = guessClientPackageManager(projectConfig.loadedFromDir);
        console.log(chalk.yellowBright(`Module dependencies must be installed using an appropriate package manager.`));
        const packageInstaller = await promptClientPackageInstall(cpm);
        if (packageInstaller) {
            spawnClientPackageInstaller(packageInstaller, projectConfig.loadedFromDir);
            if(log)
                logOk(`${messagePrefix} code generated client was ${updatedOrCreated} ${for_}`);
        } else {
            if(log)
                logOk(`${messagePrefix} code generated client was ${updatedOrCreated} ${for_}`);
            logWarning("You must install package dependencies before using the generated client code.");
        }
    } else {
        if(log)
            logOk(`A new code generated client was created ${for_}`);
        logWarning("You must install package dependencies before using the generated client code.");
    }

    return true;
}