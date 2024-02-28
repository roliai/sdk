import {Data, Endpoint, RoliClient, ServiceOptions} from "../client/public";
import {__Endpoint_InternalClient_Key, internalCreateClient, TypeRegistryBuilder} from "../client/internal";
import {ServiceKey} from "../client/internal/internal-model-types";
import {getApiUrl} from "../model/connection-info-file";
import {GlobalOptions} from "../util/global-options";
import {AdminServiceAuthorization} from "../util/admin-service-authorization";

// NOTE: This must match what's defined in roli/framework/packages/system/src/roli-system-internal.ts
const ROLI_MODEL_REGISTRY_CLASS_ID = 1;
const ROLI_MODEL_REGISTRY_unregisterModel_METHOD_ID = 100;
const ROLI_MODEL_REGISTRY_registerModel_METHOD_ID = 101;
const ROLI_MODEL_REGISTRY_getRegistrationKeys_METHOD_ID = 102;
const ROLI_MODEL_REGISTRY_getRegistrations_METHOD_ID = 103;

const MODEL_REGISTRATION_CLASS_ID = 2;

// WARNING: This must match what's defined in roli/framework/packages/system/src/roli-system-internal.ts
function isNullOrWhitespace( input: any ) {
    return !input || !input.trim();
}

// WARNING: This must match what's defined in roli/framework/packages/system/src/roli-system-internal.ts
export function validateModelSpecification(model: any) {
    const baseError = "ModelSpecification is invalid. ";

    if(!model)
        throw new Error("ModelSpecification is empty");

    if(!model.name || isNullOrWhitespace(model.name))
        throw new Error(baseError + "Missing model name.");

    if(!model.url)
        throw new Error(baseError + "Missing url.");

    if(!model.settings)
        throw new Error(baseError + "Missing model settings.");

    if(!model.settings.kind)
        throw new Error(baseError + "Missing model settings kind");

    switch (model.settings.kind) {
        case 'chat-model':
            break;
        default:
            throw new Error(baseError + "Unsupported model kind.")
    }

    if(model.settings.response_format && typeof model.settings.response_format === "string") {
        switch(model.settings.response_format) {
            case "json":
                break;
            case "text":
                break;
            default:
                throw new Error(baseError + "Unsupported model settings response_format");
        }
    }
}

// WARNING: This must match what's defined in roli/framework/packages/system/src/roli-system-internal.ts
export class ModelRegistry extends Endpoint {
    constructor(primaryKey: string) {
        super(primaryKey);
    }

    // Method: 100
    async unregisterModel(key: string): Promise<void> {
        return await Endpoint[__Endpoint_InternalClient_Key].callEndpointMethod(this, ROLI_MODEL_REGISTRY_unregisterModel_METHOD_ID, key);
    }

    // Method: 101
    async registerModel(key: string, model: any): Promise<void> {
        return await Endpoint[__Endpoint_InternalClient_Key].callEndpointMethod(this, ROLI_MODEL_REGISTRY_registerModel_METHOD_ID, key, model);
    }

    // Method: 102
    async getRegistrationKeys(): Promise<string[]> {
        return await Endpoint[__Endpoint_InternalClient_Key].callEndpointMethod(this, ROLI_MODEL_REGISTRY_getRegistrationKeys_METHOD_ID);
    }

    // Method: 103
    async getRegistrations(keys: string[] | string): Promise<Map<any, any>> {
        return await Endpoint[__Endpoint_InternalClient_Key].callEndpointMethod(this, ROLI_MODEL_REGISTRY_getRegistrations_METHOD_ID, keys);
    }
}

// WARNING: This must match what's defined in roli/framework/packages/system/src/roli-system-internal.ts
export class ModelRegistration extends Data {
    private readonly _model: any;
    private readonly _registered: Date;

    get model(): any {
        return this._model;
    }

    get registered(): Date {
        return this._registered;
    }

    constructor(key: string, model: any) {
        super(key);
        if (!model)
            throw new Error("Invalid model");
        this._model = model;
        this._registered = new Date();
    }
}

export function createRoliClientAsAdmin(authorization: AdminServiceAuthorization, options?: ServiceOptions): RoliClient {
    const registryBuilder = new TypeRegistryBuilder();

    options = options ?? {
        enableMessageTracing: GlobalOptions.verbose,
        enableVerboseLogging: GlobalOptions.verbose,
        debugLogHeader: new ServiceOptions().debugLogHeader
    };

    // Register the service
    registryBuilder.registerService(authorization.serviceName, true, authorization.adminKey,
        authorization.serviceIdStr, authorization.serviceVersionStr);

    const serviceKey = new ServiceKey(authorization.serviceId, authorization.serviceVersion);

    // Register the ModelRegistry endpoint
    registryBuilder.registerEndpoint(ModelRegistry.name, ModelRegistry, serviceKey, ROLI_MODEL_REGISTRY_CLASS_ID);

    // Register the ModelRegistration data object
    registryBuilder.registerData(ModelRegistration.name, ModelRegistration, serviceKey, MODEL_REGISTRATION_CLASS_ID);

    const apiUrl = getApiUrl();

    // Create the roli client
    return internalCreateClient(registryBuilder.build(), apiUrl, options);
}