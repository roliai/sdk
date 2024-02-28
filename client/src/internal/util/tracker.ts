import {requiresAtLeastOneElement, requiresTruthy} from "./requires.js";
import {logVerbose} from "./logging.js";
import {Event, Data, DataUpdatedEvent} from "../../public/model-types.js";
import {EventInstanceKey, DataKey} from "../internal-model-types.js";
import {DataContext, EventContext} from "./context.js";
import {InternalClient} from "../../public/client.js";

class DataUpdatedFiringQueue {
    private _queue: { object: Data, deleted: boolean } [];

    constructor() {
        this._queue = [];
    }

    public enqueue(object: Data, deleted: boolean): void {
        requiresTruthy('object', object);
        this._queue.push({object: object, deleted: deleted});
    }

    public async applyOnce(logContext: string, dataContext: DataContext) {
        requiresTruthy('dataContext', dataContext);
        for (const {object, deleted} of this._queue) {
            const listeners = dataContext.tryGetUpdatedListeners(object);
            if (listeners) {
                const objectKey = dataContext.getDataKey(object);
                for (const listener of listeners) {
                    const ret = listener(new DataUpdatedEvent(object, deleted));
                    if (ret instanceof Promise)
                        await ret;
                }
                logVerbose(logContext, `Object update to ${objectKey.getFullyQualifiedName()} handled by ${listeners.length} listeners`);
            }
        }
        this._queue = [];
    }
}

class DataDeleteQueue {
    private _queue: DataKey[];

    constructor() {
        this._queue = [];
    }

    public enqueue(objectKey: DataKey): void {
        requiresTruthy('objectKey', objectKey);
        this._queue.push(objectKey);
    }

    public applyOnce(logContext: string, dataContext: DataContext) {
        requiresTruthy('logContext', logContext);
        this._queue.forEach(objectKey => {
            dataContext.remove(objectKey);
            logVerbose(logContext, `Object ${objectKey.getFullyQualifiedName()} deleted`)
        });
        this._queue = [];
    }
}

class EventFiringQueue {
    private _queue: { event: Event, instanceKey: EventInstanceKey }[];

    constructor() {
        this._queue = [];
    }

    public enqueue(instanceKey: EventInstanceKey, event: Event): void {
        requiresTruthy('instanceKey', instanceKey);
        requiresTruthy('event', event);
        this._queue.push({event: event, instanceKey: instanceKey});
    }

    public async applyOnce(logContext: string, eventContext: EventContext) {
        requiresTruthy('logContext', logContext);
        for (const value of this._queue) {
            const {event, instanceKey} = value;
            const listeners = eventContext.tryGetListeners(instanceKey);
            if (listeners) {
                for (const listener of listeners) {
                    const ret = listener(event);
                    if (ret instanceof Promise) {
                        await ret;
                    }
                }
                logVerbose(logContext, `Event ${instanceKey.getFullyQualifiedName()} handled by ${listeners.length} listeners`);
            }
        }
        this._queue = [];
    }
}

export type MaybeMultiDataResolved = (dataMap: Map<DataKey, Data | null>) => void;
export type MaybeSingleDataResolved = (maybeData: Data | null) => void;

class SingleResolutionItem {
    public single: boolean = true;

    constructor(
        public key: DataKey,
        public maybeResolved: MaybeSingleDataResolved | null) {
        requiresTruthy('key', key);
    }
}

class MultiResolutionItem {
    public single: boolean = false;
    constructor(public keys: DataKey[],
                public maybeResolved: MaybeMultiDataResolved | null) {
        requiresAtLeastOneElement('keys', keys);
    }
}

type ResolutionItem = SingleResolutionItem | MultiResolutionItem;

class DataResolutionQueue {
    private _queue: ResolutionItem [];

    constructor() {
        this._queue = [];
    }

    public enqueueMultiple<T extends Data>(objectKeys: DataKey[], maybeResolved: MaybeMultiDataResolved | null): void {
        this._queue.push(new MultiResolutionItem(objectKeys, maybeResolved));
    }

    public enqueue<T extends Data>(objectKey: DataKey, maybeResolved: MaybeSingleDataResolved | null): void {
        this._queue.push(new SingleResolutionItem(objectKey, maybeResolved));
    }

    public async applyOnce(logContext: string, tracker: Tracker, dataContext: DataContext, internalServiceClient: InternalClient) {
        requiresTruthy('logContext', logContext);
        while (this._queue.length > 0) {
            const queue = this._queue.slice();
            this._queue = [];
            for (const item of queue) {
                if (item.single) {
                    const item_ = item as SingleResolutionItem;
                    let value = dataContext.tryGetInstance(item_.key);
                    if (!value) {
                        value = await internalServiceClient.getData(logContext, item_.key, tracker);
                    }
                    if (item_.maybeResolved)
                        item_.maybeResolved(value);
                } else {
                    const item_ = item as MultiResolutionItem;
                    let keysAndValues = new Map<DataKey, Data | null>();
                    for (let objectKey of item_.keys) {
                        let value = dataContext.tryGetInstance(objectKey);
                        if (!value) {
                            value = await internalServiceClient.getData(logContext, objectKey, tracker);
                        }
                        keysAndValues.set(objectKey, value);
                    }
                    if (item_.maybeResolved)
                        item_.maybeResolved(keysAndValues);
                }
            }
        }
    }
}

export class TrackerFactory {
    private _internalClient: InternalClient | null;
    private readonly _dataContext: DataContext;
    private readonly _eventContext: EventContext;

    constructor(dataContext: DataContext, eventContext: EventContext) {
        this._dataContext = dataContext;
        this._eventContext = eventContext;
        this._internalClient = null;
    }

    set internalClient(value: InternalClient) {
        requiresTruthy('value', value);
        this._internalClient = value;
    }

    create(): Tracker {
        if (!this._internalClient)
            throw new Error("attempted to create Tracker before internalServiceClient was set");
        return new Tracker(this._internalClient!, this._dataContext, this._eventContext);
    }
}

export class Tracker {
    public dataResolutionQueue: DataResolutionQueue;
    public eventFiringQueue: EventFiringQueue;
    public dataDeleteQueue: DataDeleteQueue;
    public dataUpdatedFiringQueue: DataUpdatedFiringQueue;
    private readonly _internalServiceClient: InternalClient;
    private readonly _dataContext: DataContext;
    private readonly _eventContext: EventContext;

    constructor(internalServiceClient: InternalClient, dataContext: DataContext, eventContext: EventContext) {
        this._internalServiceClient = internalServiceClient;
        this._dataContext = dataContext;
        this._eventContext = eventContext;
        this.dataResolutionQueue = new DataResolutionQueue();
        this.eventFiringQueue = new EventFiringQueue();
        this.dataDeleteQueue = new DataDeleteQueue();
        this.dataUpdatedFiringQueue = new DataUpdatedFiringQueue();
    }

    async applyOnce(logContext: string) {
        //Resolve all objects
        await this.dataResolutionQueue.applyOnce(logContext, this, this._dataContext, this._internalServiceClient);
        //Fire all Event handlers
        await this.eventFiringQueue.applyOnce(logContext, this._eventContext);
        //Fire all the DataUpdated handlers
        await this.dataUpdatedFiringQueue.applyOnce(logContext, this._dataContext);
        //Deletes all the objects that need to be deleted.
        this.dataDeleteQueue.applyOnce(logContext, this._dataContext);
    }
}