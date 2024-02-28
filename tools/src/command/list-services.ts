import {Command} from "commander";
import {bold, getColor, logRemoteError} from "../util/logging";
import {AdminSingleton} from "../service/admin";
import {createLogContext} from "../util/log-context";
import {authEnabled, loginWithStoredCredentials} from "../service/auth";
import {ServiceVersion} from "../model/service-version";
import {AsciiTable3} from "ascii-table3";
import chalk from "chalk";

export function createListServicesCommand(before: any) : Command {
    return new Command('list-services')
        .description('Display the services on your Roli account.')
        .action(async (opts: any) => {
            if (before)
                before();
            if (await executeListServices()) {
                process.exitCode = 0;
            } else {
                process.exitCode = 1;
            }
        });
}

export async function getServiceVersions(): Promise<ServiceVersion[] | null> {
    const logContext = createLogContext();
    try {
        const response = await AdminSingleton.listServices(logContext);
        if(response.serviceVersions && response.serviceVersions.length > 0) {
            return response.serviceVersions;
        } else {
            console.log("No services found");
            return null;
        }
    } catch (e: any) {
        logRemoteError(logContext, e.message);
        return null;
    }
}

export async function executeListServices(): Promise<boolean> {
    if (authEnabled() && !await loginWithStoredCredentials()) {
        return false; //already logged
    }

    const serviceVersions = await getServiceVersions();
    if(!serviceVersions) {
        return true;
    }

    interface ServiceVersionInfo {
        version: string;
        deployment: string;
    }

    let services: Map<string, ServiceVersionInfo[]> = new Map();
    for(let serviceVersion of serviceVersions) {
        const name = serviceVersion.serviceName;
        if(!services.has(name)) {
            services.set(name, []);
        }
        let items = services.get(name);
        items!.push({ version: serviceVersion.serviceVersionStr, deployment: new Date(serviceVersion.deploymentDateStr).toLocaleString()});
    }

    for(let name of services.keys()) {
        let versions = services.get(name);
        if(versions) {
            let table = new AsciiTable3(bold(getColor(chalk.magentaBright, name)))
                .setHeading('Version', 'Deployed')
                .setAlignCenter(1);

            for(let version of versions) {
                table.addRow(getColor(chalk.greenBright, version.version), getColor(chalk.yellowBright, version.deployment));
            }

            table.setStyle('compact');
            console.log(table.toString());
        }
    }
    return true;
}