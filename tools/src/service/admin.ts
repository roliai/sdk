import {requiresTruthy} from "../util/requires";
import {ROLI_SERVER_ERROR_CODE, parseError} from "../model/admin-error";
import fetch from 'cross-fetch';
import {ServiceVersion} from "../model/service-version";
import {ServiceClassMapping} from "../model/service-config";
import {ADMIN_TOOLS_PROTOCOL_VERSION} from "../config";
import {logLocalError, logVerbose} from "../util/logging";
import {getIdToken, logout} from "./auth";
import {getAdminApiUrl, getIsEnterprise} from "../model/connection-info-file";

export interface PermissionAssignment {
    className: string;
    scopes: string[];
    access: number;
    fileName: string;
    fileLine: number;
    fileColumn: number;
}

export interface AuthorizeAssignment {
    className: string;
    methodName: string;
    scopes: string[];
    fileName: string;
    fileLine: number;
    fileColumn: number;
}

//-- REQUEST

class DeployServiceRequest {
    constructor(public logContext: string,
                public serviceName: string,
                public language: number,
                public serviceFiles: ServiceFileContent[],
                public compressedServiceTypeDefinitionsStr: string,
                public permissionAssignments: PermissionAssignment[],
                public authorizeAssignments: AuthorizeAssignment[],
                public serviceIdStr?: string,
                public serviceClassMappings?: ServiceClassMapping[],
                public lastClassId?: number) {
        requiresTruthy('logContext', logContext);
        requiresTruthy('serviceName', serviceName);
        if (language !== 0)
            throw new Error("invalid service language");
        requiresTruthy('serviceFiles', serviceFiles);
        requiresTruthy('compressedServiceTypeDefinitionsStr', compressedServiceTypeDefinitionsStr);
    }
}

class DeleteServiceVersionRequest {
    constructor(public logContext: string,
                public serviceName: string,
                public serviceVersionStr: string) {
        requiresTruthy('logContext', logContext);
        requiresTruthy('serviceName', serviceName);
        requiresTruthy('serviceVersionStr', serviceName);
    }
}

class DeleteServiceRequest {
    constructor(public logContext: string,
                public serviceName: string) {
        requiresTruthy('logContext', logContext);
        requiresTruthy('serviceName', serviceName);
    }
}

class GetAdminKeyRequest {
    constructor(public logContext: string,
                public serviceName: string) {
        requiresTruthy('logContext', logContext);
        requiresTruthy('serviceName', serviceName);
    }
}

export class ServiceFileContent {
    constructor(public code: string, public name: string) {
        requiresTruthy('code', code);
        requiresTruthy('name', name);
    }
}

//-- RESPONSE

class ListServicesResponse {
    constructor(public serviceVersions: ServiceVersion[]) {
        requiresTruthy('serviceVersions', serviceVersions);
    }
}

class DeployServiceResponse {
    constructor(public serviceIdStr: string, public serviceVersionStr: string, public serviceClassMappings: ServiceClassMapping[]) {
        requiresTruthy('serviceIdStr', serviceIdStr);
        requiresTruthy('serviceVersionStr', serviceVersionStr);
        requiresTruthy('serviceClassMappings', serviceClassMappings)
    }
}

class GetServiceConnectionInfoResponse {
    constructor(public serviceIndexStr: string,
                public serviceVersionStr: string,
                public userKey: string,
                public compressedServiceTypeDefinitionsStr: string) {
        requiresTruthy('serviceIndexStr', serviceIndexStr);
        requiresTruthy('serviceVersionStr', serviceVersionStr);
        requiresTruthy('userKey', userKey);
        requiresTruthy('compressedServiceTypeDefinitionsStr', compressedServiceTypeDefinitionsStr);
    }
}

class GetAdminKeyResponse {
    constructor(public serviceVersionStr: string,
                public serviceIdStr: string,
                public adminKey: string,
                public adminKeyTtlStr: string) {
        requiresTruthy('serviceVersionStr', serviceVersionStr);
        requiresTruthy('serviceIdStr', serviceIdStr);
        requiresTruthy('adminKey', adminKey);
        requiresTruthy('adminKeyTtlStr', adminKeyTtlStr);
    }
}

const ROLI_JAVASCRIPT_LANGUAGE = 0;


export class Admin {
    public async loginAnonymousAccount(logContext: string): Promise<void> {
        try {
            await this.makeServiceCall("POST", `tools-developer-account/login-anonymous-account?logContext=${logContext}`,
                false, true);
        } catch (e: any) {
            if (e.code === "ECONNREFUSED")
                throw new Error("Failed because the connection was refused");
            throw new Error(e.message);
        }
    }

    public async loginAccount(logContext: string): Promise<void> {
        try {
            await this.makeServiceCall("POST",
                `tools-developer-account/login-account?logContext=${logContext}`, false, true);
        } catch (e: any) {
            if (e.code === "ECONNREFUSED")
                throw new Error("Failed because the connection was refused");
            throw new Error(e.message);
        }
    }

    public async deleteAccount(logContext: string): Promise<void> {
        try {
            await this.makeServiceCall("DELETE",
                `tools-developer-account/delete-account?logContext=${logContext}`, false, true);
        } catch (e: any) {
            if (e.code === "ECONNREFUSED")
                throw new Error("Failed because the connection was refused");
            throw new Error(e.message);
        }
    }

    public async listServices(logContext: string): Promise<ListServicesResponse> {
        try {
            let json = await this.makeServiceCall("GET",
                `tools-service-admin/list-services?logContext=${logContext}`, true, true);
            return new ListServicesResponse(json.serviceVersions);
        } catch (e: any) {
            if (e.code === "ECONNREFUSED")
                throw new Error("Failed because the connection was refused");
            throw new Error(e.message);
        }
    }

    public async deleteServiceVersion(logContext: string, serviceName: string, serviceVersionStr: string): Promise<void> {
        const req = new DeleteServiceVersionRequest(logContext, serviceName, serviceVersionStr);

        try {
            await this.makeServiceCall("POST",
                "tools-service-admin/delete-service-version", false, true, req);
        } catch (e: any) {
            if (e.code === "ECONNREFUSED")
                throw new Error("Failed because the connection was refused");
            throw new Error(e.message);
        }
    }

    public async deleteService(logContext: string, serviceName: string): Promise<void> {
        const req = new DeleteServiceRequest(logContext, serviceName);

        try {
            await this.makeServiceCall("POST",
                "tools-service-admin/delete-service", false, true, req);
        } catch (e: any) {
            if (e.code === "ECONNREFUSED")
                throw new Error("Failed because the connection was refused");
            throw new Error(e.message);
        }
    }

    public async getAdminKey(logContext: string, serviceName: string): Promise<GetAdminKeyResponse> {
        const req = new GetAdminKeyRequest(logContext, serviceName);

        try {
            const jsonObj = await this.makeServiceCall("POST",
                "tools-service-admin/get-admin-key", true, true, req);

            return new GetAdminKeyResponse(jsonObj.serviceVersionStr, jsonObj.serviceIdStr,
                jsonObj.adminKey, jsonObj.adminKeyTtlStr);
        } catch (e: any) {
            if (e.code === "ECONNREFUSED")
                throw new Error("Failed because the connection was refused");
            throw new Error(e.message);
        }
    }

    public async deployService(logContext: string,
                               serviceName: string,
                               serviceFiles: ServiceFileContent[],
                               compressedServiceTypeDefinitionsStr: string,
                               permissionAssignments: PermissionAssignment[],
                               authorizeAssignments: AuthorizeAssignment[],
                               serviceClassMappings?: ServiceClassMapping[],
                               serviceId?: string,
                               lastClassId?: number): Promise<DeployServiceResponse> {
        const req = new DeployServiceRequest(logContext, serviceName, ROLI_JAVASCRIPT_LANGUAGE,
            serviceFiles, compressedServiceTypeDefinitionsStr, permissionAssignments, authorizeAssignments, serviceId,
            serviceClassMappings, lastClassId);

        try {
            let jsonObj = await this.makeServiceCall("POST",
                "tools-service-admin/deploy-service", true, true, req);
            return new DeployServiceResponse(jsonObj.serviceIdStr, jsonObj.serviceVersionStr, jsonObj.serviceClassMappings);
        } catch (e: any) {
            if (e.code === "ECONNREFUSED")
                throw new Error("Failed because the connection was refused");
            throw new Error(e.message);
        }
    }

    public async getServiceConnectionInfo(logContext: string, serviceName: string, version: bigint | null): Promise<GetServiceConnectionInfoResponse> {
        try {
            let versionOption = "";
            if (version) {
                versionOption = "&serviceVersion=" + version.toString();
            }
            let jsonObj = await this.makeServiceCall("GET",
                `tools-service-admin/get-service-connection-info/${serviceName}?logContext=${logContext}${versionOption}`,
                true, true);

            return new GetServiceConnectionInfoResponse(
                jsonObj.serviceIndexStr,
                jsonObj.serviceVersionStr,
                jsonObj.userKey,
                jsonObj.compressedServiceTypeDefinitionsStr
            );
        } catch (e: any) {
            if (e.code === "ECONNREFUSED")
                throw new Error("Failed because the connection was refused");
            throw new Error(e.message);
        }
    }

    private async makeServiceCall(method: string, path: string, expectResult: boolean, parse: boolean, body?: any): Promise<any> {

        const headers = {
            'X-roli-tools-Protocol-Version': ADMIN_TOOLS_PROTOCOL_VERSION,
            'Content-Type': 'application/json'
        };

        const isEnterprise = getIsEnterprise();

        if (isEnterprise) {
            const idToken = await getIdToken();
            // @ts-ignore
            headers.Authorization = 'Bearer ' + idToken;
        }

        const fetchInit = {
            method: method,
            credentials: isEnterprise ? 'include' : 'omit',
            headers
        }

        const baseUrl = getAdminApiUrl();
        const url = `${baseUrl}/${path}`;

        if (body) { // @ts-ignore
            fetchInit.body = JSON.stringify(body);
        }

        logVerbose('Calling Admin @ ' + url);

        // @ts-ignore
        let response = await fetch(url, fetchInit);
        if (response.status == 401) {
            await logout();
            throw new Error(logLocalError("Your credentials have expired. You must login again."));
        }

        if (parse) {
            if (!response.ok) {
                if (response.status === ROLI_SERVER_ERROR_CODE) {
                    throw parseError(await response.json());
                }
                throw new Error("Response was not OK: " + response.statusText);
            }
            if (expectResult) {
                let json = await response.json();
                if (!json)
                    throw new Error("Response didn't return anything");

                return json;
            }
        }

        return response;
    }
}

export const AdminSingleton = new Admin();