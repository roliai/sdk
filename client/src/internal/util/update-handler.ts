import {ByteBuffer} from "flatbuffers";
import {EventMessageProto} from "../protocol/event-message-proto.js";
import {requiresTruthy} from "./requires.js";
import {logError, logVerbose, sysLogError} from "./logging.js";
import {EventProto} from "../protocol/event-proto.js";
import {ServiceReferenceUnionProto} from "../protocol/service-reference-union-proto.js";
import {DataReferenceValueProto} from "../protocol/data-reference-value-proto.js";
import {EndpointReferenceValueProto} from "../protocol/endpoint-reference-value-proto.js";
import {Tracker, TrackerFactory} from "./tracker.js";
import {DataDeltaProto} from "../protocol/data-delta-proto.js";
import {DataUpdateMessageProto} from "../protocol/data-update-message-proto.js";
import {
    EventClassKey,
    EventInstanceKey,
    ServiceKey,
    DataClassKey,
    DataKey,
    EndpointClassKey,
    EndpointKey
} from "../internal-model-types.js";
import {ValueUnionProto} from "../protocol/value-union-proto.js";
import {ResponseReader, unwrapBytes} from "./serde.js";
import {DataUpdateMessageHandler, EventMessageHandler} from "../service/api-client";
import {EventRegistry} from "./registry";

export function createHandleEventMessageWithTracker(trackerFactory: TrackerFactory,
                                                      responseReader: ResponseReader,
                                                      eventRegistry: EventRegistry): EventMessageHandler {
    requiresTruthy('trackerFactory', trackerFactory);
    requiresTruthy('responseReader', responseReader);

    return async function (logContext: string, serviceKey: ServiceKey, eventMessageProto: EventMessageProto): Promise<void> {
        requiresTruthy('logContext', logContext);
        requiresTruthy('serviceKey', serviceKey);
        requiresTruthy('eventMessageProto', eventMessageProto);

        logVerbose(logContext, `Handling service event for service ${serviceKey.getFullyQualifiedName()}`);

        const eventBytesProto = eventMessageProto.event();
        if (!eventBytesProto)
            throw new Error(logError(logContext, 'Unable to handle message because it contained invalid bytes'));
        const bytesArray = eventBytesProto.bytesArray();
        if (!bytesArray)
            throw new Error(logError(logContext, 'Unable to handle message because it contained an invalid byte array'));
        const eventProto = EventProto.getRootAsEventProto(new ByteBuffer(bytesArray), new EventProto());
        const eventClassKey = new EventClassKey(serviceKey, eventProto.classId());

        let eventInstanceKey;
        if (eventProto.sourceType() == ServiceReferenceUnionProto.DataReferenceValueProto) {
            const ref = <DataReferenceValueProto>eventProto.source(new DataReferenceValueProto());
            eventInstanceKey = new EventInstanceKey(eventClassKey, new DataKey(new DataClassKey(serviceKey, ref.classId()), <string>ref.primaryKey()));
        } else if (eventProto.sourceType() == ServiceReferenceUnionProto.EndpointReferenceValueProto) {
            const ref = <EndpointReferenceValueProto>eventProto.source(new EndpointReferenceValueProto());
            eventInstanceKey = new EventInstanceKey(eventClassKey, new EndpointKey(new EndpointClassKey(serviceKey, ref.classId()), <string>ref.primaryKey()));
        } else {
            throw new Error(sysLogError("Unknown event source type."));
        }

        const event = eventRegistry.createInstance(eventClassKey);

        const tracker = trackerFactory.create(); //must use its own tracker because events are fired as near the state the server fired the event from.

        //Merge the deltas
        if (eventMessageProto.deltasLength()) {
            for (let i = 0; i < eventMessageProto.deltasLength(); ++i) {
                const deltaBytesProto = eventMessageProto.deltas(i);
                if (!deltaBytesProto)
                    throw new Error(logError(logContext, 'Unable to handle event message because a referenced service object delta contained invalid data'));
                const deltaProto = unwrapBytes(logContext, deltaBytesProto.bytesArray(), DataDeltaProto);
                responseReader.mergeDelta(logContext, serviceKey, deltaProto, tracker);
            }
        }

        //Read all the event properties
        for (let i = 0; i < eventProto.propertiesLength(); ++i) {
            const {
                name,
                valueProto
            } = responseReader.readProperty(logContext, eventClassKey, eventProto.properties(i));
            const {type, value} = responseReader.deserializeValue(logContext, serviceKey, valueProto, tracker);
            if (type == ValueUnionProto.DataReferenceValueProto) {
                tracker.dataResolutionQueue.enqueue(<DataKey>value, maybeData => {
                    Object.defineProperty(event, name, {
                        value: maybeData,
                        configurable: false,
                        enumerable: true,
                        writable: true
                    });
                });
            } else {
                Object.defineProperty(event, name, {
                    value: value,
                    configurable: false,
                    enumerable: true,
                    writable: true
                });
            }
        }

        tracker.eventFiringQueue.enqueue(eventInstanceKey, event);
        await tracker.applyOnce(logContext);
    }
}

export function handleDataUpdateMessage(logContext: string, responseReader: ResponseReader, serviceKey: ServiceKey,
                                        dataUpdateMessageProto: DataUpdateMessageProto, tracker: Tracker): void {
    requiresTruthy('logContext', logContext);
    requiresTruthy('responseReader', responseReader);
    requiresTruthy('serviceKey', serviceKey);
    requiresTruthy('dataUpdateMessageProto', dataUpdateMessageProto);
    requiresTruthy('tracker', tracker);

    for (let i = 0; i < dataUpdateMessageProto.deltasLength(); ++i) {
        const deltaBytesProto = dataUpdateMessageProto.deltas(i);
        if (!deltaBytesProto)
            throw new Error(logError(logContext, "Unable to read object update message bytes proto because it contained invalid data"));
        const bytes = deltaBytesProto.bytesArray();
        if (!bytes)
            throw new Error(logError(logContext, "Unable to read object update message bytes because it contained invalid data"));
        const delta = DataDeltaProto.getRootAsDataDeltaProto(new ByteBuffer(bytes));
        responseReader.mergeDelta(logContext, serviceKey, delta, tracker);
    }
    logVerbose(logContext, `Handled object update message containing ${dataUpdateMessageProto.deltasLength()} deltas`);
}

export function createHandleDataUpdateMessageWithTracker(trackerFactory: TrackerFactory, responseReader: ResponseReader): DataUpdateMessageHandler {
    return async function (logContext: string, serviceKey: any, objectUpdateMessageProto: any): Promise<void> {
        const tracker = trackerFactory.create();
        handleDataUpdateMessage(logContext, responseReader, serviceKey, objectUpdateMessageProto, tracker);
        await tracker.applyOnce(logContext);
    }
}