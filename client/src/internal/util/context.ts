import {DataKey, KeyMap, EventInstanceKey, ServiceKey} from "../internal-model-types.js";
import {Data, DataUpdateListener, Event, EventListener} from "../../public/model-types.js";
import {requiresPositiveBigInt, requiresTruthy} from "./requires.js";
import {sysLogError, sysLogVerbose} from "./logging.js";
import {createRef, RefShim} from "./ref.js";
import {ApiClientFactory, ApiClient} from "../service/api-client.js";
import {EventRegistry, ServiceRegistry} from "./registry.js";
import {
    createHandleDataUpdateMessageWithTracker, createHandleEventMessageWithTracker
} from "./update-handler.js";
import {TrackerFactory} from "./tracker.js";
import {ResponseReader} from "./serde.js";
import { createUuid } from "../../public/uuid.js";
type AnyDataUpdateListener = (e: any) => Promise<void> | void;
type AnyEventListener = (msg: Event) => Promise<void> | void;
export class ServiceContext {
    private readonly _serviceKeyToApiClient = new KeyMap<ServiceKey, ApiClient>();
    private _accessToken: string | null = null;

    constructor(private readonly serviceRegistry: ServiceRegistry,
                private readonly eventRegistry: EventRegistry,
                private readonly apiClientFactory: ApiClientFactory,
                private readonly trackerFactory: TrackerFactory,
                private readonly responseReader: ResponseReader) {
        requiresTruthy('serviceRegistry', serviceRegistry);
        requiresTruthy('eventRegistry', eventRegistry);
        requiresTruthy('apiClientFactory', apiClientFactory);
        requiresTruthy('trackerFactory', trackerFactory);
        requiresTruthy('responseReader', responseReader);
    }

    public setAccessToken(token: string | null) {
        if(this._accessToken !== token) {
            this._accessToken = token;
            this.clearApiClients();
        }
    }

    public setApiClient(serviceKey: ServiceKey, apiClient: ApiClient) {
        requiresTruthy('serviceKey', serviceKey);
        requiresTruthy('apiClient', apiClient);

        if (!this.serviceRegistry.isRegistered(serviceKey))
            throw new Error(`Service ${serviceKey.value} is not registered`);

        this._serviceKeyToApiClient.set(serviceKey, apiClient);
    }

    public tryGetApiClient(serviceKey: ServiceKey): ApiClient | null {
        requiresTruthy('serviceKey', serviceKey);

        if (!this.serviceRegistry.isRegistered(serviceKey))
            throw new Error(`Service ${serviceKey.value} is not registered`);

        return this._serviceKeyToApiClient.tryGet(serviceKey);
    }

    public clearApiClients() {
        for (const apiClient of this._serviceKeyToApiClient.values()) {
            apiClient.shutdown();
        }
        this._serviceKeyToApiClient.clear();
    }

    public async getApiClient(serviceKey: ServiceKey): Promise<ApiClient> {
        let apiClient = this.tryGetApiClient(serviceKey);
        if (apiClient)
            return apiClient;

        let [authKey, admin] = this.serviceRegistry.getAuth(serviceKey);

        try {
            apiClient = await this.apiClientFactory.create(serviceKey, admin, authKey, this._accessToken,
                createHandleDataUpdateMessageWithTracker(this.trackerFactory, this.responseReader),
                createHandleEventMessageWithTracker(this.trackerFactory, this.responseReader, this.eventRegistry));
        } catch (reason) {
            throw new Error(sysLogError(`Unable to open connection to Roli. Reason: ${JSON.stringify(reason)}`));
        }

        this.setApiClient(serviceKey, apiClient);
        return apiClient;
    }
}

/**
 * Stores Data instances using WeakRef (when available) in memory only. This is a conservative approach that lets instances be reclaimed
 * by the GC when the service developer chooses. I.e. if a client lets go of the Data instance, it should be reclaimed by
 * the JavaScript engine when its GC next completes its cycle.
 */
export class DataContext {
    private readonly _dataKeyToDataRef: KeyMap<DataKey, RefShim<Data>> = new KeyMap<DataKey, RefShim<Data>>();
    private readonly _weakDataToVersion: WeakMap<Data, bigint> = new WeakMap<Data, bigint>();
    private readonly _weakDataToDataKey: WeakMap<Data, DataKey> = new WeakMap<Data, DataKey>();
    private _weakDataToUpdatedListeners: WeakMap<Data, Array<AnyDataUpdateListener>> = new WeakMap<Data, Array<AnyDataUpdateListener>>();
    // synthetic ID used to troubleshoot object versioning problems
    private readonly _id = createUuid(false);

    constructor() {
        sysLogVerbose(`DataContext created: ${this._id}`);
    }

    public tryGetVersion(data: Data): bigint | undefined {
        return this._weakDataToVersion.get(data);
    }

    public setVersion(data: Data, version: bigint) {
        requiresTruthy('data', data);
        requiresPositiveBigInt('version', version);
        this._weakDataToVersion.set(data, version);
    }

    public setInstance(dataKey: DataKey, data: Data) {
        requiresTruthy('dataKey', dataKey);
        requiresTruthy('data', data);
        const existingRef = this._dataKeyToDataRef.tryGet(dataKey);
        if (existingRef && existingRef.deref())
            throw new Error(sysLogError(`The object ${dataKey.getFullyQualifiedName()} already exists. 
            Call E.g. getData(${dataKey.classKey.getName()}, "${dataKey.primaryKey}") to retrieve it.`));
        this._weakDataToDataKey.set(data, dataKey);
        this._dataKeyToDataRef.set(dataKey, createRef<Data>(data));
    }

    public getDataKey(data: Data): DataKey {
        const objectKey = this._weakDataToDataKey.get(data);
        if (!objectKey)
            throw new Error(sysLogError('Could not find object key for service object when it was expected to exist.'));
        return objectKey;
    }

    public tryGetInstance(dataKey: DataKey): Data | null {
        requiresTruthy('dataKey', dataKey);
        const ref = this._dataKeyToDataRef.tryGet(dataKey);
        if (!ref) {
            return null;
        }
        const target = ref.deref();
        if (!target) {
            return null;
        }
        return target;
    }

    public addUpdatedListener<T extends Data>(data: T, listener: DataUpdateListener<T>) {
        requiresTruthy('data', data);
        requiresTruthy('listener', listener);
        let listeners = this._weakDataToUpdatedListeners.get(data);
        if (!listeners) {
            this._weakDataToUpdatedListeners.set(data, listeners = []);
        }
        listeners.push(listener);
    }

    public removeUpdatedListener<T extends Data>(data: T, listener: DataUpdateListener<T>) {
        requiresTruthy('data', data);
        requiresTruthy('listener', listener);
        let listeners = this._weakDataToUpdatedListeners.get(data);
        if (!listeners)
            return;
        const i = listeners.indexOf(listener);
        if (i > -1) {
            listeners.splice(i, 1);
        }
    }

    public tryGetUpdatedListeners<T extends Data>(data: T): DataUpdateListener<T>[] | undefined {
        return this._weakDataToUpdatedListeners.get(data);
    }

    public clearUpdatedListeners(data: Data) {
        requiresTruthy('data', data);
        this._weakDataToUpdatedListeners.delete(data);
    }

    public clearAllUpdateListeners() {
        this._weakDataToUpdatedListeners = new WeakMap<Data, Array<AnyDataUpdateListener>>();
    }

    public remove(dataKey: DataKey) {
        const ref = this._dataKeyToDataRef.tryGet(dataKey);
        let object;
        if (ref)
            object = ref.deref();
        if (object) {
            //if they're weak, why manually remove them here?
            //because WeakMaps are pseudo-weak and I think it's better to just clean them up deterministically.
            this._weakDataToVersion.delete(object);
            this._weakDataToDataKey.delete(object);
            this._weakDataToUpdatedListeners.delete(object);
        }
        this._dataKeyToDataRef.delete(dataKey);
    }
}
export class EventContext {
    private _instanceKeyToListeners = new KeyMap<EventInstanceKey, Array<AnyEventListener>>();

    public addListener<T extends Event>(eventInstanceKey: EventInstanceKey, listener: EventListener<T>) {
        requiresTruthy('eventInstanceKey', eventInstanceKey);
        requiresTruthy('listener', listener);
        let listeners = this._instanceKeyToListeners.tryGet(eventInstanceKey);
        if (!listeners) {
            this._instanceKeyToListeners.set(eventInstanceKey, listeners = []);
        }
        // @ts-ignore
        listeners.push(listener);
    }

    public removeListener<T extends Event>(eventInstanceKey: EventInstanceKey, listener: EventListener<T>) {
        requiresTruthy('eventInstanceKey', eventInstanceKey);
        requiresTruthy('listener', listener);
        let listeners = this._instanceKeyToListeners.tryGet(eventInstanceKey);
        if (!listeners)
            return;
        // @ts-ignore
        const i = listeners.indexOf(listener);
        if (i > -1) {
            listeners.splice(i, 1);
        }
    }

    public tryGetListeners(eventInstanceKey: EventInstanceKey): AnyEventListener[] | null {
        return this._instanceKeyToListeners.tryGet(eventInstanceKey);
    }

    public clearListeners(eventInstanceKey: EventInstanceKey) {
        requiresTruthy('eventInstanceKey', eventInstanceKey);
        this._instanceKeyToListeners.delete(eventInstanceKey);
    }

    public clearAllListeners() {
        this._instanceKeyToListeners.clear();
    }
}