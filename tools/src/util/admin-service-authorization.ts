import {createLogContext} from "./log-context";
import {AdminSingleton} from "../service/admin";
import {logRemoteError} from "./logging";

export class AdminServiceAuthorization {
    constructor(public adminKey: string,
                public serviceName: string,
                public serviceId: bigint,
                public serviceIdStr: string,
                public serviceVersion: bigint,
                public serviceVersionStr: string) {
    }
}

export async function tryGetAdminServiceAuthorization(serviceName: string) : Promise<AdminServiceAuthorization | null> {
    // Get the admin key (and the serviceId/serviceVersion) from Admin
    const logContext = createLogContext();

    let serviceIdStr: string;
    let serviceVersionStr: string;
    let adminKey: string;
    try {
        const resp = await AdminSingleton.getAdminKey(logContext, serviceName);
        serviceIdStr = resp.serviceIdStr;
        if (!BigInt(serviceIdStr)) {
            logRemoteError(logContext, "Invalid serviceId returned");
            return null;
        }
        serviceVersionStr = resp.serviceVersionStr;
        if (!BigInt(serviceVersionStr)) {
            logRemoteError(logContext, "Invalid serviceVersion returned");
            return null;
        }
        adminKey = resp.adminKey;
        if (!adminKey) {
            logRemoteError(logContext, "Invalid adminKey returned");
            return null;
        }
        if (!resp.adminKeyTtlStr) {
            logRemoteError(logContext, "Invalid adminKeyTtl returned");
            return null;
        }
        const ttl = new Date(resp.adminKeyTtlStr);
        if (!ttl) {
            logRemoteError(logContext, "Invalid adminKeyTtl returned");
            return null;
        }
        if (ttl < new Date()) {
            logRemoteError(logContext, "Expired adminKey returned");
            return null;
        }
        const serviceId = BigInt(serviceIdStr);
        if (!serviceId) {
            logRemoteError(logContext,"Invalid serviceId returned");
            return null;
        }
        const serviceVersion = BigInt(serviceVersionStr);
        if (!serviceVersion) {
            logRemoteError(logContext,"Invalid serviceVersionId returned");
            return null;
        }

        return {
            serviceName: serviceName,
            adminKey: adminKey,
            serviceId: serviceId,
            serviceIdStr: serviceIdStr,
            serviceVersion: serviceVersion,
            serviceVersionStr: serviceVersionStr
        };
    } catch (e) {
        // @ts-ignore
        logRemoteError(logContext, e.message);
    }

    return null;
}