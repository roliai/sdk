import chalk from "chalk";
import {bold, getColor, logLocalError, logOk, logRemoteError, logVerbose, logWarning} from "../util/logging";
import path from 'path';
import {Command} from "commander";
import {AdminSingleton} from "../service/admin";
import {deserializeServiceIndex} from "../util/deserializer";
import {createOrUpdateClient} from "../util/client-generator";
import {createLogContext} from "../util/log-context";
import {
    ClientPackageManager,
    guessClientPackageManager,
    spawnClientPackageInstaller
} from "../util/shell-package-manager";
import inquirer from "inquirer";
import {NpmProjectConfig} from "../model/npm-project-config";
import {authEnabled, loginWithStoredCredentials} from "../service/auth";
import {addServicePackageDependency} from "../util/package-json.js";

export function createGenerateClientCommand(before: any): Command {
    return new Command('generate-client')
        .argument("serviceName", "The name of the service you wish to generate client code for. If not specified all existing generated clients in a client code project will be updated.")
        .option("--version <version>", "The deployed version of the service to generate client code for. Left unspecified, the latest service version will be used.")
        .option("--project <directory>", "The directory containing a client NPM project that you wish to generate the client in. This wires up the client code to talk to the service.")
        .option("--no-install", "Don't ask to run client package installation after generating client code for the first time in a given client code project.")
        .option("--pnpm", "Override the default package manager, using pnpm without prompting.")
        .option("--npm", "Override the default package manager, using npm without prompting.")
        .option("--yarn", "Override the default package manager, using yarn without prompting.")
        .option("--react", "Override React detection and enable Roli React support")
        .description('Generates client code that lets a client NPM project talk to a service hosted on Roli.')
        .action(async function (serviceName: string, opts: any) {
            if (before)
                before();

            let packageManager: ClientPackageManager | null = null;
            if(!opts.install) {
                if(opts.pnpm || opts.npm || opts.yarn)
                {
                    logLocalError("Cannot specify more than one of --no-install, --pnpm, --npm, or --yarn");
                    process.exit(1);
                }
                packageManager = ClientPackageManager.none;
            } else {
                let isSet = false;
                if(opts.pnpm) {
                    packageManager = ClientPackageManager.pnpm;
                    isSet = true;
                }
                if(opts.npm) {
                    if(isSet) {
                        logLocalError("Cannot specify more than one of --no-install, --pnpm, --npm, or --yarn");
                        process.exit(1);
                    }
                    packageManager = ClientPackageManager.npm;
                    isSet = true;
                }
                if(opts.yarn) {
                    if(isSet) {
                        logLocalError("Cannot specify more than one of --no-install, --pnpm, --npm, or --yarn");
                        process.exit(1);
                    }
                    packageManager = ClientPackageManager.yarn;
                }
            }

            if (await executeGenerateClient(
                packageManager,
                opts.project,
                serviceName,
                opts.version,
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
    packageManager: ClientPackageManager | null,
    projectDir: string | null,
    serviceName: string,
    versionStr: string | null,
    log: boolean,
    react: boolean
    ): Promise<boolean> {

    if(authEnabled() && !await loginWithStoredCredentials())
        return false; //already logged

    if(!serviceName) {
        logLocalError("Service name is required");
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

    let version: bigint | null = null;
    if(versionStr) {
        version = BigInt(versionStr);
        if(!version) {
            logLocalError("Invalid version specified");
            return false;
        }
    }
    return await generateClient(packageManager, projectConfig, serviceName, version, log, react);
}

async function generateClient(
    packageManager: ClientPackageManager | null,
    projectConfig: NpmProjectConfig,
    serviceName: string,
    serviceVersion: bigint | null,
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

    const regenCommand = `roli generate-client --project . ${serviceName}`;

    let react = forceReact;
    if(!react && projectConfig.hasReact) {
        react = true;
        logVerbose("Target NPM project has a React dependency, installing Roli React support");
    }

    const {servicePackageName, servicePackageDir, wasUpdate} =
        await createOrUpdateClient(logContext, userKey, serviceIndex, regenCommand, projectConfig.loadedFromDir,
             response.compressedServiceTypeDefinitionsStr, react);

    logVerbose(`Service package code written`);
    addServicePackageDependency(projectConfig.configFile, servicePackageName, servicePackageDir);
    logVerbose('Project updated');

    path.resolve()
    const for_ = `for the ${bold(getColor(chalk.magentaBright, serviceName))} service version ${bold(getColor(chalk.greenBright, `${updatedServiceVersion}`))} in the project located at ${getColor(chalk.yellowBright, projectConfig.loadedFromDir)}.`;

    const messagePrefix = wasUpdate ? "An existing" : "A new";
    const updatedOrCreated = wasUpdate ? "updated" : "created";

    // attempt to guess the package manager
    if(packageManager === null) {
        console.log(chalk.yellowBright(`Module dependencies must be installed using an appropriate package manager.`));
        packageManager = await promptClientPackageInstall(guessClientPackageManager(projectConfig.loadedFromDir));
    }

    // failed to guess or they chose no
    if(packageManager === null || packageManager === ClientPackageManager.none) {
        if(log)
            logOk(`${messagePrefix} code generated client was ${updatedOrCreated} ${for_}`);
        logWarning("You must install package dependencies before using the generated client code.");
    } else {
        spawnClientPackageInstaller(packageManager, projectConfig.loadedFromDir);
        if(log)
            logOk(`${messagePrefix} code generated client was ${updatedOrCreated} ${for_}`);
    }

    return true;
}