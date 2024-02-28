import {logLocalError, logOk, logRemoteError} from "../util/logging";
import {Command} from "commander";
import {authEnabled, loginWithStoredCredentials} from "../service/auth";
import {createRoliClientAsAdmin, ModelRegistry} from "../service/model-registry";
import {validateModelKeyOrError, validateServiceNameOrError} from "../util/validators";
import {tryGetAdminServiceAuthorization} from "../util/admin-service-authorization";

export function createUnregisterModelCommand(before: any): Command {
    return new Command('unregister-model')
        .description("Removes a model from the service's Model Registry.")
        .argument('<serviceName>', "Which service's Model Registry to unregister the model from.")
        .requiredOption('-k, --key <key>', "The key of the model you wish to unregister.")
        .action(async (serviceName: string, opts: any) => {
            if (before)
                before();

            if (await executeUnregisterModel(opts.key, serviceName)) {
                process.exitCode = 0;
            } else {
                process.exitCode = 1;
            }
        });
}

export async function executeUnregisterModel(key: string, serviceName: string): Promise<boolean> {
    if (authEnabled() && !await loginWithStoredCredentials()) {
        return false; //already logged
    }

    if(!validateServiceNameOrError(serviceName))
        return false; // already logged

    if(!validateModelKeyOrError(key))
        return false; // already logged

    const authorization = await tryGetAdminServiceAuthorization(serviceName);
    if(!authorization) {
        return false; // already logged
    }

    // Use the admin key to create a Roli Client
    const client = createRoliClientAsAdmin(authorization);

    try
    {
        const modelRegistry = client.getEndpoint(ModelRegistry, "default");
        await modelRegistry.unregisterModel(key);
        logOk(`Model ${key} unregistered`);
    }
    catch (e) {
        // @ts-ignore
        logRemoteError(e.logContext, e.message);
        return false;
    }
    finally {
        client.closeConnections();
    }

    return true;
}