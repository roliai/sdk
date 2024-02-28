import {
    EventRegistry, TypeRegistry, EndpointRegistry, SessionRegistry
} from "../internal/util/registry.js";
import {
    createLogContext, getLogHeader,
    logError,
    logWarn,
    sysLogError
} from "../internal/util/logging.js";
import {
    friendlyArgumentRequired,
    friendlyArrayArgumentRequired,
    getErrorForNotOkResponse,
    normalizeArrayArg,
    RequestFactory,
    ResponseReader
} from "../internal/util/serde.js";
import {UserMessageUnionProto} from "../internal/protocol/user-message-union-proto.js";
import {DataUpdateMessageProto} from "../internal/protocol/data-update-message-proto.js";
import {Tracker, TrackerFactory} from "../internal/util/tracker.js";
import {
    createHandleEventMessageWithTracker,
    handleDataUpdateMessage
} from "../internal/util/update-handler.js";
import {
    Data,
    Endpoint,
    Event,
    DataConstructor,
    EndpointConstructor,
    EventConstructor,
    EventListener,
    DataUpdateListener,
    Session,
    SessionConstructor
} from "./model-types.js";
import {
    EventInstanceKey,
    EventSourceKey,
    DataKey,
    EndpointKey,
    MethodId,
    SessionKey,
    EndpointClassKey,
    SessionClassKey
} from "../internal/internal-model-types.js";
import {ServiceOptions} from "./service-options.js"
import {DataContext, EventContext, ServiceContext} from "../internal/util/context.js";
import {requiresTruthy} from "../internal/util/requires.js";
import {EventMessageProto} from "../internal/protocol/event-message-proto.js";
import {ValueProto} from "../internal/protocol/value-proto.js";
import {ValueUnionProto} from "../internal/protocol/value-union-proto.js";
import {NestedDataProto} from "../internal/protocol/nested-data-proto.js";

/**
 * @internal
 */
export class InternalClient {
    constructor(private readonly serviceContext: ServiceContext,
                private readonly endpointRegistry: EndpointRegistry,
                private readonly sessionRegistry: SessionRegistry,
                private readonly eventRegistry: EventRegistry,
                private readonly responseReader: ResponseReader,
                private readonly trackerFactory: TrackerFactory) {
        requiresTruthy('serviceContext', serviceContext);
        requiresTruthy('endpointRegistry', endpointRegistry);
        requiresTruthy('eventRegistry', eventRegistry);
        requiresTruthy('responseReader', responseReader);
        requiresTruthy('trackerFactory', trackerFactory);
    }

    private async internalCallMethod(key: EndpointKey | SessionKey, classKey: EndpointClassKey | SessionClassKey, methodId: MethodId, ...args: any): Promise<any> {
        const apiClient = await this.serviceContext.getApiClient(classKey.serviceKey);

        const logContext = createLogContext();
        const response = await apiClient.callMethod(logContext, key, methodId, args);

        if (response.consoleLog) {
            const logHeader = getLogHeader();
            for (let i = 0; i < response.consoleLog.messagesLength(); ++i) {
                const logEntry = response.consoleLog.messages(i);
                if (logEntry) {
                    if (logEntry.error()) {
                        const msg = `${logHeader}<<service://${classKey.serviceKey.getName()}>> ${logEntry.message()}`;
                        console.error(msg);
                    } else {
                        const msg = `${logHeader}<<service://${classKey.serviceKey.getName()}>> ${logEntry.message()}`;
                        console.log(msg);
                    }
                } else {
                    logWarn(logContext, "There was a service-side console log message that couldn't be read because the data was empty or invalid.")
                }
            }
        }

        if (!response.response)
            throw getErrorForNotOkResponse(logContext, response);

        let tracker;
        if (response.messages && response.messages.length > 0) {
            const eventMessages = new Array<EventMessageProto>();
            const updateMessages = new Array<DataUpdateMessageProto>();
            for (const messageUnionProto of response.messages) {
                switch (messageUnionProto.valueType()) {
                    case UserMessageUnionProto.DataUpdateMessageProto: {
                        const update = messageUnionProto.value(new DataUpdateMessageProto());
                        if (!update)
                            throw new Error(logError(logContext, 'Unable to read object update message because it was empty'));
                        updateMessages.push(update);
                        break;
                    }
                    case UserMessageUnionProto.EventMessageProto: {
                        const event = messageUnionProto.value(new EventMessageProto());
                        if (!event)
                            throw new Error(logError(logContext, "Unable to read object update message because it contained an empty event object"));
                        eventMessages.push(event);
                        break;
                    }
                    default:
                        throw new Error(logError(logContext, "Unable to read message because it contained invalid data"));
                }
            }
            //Handle events first
            for (const eventMessageProto of eventMessages) {
                //[sic] This uses its own tracker because events must be fired at consistent state.
                const func = createHandleEventMessageWithTracker(this.trackerFactory, this.responseReader, this.eventRegistry);
                await func(logContext, classKey.serviceKey, eventMessageProto);
            }
            for (const objectUpdateProto of updateMessages) {
                if (!tracker)
                    tracker = this.trackerFactory.create();
                handleDataUpdateMessage(logContext, this.responseReader, classKey.serviceKey, objectUpdateProto, tracker);
            }
        }

        if (!tracker)
            tracker = this.trackerFactory.create();

        // Get the return value
        const valueProto = response.response.returnValue(new ValueProto());
        if (!valueProto)
            throw new Error(logError(logContext, "Unable to read return value because it contained invalid data"));
        const {
            type,
            value
        } = this.responseReader.deserializeValue(logContext, classKey.serviceKey, valueProto, tracker);

        let returnValue = null;
        if (type == ValueUnionProto.DataReferenceValueProto) {
            tracker.dataResolutionQueue.enqueue(<DataKey>value, maybeData => {
                returnValue = maybeData;
            });
        } else {
            returnValue = value;
        }

        await tracker.applyOnce(logContext);

        return returnValue;
    }

    public async callSessionMethod<T extends Session>(session: T, methodId: MethodId, ...args: any): Promise<any> {
        requiresTruthy('session', session);
        requiresTruthy('methodId', methodId);

        const sessionClassKey = this.sessionRegistry.getClassKey(<SessionConstructor<T>>session.constructor);
        const sessionKey = new EndpointKey(sessionClassKey, session.sessionId);

        return await this.internalCallMethod(sessionKey, sessionClassKey, methodId, ...args);
    }

    public async callEndpointMethod<T extends Endpoint>(endpoint: T, methodId: MethodId, ...args: any): Promise<any> {
        requiresTruthy('endpoint', endpoint);
        requiresTruthy('methodId', methodId);

        const endpointClassKey = this.endpointRegistry.getClassKey(<EndpointConstructor<T>>endpoint.constructor);
        const endpointKey = new EndpointKey(endpointClassKey, endpoint.primaryKey);

        return await this.internalCallMethod(endpointKey, endpointClassKey, methodId, ...args);
    }

    public async getData(logContext: string, objectKey: DataKey, tracker: Tracker): Promise<Data | null> {
        requiresTruthy('logContext', logContext);
        requiresTruthy('objectKey', objectKey);

        const serviceKey = objectKey.classKey.serviceKey;
        const apiClient = await this.serviceContext.getApiClient(serviceKey);
        const response = await apiClient.getData(logContext, objectKey);

        if (!response.response)
            throw getErrorForNotOkResponse(logContext, response);

        let target = null;

        //Load all the service objects
        for (let i = 0; i < response.response.dataLength(); ++i) {
            const dataProto = response.response.data(i, new NestedDataProto());
            if (!dataProto)
                throw new Error(logError(logContext, "Unable to read response because a service object contained invalid data"));
            const object = this.responseReader.replaceData(logContext, serviceKey, dataProto, tracker);
            if (object && dataProto.classId() === objectKey.classKey.classId && dataProto.primaryKey() == objectKey.primaryKey) {
                target = object;
            }
        }

        if (!target) {
            logWarn(logContext, `Call to getData with ${objectKey.getFullyQualifiedName()} returned a deleted object so nothing was actually returned`);
        }

        return target;
    }
}

export class RoliClient {
    /**
     * @internal
     */
    constructor(
        private readonly serviceOptions: ServiceOptions,
        private readonly typeRegistry: TypeRegistry,
        private readonly serviceContext: ServiceContext,
        private readonly dataContext: DataContext,
        private readonly eventContext: EventContext,
        private readonly responseReader: ResponseReader,
        private readonly requestFactory: RequestFactory,
        private readonly internalClient: InternalClient,
        private readonly trackerFactory: TrackerFactory
    ) {
        requiresTruthy('serviceOptions', serviceOptions);
        requiresTruthy('typeRegistry', typeRegistry);
        requiresTruthy('serviceContext', serviceContext);
        requiresTruthy('dataContext', dataContext);
        requiresTruthy('eventContext', eventContext);
        requiresTruthy('responseReader', responseReader);
        requiresTruthy('requestFactory', requestFactory);
        requiresTruthy('internalClient', internalClient);
        requiresTruthy('trackerFactory', trackerFactory);
    }

    private maybeGetEventSourceKey<T extends Data | Endpoint>(source: T): EventSourceKey | null {
        if (source instanceof Data) {
            return this.dataContext.getDataKey(source);
        } else if (source instanceof Endpoint) {
            const classKey = this.typeRegistry.endpoint.getClassKey(source.constructor);
            return new EndpointKey(classKey, source.primaryKey);
        } else {
            return null;
        }
    }

    /**
     * (async) Retrieves an existing instance of a Data-derived class from the service and returns it.
     * @param dataType - The type of the object to get. E.g. The Player class that extends Data.
     * @param primaryKey - The primary key of the object to get.
     * @return A promise that resolves to the object instance or null if the object wasn't found.
     * @throws When a failure occurs when talking to the service.
     * */
    public async getData<T extends Data>(dataType: DataConstructor<T>, primaryKey: string): Promise<T | null> {
        friendlyArgumentRequired('dataType', dataType);
        friendlyArgumentRequired('primaryKey', primaryKey);

        const classKey = this.typeRegistry.data.getClassKey(dataType);
        const objectKey = new DataKey(classKey, primaryKey);
        const logContext = createLogContext();

        const tracker = this.trackerFactory.create();
        const object = await this.internalClient.getData(logContext, objectKey, tracker);
        await tracker.applyOnce(logContext);

        return <T><unknown>object;
    }

    /**
     * (async) Pushes one or more Data-derived instances to the service and saves them to the datastore. Their changes are broadcasted to other clients listening for changes on those objects.
     * @see subscribeUpdates
     * @see addUpdateListener
     * @param {Data[]} data - The objects to save.
     * @return {Promise<void>} A promise that resolves when the object has been saved.
     * @throws {Error} When a failure occurs when talking to the service.
     */
    public async saveData(...data: Data[]): Promise<void> {
        friendlyArrayArgumentRequired('data', data);

        const {serviceKey, objects} = this.responseReader.getDataAndKeyMap(data);

        const logContext = createLogContext();
        const apiClient = await this.serviceContext.getApiClient(serviceKey);
        const response = await apiClient.saveData(logContext, objects);

        if (!response.response)
            throw getErrorForNotOkResponse(logContext, response);

        const tracker = this.trackerFactory.create();
        if (response.messages && response.messages.length > 0) {
            for (let message of response.messages) {
                switch (message.valueType()) {
                    case UserMessageUnionProto.DataUpdateMessageProto: {
                        const update = message.value(new DataUpdateMessageProto());
                        if (!update)
                            throw new Error(logError(logContext, 'Unable to read object update message because it was empty'));
                        handleDataUpdateMessage(logContext, this.responseReader, serviceKey, update, tracker);
                        break;
                    }
                    case UserMessageUnionProto.EventMessageProto:
                        throw new Error(logError(logContext, 'Unexpectedly received Event from save data call.'));
                    default:
                        throw new Error(logError(logContext, "Unable to read event because it contained invalid data"));
                }
            }
        }
        await tracker.applyOnce(logContext);
    }

    /**
     * Closes all open service connections and removes all Event and Data listeners.
     * This doesn't prevent new connections from being made nor new Event / data listeners from being setup and used.
     * */
    public closeConnections() {
        this.serviceContext.clearApiClients();
        this.eventContext.clearAllListeners();
        this.dataContext.clearAllUpdateListeners();
    }

    /**
     * Gets a callable proxy that can be used to make calls to an endpoint instance on the Roli backend.
     * This doesn't make a network call. Endpoints are created the first time a method is called on them.
     * @param {EndpointConstructor<T extends Endpoint>} endpointType - The type of the endpoint to get. E.g. The MyEndpoint class that extends Endpoint.
     * @param {string} primaryKey - The primary key of the endpoint to get.
     * @return {<T>} A callable, strongly typed Endpoint proxy.
     * */
    public getEndpoint<T extends Endpoint>(endpointType: EndpointConstructor<T>, primaryKey: string): T {
        friendlyArgumentRequired('endpointType', endpointType);
        friendlyArgumentRequired('primaryKey', primaryKey);
        const classKey = this.typeRegistry.endpoint.getClassKey(endpointType);
        const endpointKey = new EndpointKey(classKey, primaryKey);
        return <T><unknown>this.typeRegistry.endpoint.createInstance(endpointKey);
    }

    /**
     * Removes a event listener so it is no longer handled by this client. Note: This does not unsubscribe this client from the event all together, this mearly removes the listener function handler. (note: A event subscription can have multiple listeners)
     * @param { <TS> } source - The source Data or Endpoint that was passed to the previous subscribeEvent call.
     * @param {EventConstructor<<TM>>} eventType - The type of the event to remove the listener from.
     * @param {EventListener} listener - The function instance you no longer wish to be called.
     * */
    public removeEventListener<TS extends Data | Endpoint, TM extends Event>(source: TS, eventType: EventConstructor<TM>,
                                                                               listener: EventListener<TM>) {
        friendlyArgumentRequired('source', source);
        friendlyArgumentRequired('eventType', eventType);
        friendlyArgumentRequired('listener', listener);
        const sourceKey = this.maybeGetEventSourceKey(source)
        if (!sourceKey)
            throw new Error(sysLogError("Invalid event source."));
        const eventClassKey = this.typeRegistry.event.getClassKey(eventType);
        const eventInstanceKey = new EventInstanceKey(eventClassKey, sourceKey);

        this.eventContext.removeListener(eventInstanceKey, listener);
    }

    /**
     * (async) Subscribes this client to a Event so that when a service endpoint sends it, this client receives it and calls the listener function.
     * @see unsubscribeEvent
     * @param { TS } source - The source Data or Endpoint to subscribe to.
     * @param {EventConstructor<TM>} eventType - The type of the event to subscribe to. E.g. The PlayerAdded class that extends Event.
     * @param {EventListener<TM>} listener - The function instance to be called to handle the event.
     * @return {Promise<void>} A promise that resolves when the service has subscribed this client to the event.
     * @throws {Error} When a failure occurs when talking to the service.
     * */
    public async subscribeEvent<TS extends Data | Endpoint, TM extends Event>(source: Data | Endpoint, eventType: EventConstructor<TM>,
                                                                                     listener: EventListener<TM>): Promise<void> {
        friendlyArgumentRequired('source', source);
        friendlyArgumentRequired('eventType', eventType);
        friendlyArgumentRequired('listener', listener);

        const sourceKey = this.maybeGetEventSourceKey(source);
        if (!sourceKey)
            throw new Error(sysLogError("Invalid event source."));

        const eventClassKey = this.typeRegistry.event.getClassKey(eventType);

        const eventInstanceKey = new EventInstanceKey(eventClassKey, sourceKey);

        if (this.eventContext.tryGetListeners(eventInstanceKey)) {
            this.eventContext.addListener(eventInstanceKey, listener);
            return;
        }

        const apiClient = await this.serviceContext.getApiClient(eventClassKey.serviceKey);

        const logContext = createLogContext();
        const response = await apiClient.subscribeEvent(logContext, eventInstanceKey);

        if (response.response) {
            this.eventContext.addListener(eventInstanceKey, listener);
        } else {
            throw getErrorForNotOkResponse(logContext, response);
        }
    }

    /**
     * (async) Unsubscribes this client from the Event so that it no longer handles it. This also removes all listeners.
     * @see subscribeEvent
     * @param { TS } source - The source Data or Endpoint that was passed to the previous subscribeEvent call.
     * @param {EventConstructor<TM>} eventType - The type of the event to unsubscribe from. E.g. The PlayerAdded class that extends Event.
     * @return {Promise<void>} A promise that resolves when the service has unsubscribed this client from the event.
     * @throws {Error} When a failure occurs when talking to the service.
     * */
    public async unsubscribeEvent<TS extends Data | Endpoint, TM extends Event>(source: TS, eventType: EventConstructor<TM>): Promise<void> {
        friendlyArgumentRequired('eventType', eventType);

        const sourceKey = this.maybeGetEventSourceKey(source);
        if (!sourceKey)
            throw new Error(sysLogError("Invalid event source."));

        const eventClassKey = this.typeRegistry.event.getClassKey(eventType);
        const eventInstanceKey = new EventInstanceKey(eventClassKey, sourceKey);

        const apiClient = await this.serviceContext.getApiClient(eventClassKey.serviceKey);

        const logContext = createLogContext();
        const response = await apiClient.unsubscribeEvent(logContext, eventInstanceKey);

        if (response.response) {
            this.eventContext.clearListeners(eventInstanceKey);
        } else {
            throw getErrorForNotOkResponse(logContext, response);
        }
    }

    /**
     * Removes all update listeners from one or more Data. This does not unsubscribe the objects from updates, it mearly removes all local update listener handlers.
     * @see unsubscribeUpdates
     * @see removeUpdateListener
     * @param {Data | Data[]} data - The objects to remove all update listeners.
     */
    clearUpdateListeners(data: Data | Data[]): void {
        if (data instanceof Array)
            friendlyArrayArgumentRequired('data', data);
        else
            friendlyArgumentRequired('data', data);
        const objects = normalizeArrayArg(data);
        for (const object of objects) {
            this.dataContext.clearUpdatedListeners(object);
        }
    }

    /**
     * Removes the update listener from one or more Data. This does not unsubscribe the objects from updates, it mearly removes the local update listener handler.
     * @param {Data | Data[]} data - The objects to remove the update listener from.
     * @param {DataUpdateListener} listener - The listener function to remove.
     */
    removeUpdateListener<T extends Data>(data: T | T[], listener: DataUpdateListener<T>): void {
        if (data instanceof Array)
            friendlyArrayArgumentRequired('data', data);
        else
            friendlyArgumentRequired('data', data);
        friendlyArgumentRequired('listener', listener);
        const objects = normalizeArrayArg(data);
        for (const object of objects) {
            this.dataContext.removeUpdatedListener(object, listener);
        }
    }

    /**
     * Adds an update listener to one or more Data so that when an update is received the listener is called. This does not subscribe the objects to updates.
     * @see subscribeUpdates
     * @param {Data | Data[]} data - The objects to add the listener to.
     * @param {DataUpdateListener} listener - The listener function to add.
     * */
    addUpdateListener<T extends Data>(data: T | T[], listener: DataUpdateListener<T>) {
        if (data instanceof Array)
            friendlyArrayArgumentRequired('data', data);
        else
            friendlyArgumentRequired('data', data);
        friendlyArgumentRequired('listener', listener);
        const objects = normalizeArrayArg(data);
        for (const object of objects) {
            this.dataContext.addUpdatedListener(object, listener);
        }
    }

    /**
     * (async) Subscribes one or more Data instances to updates so that when other clients (or endpoints) make changes to them, the changes are sent to this client so the objects are kept up to date automatically.
     * @see addUpdateListener
     * @param {Data | Data[]} data - The objects to subscribe. E.g. An instance of the Player class that extends Data.
     * @return {Promise<void>} A promise that resolves when the service has subscribed this client to object updates made to the objects in question.
     * @throws {Error} When a failure occurs when talking to the service.
     * */
    async subscribeUpdates(data: Data | Data[]): Promise<void> {
        if (data instanceof Array)
            friendlyArrayArgumentRequired('data', data);
        else
            friendlyArgumentRequired('data', data);

        const {serviceKey, dataKeys} = this.responseReader.getDataAndKeys(data);

        const apiClient = await this.serviceContext.getApiClient(serviceKey);
        const logContext = createLogContext();
        const response = await apiClient.subscribeDataUpdates(logContext, dataKeys);

        if (!response.response) {
            throw getErrorForNotOkResponse(logContext, response);
        }
    }

    /**
     * (async) Unsubscribes one or more Data instances from updates so they no longer receive changes made by other clients (or endpoints).
     * @see subscribeUpdates
     * @param {Data | Data[]} data - The objects to unsubscribe. E.g. An instance of the Player class that extends Data.
     * @return {Promise<void>} A promise that resolves when the service has unsubscribed this client from object updates made to the objects in question.
     * @throws {Error} When a failure occurs when talking to the service.
     * */
    async unsubscribeUpdates(data: Data | Data[]): Promise<void> {
        if (data instanceof Array)
            friendlyArrayArgumentRequired('data', data);
        else
            friendlyArgumentRequired('data', data);

        const {serviceKey, dataKeys} = this.responseReader.getDataAndKeys(data);

        const apiClient = await this.serviceContext.getApiClient(serviceKey);

        const logContext = createLogContext();
        const response = await apiClient.unsubscribeDataUpdates(logContext, dataKeys);

        if (!response.response) {
            throw getErrorForNotOkResponse(logContext, response);
        }
    }

}