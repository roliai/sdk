import {logLocalError, logOk, logRemoteError} from "../util/logging";
import {Command} from "commander";
import {authEnabled, loginWithStoredCredentials} from "../service/auth";
import {createRoliClientAsAdmin, ModelRegistry, validateModelSpecification} from "../service/model-registry";
import {tryOpenAndParse} from "../util/config-file";
import {validateModelKeyOrError, validateServiceNameOrError} from "../util/validators";
import {tryGetAdminServiceAuthorization} from "../util/admin-service-authorization";

export function createRegisterModelCommand(before: any): Command {
    return new Command('register-model')
        .description("Registers a model with the service's Model Registry so that the service's code can use it at runtime.")
        .argument('<serviceName>', "Which service's Model Registry to register the model with.")
        .requiredOption('-k, --key <key>', "The key used to register the model. Use this value when calling getModel in service code.")
        .requiredOption('-m, --model <modelFile>', "A JSON file containing the model information. See https://admin.roli.app/docs/service-api/classes/Model for the specification.")
        .action(async (serviceName: string, opts: any) => {
            if (before)
                before();

            if (await executeRegisterModel(opts.key, serviceName, opts.model)) {
                process.exit(0);
            } else {
                process.exit(1);
            }
        });
}

export async function executeRegisterModel(key: string, serviceName: string, modelFile: string): Promise<boolean> {
    if (authEnabled() && !await loginWithStoredCredentials()) {
        return false; //already logged
    }

    if(!validateServiceNameOrError(serviceName))
        return false; // already logged

    if(!validateModelKeyOrError(key))
        return false; // already logged

    const model = tryOpenAndParse(modelFile);
    try {
        validateModelSpecification(model);
    }
    catch (e) {
        // @ts-ignore
        logLocalError(e.message);
        return false;
    }

    // Get an admin service authorization
    let authorization = await tryGetAdminServiceAuthorization(serviceName);
    if(!authorization)
        return false; // already logged

    // Use the admin key to create a Roli Client
    const client = createRoliClientAsAdmin(authorization);

    try
    {
        const modelRegistry = client.getEndpoint(ModelRegistry, "default");
        await modelRegistry.registerModel(key, model);
        logOk("Model registered");
    }
    catch (e) {
        // @ts-ignore
        logLocalError(e.message);
        return false;
    }
    finally {
        client.closeConnections();
    }

    return true;
}