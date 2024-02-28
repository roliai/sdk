import {requiresTruthy} from "../internal/util/requires.js";
import {DataRegistry} from "../internal/util/registry.js";
import {DataKey} from "../internal/internal-model-types.js";
import {
    __Event_Tag,
    __Data_Primary_Key,
    __Endpoint_Primary_Key,
    __Endpoint_InternalClient_Key,
    __Data_Registry_Key,
    __Data_Context_Key, __Session_Primary_Key, __Session_InternalClient_Key
} from "../internal/symbol.js";
import {DataContext} from "../internal/util/context.js";
import {InternalClient} from "./client.js";

/**
 * @internal
 */
export class Session {
    [__Session_Primary_Key]: string;
    static [__Session_InternalClient_Key]: InternalClient;

    constructor(sessionId: string) {
        requiresTruthy('sessionId', sessionId);
        this[__Session_Primary_Key] = sessionId;
    }

    get sessionId(): string {
        return this[__Session_Primary_Key];
    }
}

/**
 * @internal
 */
export class Endpoint {
    [__Endpoint_Primary_Key]: string;
    static [__Endpoint_InternalClient_Key]: InternalClient;

    constructor(primaryKey: string) {
        requiresTruthy('primaryKey', primaryKey);
        this[__Endpoint_Primary_Key] = primaryKey;
    }

    get primaryKey(): string {
        return this[__Endpoint_Primary_Key];
    }
}

/**
 * When you see this on a function/method signature it means that it takes an Session derived class that you've written.
 */
export type SessionConstructor<T extends Session> = new(sessionId: string) => T;

/**
 * When you see this on a function/method signature it means that it takes an Endpoint derived class that you've written.
 */
export type EndpointConstructor<T extends Endpoint> = new(primaryKey: string) => T;

/**
 * @internal
 */
export class Event {
    [__Event_Tag]!: true;
}

/**
 * When you see this on a function/method signature it means that it takes an Event derived class that you've written.
 */
export type EventConstructor<T extends Event> = new(...any: any) => T;

/**
 * @internal
 */
export class Data {
    [__Data_Primary_Key]: string;
    static [__Data_Registry_Key]: DataRegistry | null = null;
    static [__Data_Context_Key]: DataContext | null = null;

    constructor(primaryKey: string) {
        requiresTruthy('primaryKey', primaryKey);

        if(!Data[__Data_Registry_Key])
            throw new Error("Unable to create Data instance without a DataRegistry being set");

        if(!Data[__Data_Context_Key])
            throw new Error("Unable to create Data instance without a DataContext being set");

        const classKey = Data[__Data_Registry_Key].getClassKey(this.constructor);
        Data[__Data_Context_Key].setInstance(new DataKey(classKey, primaryKey), this);
        this[__Data_Primary_Key] = primaryKey;
    }

    get primaryKey(): string {
        return this[__Data_Primary_Key];
    }
}

/**
 * When you see this on a function/method signature it means that it takes an Data derived class that you've written.
 */
export type DataConstructor<T extends Data> = new(...any: any) => T;

export type DataUpdateListener<T extends Data> = (e: DataUpdatedEvent<T>) => Promise<void> | void;

export type EventListener<T extends Event> = (msg: T) => Promise<void> | void;

export class DataUpdatedEvent<T extends Data> {
    constructor(public readonly target: T, public readonly deleted: boolean) {
    }
}