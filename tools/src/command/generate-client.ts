import chalk from "chalk";
import {bold, getColor, logLocalError, logOk, logRemoteError, logVerbose, logWarning} from "../util/logging";
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
import {addServicePackageDependency} from "../util/package-json.js";

export function createGenerateClientCommand(before: any): Command {
    return new Command('generate-client')
        .argument("[serviceName]", "The name of the service you wish to generate client code for. If not specified all existing generated clients in a client code project will be updated.")
        .option("-v, --version <version>", "The deployed version of the service to generate client code for. Left unspecified, the latest service version will be used.")
        .option("-d, --dir <directory>", "The directory containing a client NPM project that you wish to generate the client in. This wires up the client code to talk to the service.")
        .option("-ni, --no-install", "Don't ask to run client package installation after generating client code for the first time in a given client code project.")
        .option("--react", "Override React detection and enable Roli React support")
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
                true,
                opts.react)) {
                process.exit(0);
            } else {
                process.exit(1);
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
        log: boolean,
        react: boolean
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
            if(!await generateClient(projectConfig, bindingConfig.serviceName, null, install, log, react))
                return false; // already logged
        }
        
        return true;
    } else {
        let version: bigint | null = null;
        if(versionStr) {
            version = BigInt(versionStr);
            if(!version) {
                logLocalError("Invalid version specified");
                return false;
            }
        }
        return await generateClient(projectConfig, serviceName, version, install, log, react);
    }
}
async function generateClient(
    projectConfig: NpmProjectConfig, 
    serviceName: string, 
    serviceVersion: bigint | null,
    install: boolean,
    log: boolean,
    forceReact: boolean) : Promise<boolean> {

    if(!serviceName) {
        logLocalError("The service name is missing and required.");
        return false;
    }

    if(serviceVersion && serviceVersion < BigInt(1)) {
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

    const updatedServiceVersion = serviceIndex.serviceVersion();
    const connectedServiceVersion = BigInt(response.serviceVersionStr)!;

    if(updatedServiceVersion !== connectedServiceVersion) {
        logLocalError(`Unexpectedly the index version ${updatedServiceVersion} and the service version ${connectedServiceVersion} were different`);
        return false;
    }

    const regenCommand = `roli generate-client . ${serviceName}`;

    let react = forceReact;
    if(!react && projectConfig.hasReact) {
        react = true;
        logVerbose("Target NPM project has a React dependency, installing Roli React support");
    }

    const {servicePackageName, servicePackageDir, wasUpdate} =
        await createOrUpdateBinding(logContext, userKey, serviceIndex, regenCommand, projectConfig.loadedFromDir,
            response.compressedServiceTypeDefinitionsStr, react);

    logVerbose(`Service package code written`);
    addServicePackageDependency(projectConfig.configFile, servicePackageName, servicePackageDir);
    logVerbose('Project updated');

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