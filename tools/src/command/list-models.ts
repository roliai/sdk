import {bold, getColor, logRemoteError} from "../util/logging";
import {Command} from "commander";
import {authEnabled, loginWithStoredCredentials} from "../service/auth";
import {createRoliClientAsAdmin, ModelRegistration, ModelRegistry} from "../service/model-registry";
import {tryGetAdminServiceAuthorization} from "../util/admin-service-authorization";
import {sysLogError} from "../client/internal/util/logging";
import {AsciiTable3} from "ascii-table3";
import chalk from "chalk";
import {validateServiceNameOrError} from "../util/validators";

export function createListModelsCommand(before: any): Command {
    return new Command('list-models')
        .description("Lists all the models registered with a service's Model Registry.")
        .argument('<serviceName>', "The service whose models you wish to list.")
        .action(async (serviceName: string) => {
            if (before)
                before();

            if (await executeListModels(serviceName)) {
                process.exitCode = 0;
            } else {
                process.exitCode = 1;
            }
        });
}

export async function getModelRegistrations(serviceName: string): Promise<Map<string, ModelRegistration> | null> {
    const authorization = await tryGetAdminServiceAuthorization(serviceName);
    if(!authorization) {
        return null; // already logged
    }

    // Use the admin key to create a Roli Client
    const client = createRoliClientAsAdmin(authorization);

    let registrations: Map<string, ModelRegistration>;
    try
    {
        const modelRegistry = client.getEndpoint(ModelRegistry, "default");
        const keys = await modelRegistry.getRegistrationKeys();
        if(!keys || keys.length === 0) {
            console.log("No models found");
            return null;
        }
        registrations = await modelRegistry.getRegistrations(keys);
        if(!registrations || registrations.size == 0) {
            sysLogError("Unexpectedly there were registration keys but no actual registrations.");
            return null;
        }
        return registrations;
    }
    catch (e) {
        // @ts-ignore
        logRemoteError(e.logContext, "An error occurred while trying to get the list of models: " + e.message);
        return null;
    }
    finally {
        client.closeConnections();
    }
}

export async function executeListModels(serviceName: string): Promise<boolean> {
    if (authEnabled() && !await loginWithStoredCredentials()) {
        return false; //already logged
    }

    if(!validateServiceNameOrError(serviceName))
        return false; // already logged

    const registrations = await getModelRegistrations(serviceName);
    if(!registrations)
        return false; // already logged

    let table = new AsciiTable3(bold(getColor(chalk.magentaBright, serviceName)))
        .setHeading('Model Key', 'Registered')
        .setAlignCenter(1);

    for(let key of registrations.keys()) {
        let registration = registrations.get(key);
        if(!registration) {
            sysLogError("Model registration returned empty");
            return false;
        }
        table.addRow(
            getColor(chalk.cyanBright, key),
            getColor(chalk.yellowBright,
            registration.registered.toLocaleString()));
    }

    table.setStyle('compact');
    console.log(table.toString());

    return true;
}