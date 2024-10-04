
// Note: this must match RoliEnvironment in roli/framework/public/client/src/internal/util/registry.ts
export interface RoliEnvironment {
    clientChecksum: number;
    apiBaseUrl: string;
    serviceName: string;
    userKey: string;
    serviceIdString: string;
    serviceVersionString: string;
}