import {Builder, ByteBuffer, Offset} from "flatbuffers";

import {requiresAtLeastOneElement, requiresPositiveUnsigned, requiresTruthy} from "./requires.js";
import {DataRegistry, EndpointRegistry, SessionRegistry} from "./registry.js";
import {Unsigned, UnsignedOne, UnsignedZero} from "./unsigned.js";
import {getEnableVerboseLogging, logError, logVerbose, sysLogError} from "./logging.js";
import {getCodeName, Code} from "../code.js";
import {DataProto} from "../protocol/data-proto.js";
import {ErrorCodeResponseProto} from "../protocol/error-code-response-proto.js";
import {NumberValueProto} from "../protocol/number-value-proto.js";
import {UndefinedValueProto} from "../protocol/undefined-value-proto.js";
import {ApiUserResponseProto} from "../protocol/api-user-response-proto.js";
import {StringValueProto} from "../protocol/string-value-proto.js";
import {NestedDataProto} from "../protocol/nested-data-proto.js";
import {BooleanValueProto} from "../protocol/boolean-value-proto.js";
import {ObjectValueProto} from "../protocol/object-value-proto.js";
import {ArrayValueProto} from "../protocol/array-value-proto.js";
import {NullValueProto} from "../protocol/null-value-proto.js";
import {SaveDataRequestProto} from "../protocol/save-data-request-proto.js";
import {CallMethodRequestProto} from "../protocol/call-method-request-proto.js";
import {UserRequestProto} from "../protocol/user-request-proto.js";
import {MapValueProto} from "../protocol/map-value-proto.js";
import {UnsubscribeEventRequestProto} from "../protocol/unsubscribe-event-request-proto.js";
import {UserMessageUnionWrapperProto} from "../protocol/user-message-union-wrapper-proto.js";
import {DataDeltaProto} from "../protocol/data-delta-proto.js";
import {UserRequestUnionProto} from "../protocol/user-request-union-proto.js";
import {ValueProto} from "../protocol/value-proto.js";
import {UnsubscribeDataUpdatesRequestProto} from "../protocol/unsubscribe-data-updates-request-proto.js";
import {UserResponseUnionWrapperProto} from "../protocol/user-response-union-wrapper-proto.js";
import {ExceptionResponseProto} from "../protocol/exception-response-proto.js";
import {UserResponseUnionProto} from "../protocol/user-response-union-proto.js";
import {SetValueProto} from "../protocol/set-value-proto.js";
import {SubscribeEventRequestProto} from "../protocol/subscribe-event-request-proto.js";
import {InboundDataDeltaProto} from "../protocol/inbound-data-delta-proto.js";
import {NestedPropertyProto} from "../protocol/nested-property-proto.js";
import {SubscribeDataUpdatesRequestProto} from "../protocol/subscribe-data-updates-request-proto.js";
import {MapValueItemProto} from "../protocol/map-value-item-proto.js";
import {DateValueProto} from "../protocol/date-value-proto.js";
import {ValueUnionProto} from "../protocol/value-union-proto.js";
import {EndpointReferenceValueProto} from "../protocol/endpoint-reference-value-proto.js";
import {SessionReferenceValueProto} from "../protocol/session-reference-value-proto.js";
import {ArrayItemValueProto} from "../protocol/array-item-value-proto.js";
import {ConsoleLogProto} from "../protocol/console-log-proto.js";
import {PropertyProto} from "../protocol/property-proto.js";
import {GetDataRequestProto} from "../protocol/get-data-request-proto.js";
import {DataReferenceValueProto} from "../protocol/data-reference-value-proto.js";
import {ServiceReferenceUnionProto} from "../protocol/service-reference-union-proto.js";
import {Tracker} from "./tracker.js";
import {Event, Data, Endpoint, Session} from "../../public/model-types.js";
import {
    IKey,
    KeyMap,
    KeySet,
    MethodId,
    OkResponseType,
    PlatformException,
    ScriptException,
    UserResponse,
    EventInstanceKey,
    ServiceKey,
    DataClassKey,
    DataKey,
    EndpointClassKey,
    EndpointKey, 
    SessionKey, 
    SessionClassKey
} from "../internal-model-types.js";
import {
    ScriptError,
    PlatformError
} from "../../public/error.js";
import {API_PROTOCOL_VERSION} from "../config.js";
import {DataContext} from "./context.js";

interface TypeInfo {
    unwrap: boolean,
    type: ValueUnionProto
}

function getValueType(arg: any): TypeInfo {
    if (arg === null)
        return {unwrap: false, type: ValueUnionProto.NullValueProto};

    const notSupported = (s: string) => {
        return `Cannot pass a ${s} as an argument because the type isn't supported.`
    };
    const type = typeof arg;
    switch (type) {
        case "undefined":
            return {unwrap: false, type: ValueUnionProto.UndefinedValueProto};
        case "boolean":
            return {unwrap: false, type: ValueUnionProto.BooleanValueProto};
        case "number":
            return {unwrap: false, type: ValueUnionProto.NumberValueProto};
        case "string":
            return {unwrap: false, type: ValueUnionProto.StringValueProto};
        case "object": {
            if (arg instanceof Date)
                return {unwrap: false, type: ValueUnionProto.DateValueProto};
            if (arg instanceof Data)
                return {unwrap: false, type: ValueUnionProto.DataReferenceValueProto};
            if (arg instanceof Endpoint)
                return {unwrap: false, type: ValueUnionProto.EndpointReferenceValueProto};
            if (arg instanceof Session)
                return {unwrap: false, type: ValueUnionProto.SessionReferenceValueProto};
            if (arg instanceof Event)
                throw new Error(notSupported("Event"));
            if (arg instanceof Array)
                return {unwrap: false, type: ValueUnionProto.ArrayValueProto};
            if (arg instanceof Map)
                return {unwrap: false, type: ValueUnionProto.MapValueProto};
            if (arg instanceof Set)
                return {unwrap: false, type: ValueUnionProto.SetValueProto};
            if (arg instanceof String)
                return {unwrap: true, type: ValueUnionProto.StringValueProto};
            if (arg instanceof Number)
                return {unwrap: true, type: ValueUnionProto.NumberValueProto};
            if (arg instanceof Boolean)
                return {unwrap: true, type: ValueUnionProto.BooleanValueProto};
            return {unwrap: false, type: ValueUnionProto.ObjectValueProto};
        }
        default:
            throw new Error(notSupported(type));
    }
}

class DataTransferQueue {
    private _queue: Data[] = [];
    private _serviceKey: ServiceKey | undefined;
    private _keys = new KeySet<DataKey>();
    private readonly _dataRegistry: DataRegistry;

    /*Pass in a ServiceKey to make sure all further objects have the same one.*/
    constructor(dataRegistry: DataRegistry, serviceKey?: ServiceKey) {
        requiresTruthy('dataRegistry', dataRegistry);
        this._dataRegistry = dataRegistry;
        this._serviceKey = serviceKey;
    }

    get serviceKey(): ServiceKey | undefined {
        return this._serviceKey;
    }

    get length() {
        return this._queue.length;
    }

    pop(): Data {
        const item = this._queue.shift();
        if (!item)
            throw new Error('no items found');
        return item;
    }

    tryAdd(data: Data): DataKey | undefined {
        const classKey = this._dataRegistry.getClassKey(data.constructor);
        const objectKey = new DataKey(classKey, data.primaryKey);
        if (this._keys.add(objectKey)) {
            if (this._serviceKey) {
                if (!this._serviceKey.equals(classKey.serviceKey))
                    throw new Error(`Unable to transfer objects from different services. ${classKey.serviceKey.value} is different than ${this._serviceKey.value}`);
            } else {
                this._serviceKey = classKey.serviceKey;
            }

            this._queue.push(data);
            return objectKey;
        }
        return undefined;
    }
}

const CALL_METHOD_REQUEST_BUFFER_SIZE = 10 * 1024;
const GET_DATA_REQUEST_BUFFER_SIZE = 100;
const SAVE_DATA_REQUEST_BUFFER_SIZE = 10 * 1024;
const CREATE_SUBSCRIBE_EVENT_REQUEST_BUFFER_SIZE = 100;
const CREATE_UNSUBSCRIBE_EVENT_REQUEST_BUFFER_SIZE = 100;
const CREATE_SUBSCRIBE_DATA_UPDATES_REQUEST_BUFFER_SIZE = 1024;
const CREATE_UNSUBSCRIBE_DATA_UPDATES_REQUEST_BUFFER_SIZE = 1024;

type CreateInnerFunction = (builder: Builder) => Offset;

export class RequestFactory {
    constructor(private readonly dataRegistry: DataRegistry,
                private readonly endpointRegistry: EndpointRegistry,
                private readonly sessionRegistry: SessionRegistry,
                private readonly dataContext: DataContext) {
        requiresTruthy('dataRegistry', dataRegistry);
        requiresTruthy('endpointRegistry', endpointRegistry);
        requiresTruthy('sessionRegistry', sessionRegistry);
        requiresTruthy('dataContext', dataContext);
    }

    private createInboundDataDelta(builder: Builder, data: Data, transferQueue: DataTransferQueue): Offset {
        const classKey = this.dataRegistry.getClassKey(data.constructor);

        // BUG: Deleted Properties won't be sent to the server as deleted properties.

        let objectVersion = this.dataContext.tryGetVersion(data);
        if (!objectVersion) {
            objectVersion = UnsignedZero;
        }

        //note: since the client can't know what properties have changed, I send all of them and let the server figure it out.

        const properties: Offset[] = [];
        const valueBuilder = new Builder();
        for (const name of Object.getOwnPropertyNames(data)) {
            // @ts-ignore
            const value = data[name];
            const nameOff = builder.createString(name);
            valueBuilder.clear();

            valueBuilder.finish(this.serializeValue(valueBuilder, value, transferQueue));
            const valueBytesOff = NestedPropertyProto.createValueBytesVector(builder, valueBuilder.asUint8Array());
            NestedPropertyProto.startNestedPropertyProto(builder);
            NestedPropertyProto.addName(builder, nameOff);
            NestedPropertyProto.addValueBytes(builder, valueBytesOff);
            properties.push(NestedPropertyProto.endNestedPropertyProto(builder));
        }

        const properties_off = DataProto.createPropertiesVector(builder, properties);

        return InboundDataDeltaProto.createInboundDataDeltaProto(builder, classKey.classId, objectVersion.toLong(),
            builder.createString(data.primaryKey), properties_off, 0);
    }

    private serializeValue(builder: Builder,
                   arg: any,
                   transferQueue: DataTransferQueue): Offset {
        const {unwrap, type} = getValueType(arg);
        switch (type) {
            case ValueUnionProto.UndefinedValueProto: {
                return ValueProto.createValueProto(builder, type, UndefinedValueProto.createUndefinedValueProto(builder));
            }
            case ValueUnionProto.NullValueProto: {
                return ValueProto.createValueProto(builder, type, NullValueProto.createNullValueProto(builder));
            }
            case ValueUnionProto.BooleanValueProto: {
                if (unwrap)
                    arg = (<Boolean>arg).valueOf();
                return ValueProto.createValueProto(builder, type, BooleanValueProto.createBooleanValueProto(builder, <boolean>arg));
            }
            case ValueUnionProto.StringValueProto: {
                if (unwrap)
                    arg = (<String>arg).valueOf();
                return ValueProto.createValueProto(builder, type, StringValueProto.createStringValueProto(builder, builder.createString(<string>arg)));
            }
            case ValueUnionProto.NumberValueProto: {
                if (unwrap)
                    arg = (<Number>arg).valueOf();
                return ValueProto.createValueProto(builder, type, NumberValueProto.createNumberValueProto(builder, <number>arg));
            }
            case ValueUnionProto.ObjectValueProto: {
                const properties = [];
                for (const name of Object.getOwnPropertyNames(arg)) {
                    const nameOff = builder.createString(name);
                    const argOff = this.serializeValue(builder, arg[name], transferQueue);
                    PropertyProto.startPropertyProto(builder);
                    PropertyProto.addName(builder, nameOff);
                    PropertyProto.addValue(builder, argOff);
                    const prop_off = PropertyProto.endPropertyProto(builder);
                    properties.push(prop_off);
                }
                const properties_off = ObjectValueProto.createPropertiesVector(builder, properties);
                return ValueProto.createValueProto(builder, type, ObjectValueProto.createObjectValueProto(builder, properties_off));
            }
            case ValueUnionProto.ArrayValueProto: {
                const items = [];
                let i = 0;
                for (const value of arg) {
                    const valueOff = this.serializeValue(builder, value, transferQueue);
                    ArrayItemValueProto.startArrayItemValueProto(builder);
                    ArrayItemValueProto.addIndex(builder, i++);
                    ArrayItemValueProto.addValue(builder, valueOff);
                    items.push(ArrayItemValueProto.endArrayItemValueProto(builder));
                }
                const items_off = ArrayValueProto.createItemsVector(builder, items);
                return ValueProto.createValueProto(builder, type, ArrayValueProto.createArrayValueProto(builder, items_off));
            }
            case ValueUnionProto.DataReferenceValueProto: {
                const data = <Data>arg;
                const classKey = this.dataRegistry.getClassKey(data.constructor);
                transferQueue.tryAdd(data);
                console.log(`Data pk = ${data.primaryKey} ClassKey: ${classKey.getFullyQualifiedName()}`);
                const primaryKeyOff = builder.createString(data.primaryKey);
                return ValueProto.createValueProto(builder, ValueUnionProto.DataReferenceValueProto,
                    DataReferenceValueProto.createDataReferenceValueProto(builder, classKey.classId, primaryKeyOff));
            }
            case ValueUnionProto.SessionReferenceValueProto: {
                const session = <Session>arg;
                const classKey = this.sessionRegistry.getClassKey(session.constructor);
                const sessionIdOff = builder.createString(session.sessionId);
                return ValueProto.createValueProto(builder, ValueUnionProto.SessionReferenceValueProto,
                    SessionReferenceValueProto.createSessionReferenceValueProto(builder, classKey.classId, sessionIdOff));
            }
            case ValueUnionProto.EndpointReferenceValueProto: {
                const endpoint = <Endpoint>arg;
                const classKey = this.endpointRegistry.getClassKey(endpoint.constructor);
                const primaryKeyOff = builder.createString(endpoint.primaryKey);
                return ValueProto.createValueProto(builder, ValueUnionProto.EndpointReferenceValueProto,
                    EndpointReferenceValueProto.createEndpointReferenceValueProto(builder, classKey.classId, primaryKeyOff));
            }
            case ValueUnionProto.MapValueProto: {
                const mapArg = <Map<any, any>>arg;
                const items: Offset[] = [];
                for (const [key, value] of mapArg.entries()) {
                    const keyOff = this.serializeValue(builder, key, transferQueue);
                    const valueOff = this.serializeValue(builder, value, transferQueue);
                    MapValueItemProto.startMapValueItemProto(builder);
                    MapValueItemProto.addKey(builder, keyOff);
                    MapValueItemProto.addValue(builder, valueOff);
                    items.push(MapValueItemProto.endMapValueItemProto(builder));
                }
                const itemsOff = MapValueProto.createItemsVector(builder, items);
                return ValueProto.createValueProto(builder, ValueUnionProto.MapValueProto, MapValueProto.createMapValueProto(builder, itemsOff));
            }
            case ValueUnionProto.SetValueProto: {
                const setArg = <Set<any>>arg;
                const values: Offset[] = [];
                setArg.forEach((item) => {
                    values.push(this.serializeValue(builder, item, transferQueue));
                })
                const valuesOff = SetValueProto.createItemsVector(builder, values);
                return ValueProto.createValueProto(builder, ValueUnionProto.SetValueProto, SetValueProto.createSetValueProto(builder, valuesOff));
            }
            case ValueUnionProto.DateValueProto: {
                const date = <Date>arg;
                return ValueProto.createValueProto(builder, ValueUnionProto.DateValueProto, DateValueProto.createDateValueProto(builder, date.valueOf()));
            }
            default:
                throw new Error("Unexpected argument type");
        }
    }

    private createRequest(b: Builder | number, logContext: string, serviceId: Unsigned, serviceVersion: Unsigned, kind: UserRequestUnionProto, createInner: CreateInnerFunction): Uint8Array {
        requiresTruthy('logContext', logContext);
        requiresPositiveUnsigned('serviceId', serviceId);
        requiresPositiveUnsigned('serviceVersion', serviceVersion);

        const builder = typeof b === 'number' ? new Builder(b) : b;

        const req_off = UserRequestProto.createUserRequestProto(
            builder,
            API_PROTOCOL_VERSION,
            builder.createString(logContext),
            serviceId.toLong(),
            serviceVersion.toLong(),
            kind,
            createInner(builder)
        );
        builder.finish(req_off);
        return builder.asUint8Array();
    }

    createCallMethodRequest(logContext: string, key: EndpointKey | SessionKey, methodId: MethodId, args: any[]): Uint8Array {
        requiresTruthy('endpointKey', key);
        requiresTruthy('methodId', methodId);

        const serviceKey = key.classKey.serviceKey;

        return this.createRequest(CALL_METHOD_REQUEST_BUFFER_SIZE, logContext, serviceKey.serviceId, serviceKey.serviceVersion, UserRequestUnionProto.CallMethodRequestProto, (builder) => {
            const transferQueue = new DataTransferQueue(this.dataRegistry, serviceKey);

            const argsOffsets: Offset[] = [];
            let i = 0;
            for (const arg of args) {
                argsOffsets.push(this.serializeValue(builder, arg, transferQueue));
            }

            const inboundDataDeltaOffsets: Offset[] = [];
            while (transferQueue.length > 0) {
                inboundDataDeltaOffsets.push(this.createInboundDataDelta(builder, transferQueue.pop(), transferQueue));
            }

            return CallMethodRequestProto.createCallMethodRequestProto(
                builder,
                key.classKey.classId,
                builder.createString(key.primaryKey),
                methodId,
                CallMethodRequestProto.createArgumentsVector(builder, argsOffsets),
                CallMethodRequestProto.createReferencedDataDeltasVector(builder, inboundDataDeltaOffsets)
            );
        });
    }

    createGetDataRequest(logContext: string, dataKey: DataKey): Uint8Array {
        requiresTruthy('dataKey', dataKey);
        const service_key = dataKey.classKey.serviceKey;
        return this.createRequest(GET_DATA_REQUEST_BUFFER_SIZE, logContext, service_key.serviceId, service_key.serviceVersion, UserRequestUnionProto.GetDataRequestProto, builder => {
            return GetDataRequestProto.createGetDataRequestProto(builder, dataKey.classKey.classId,
                builder.createString(dataKey.primaryKey));
        });
    }

    createSaveDataRequest(logContext: string, data: Data[]): Uint8Array {
        if (typeof data !== 'object' || data.length === 0)
            throw new Error('invalid argument data');

        const transferQueue = new DataTransferQueue(this.dataRegistry);

        for (const d of data) {
            transferQueue.tryAdd(d);
        }

        const builder = new Builder(SAVE_DATA_REQUEST_BUFFER_SIZE);

        const inboundDataDeltaOffsets: Offset[] = [];
        do {
            inboundDataDeltaOffsets.push(this.createInboundDataDelta(builder, transferQueue.pop(), transferQueue));
        } while (transferQueue.length > 0);

        const serviceKey = transferQueue.serviceKey;
        if (!serviceKey)
            throw new Error("Unexpectedly had no service key");

        return this.createRequest(builder, logContext, serviceKey.serviceId, serviceKey.serviceVersion, UserRequestUnionProto.SaveDataRequestProto, builder => {
            return SaveDataRequestProto.createSaveDataRequestProto(builder, SaveDataRequestProto.createDataDeltasVector(builder, inboundDataDeltaOffsets));
        });
    }

    createSubscribeEventRequest(logContext: string, eventInstanceKey: EventInstanceKey): Uint8Array {
        requiresTruthy('eventInstanceKey', eventInstanceKey);
        const serviceKey = eventInstanceKey.eventClassKey.serviceKey;
        return this.createRequest(CREATE_SUBSCRIBE_EVENT_REQUEST_BUFFER_SIZE, logContext, serviceKey.serviceId, serviceKey.serviceVersion,
            UserRequestUnionProto.SubscribeEventRequestProto, builder => {
                const serviceRefUnionType = eventInstanceKey.getSourceServiceReferenceUnionProto();
                if (serviceRefUnionType == ServiceReferenceUnionProto.DataReferenceValueProto) {
                    return SubscribeEventRequestProto.createSubscribeEventRequestProto(
                        builder,
                        eventInstanceKey.eventClassKey.classId,
                        serviceRefUnionType,
                        DataReferenceValueProto.createDataReferenceValueProto(
                            builder, eventInstanceKey.sourceKey.classKey.classId, builder.createString(eventInstanceKey.sourceKey.primaryKey)
                        ));
                } else {
                    return SubscribeEventRequestProto.createSubscribeEventRequestProto(
                        builder,
                        eventInstanceKey.eventClassKey.classId,
                        serviceRefUnionType,
                        EndpointReferenceValueProto.createEndpointReferenceValueProto(
                            builder, eventInstanceKey.sourceKey.classKey.classId, builder.createString(eventInstanceKey.sourceKey.primaryKey)
                        ));
                }
            });
    }

    createUnsubscribeEventRequest(logContext: string, eventInstanceKey: EventInstanceKey): Uint8Array {
        requiresTruthy('eventInstanceKey', eventInstanceKey);
        const serviceKey = eventInstanceKey.eventClassKey.serviceKey;
        return this.createRequest(CREATE_UNSUBSCRIBE_EVENT_REQUEST_BUFFER_SIZE, logContext, serviceKey.serviceId, serviceKey.serviceVersion,
            UserRequestUnionProto.UnsubscribeEventRequestProto, builder => {
                const serviceRefUnionType = eventInstanceKey.getSourceServiceReferenceUnionProto();
                if (serviceRefUnionType == ServiceReferenceUnionProto.DataReferenceValueProto) {
                    return UnsubscribeEventRequestProto.createUnsubscribeEventRequestProto(
                        builder,
                        eventInstanceKey.eventClassKey.classId,
                        serviceRefUnionType,
                        DataReferenceValueProto.createDataReferenceValueProto(
                            builder, eventInstanceKey.sourceKey.classKey.classId, builder.createString(eventInstanceKey.sourceKey.primaryKey)
                        ));
                } else {
                    return UnsubscribeEventRequestProto.createUnsubscribeEventRequestProto(
                        builder,
                        eventInstanceKey.eventClassKey.classId,
                        serviceRefUnionType,
                        EndpointReferenceValueProto.createEndpointReferenceValueProto(
                            builder, eventInstanceKey.sourceKey.classKey.classId, builder.createString(eventInstanceKey.sourceKey.primaryKey)
                        ));
                }
            })
    }

    createSubscribeDataUpdatesRequest(logContext: string, objectKeys: DataKey[]): Uint8Array {
        requiresTruthy('objectKeys', objectKeys);
        requiresAtLeastOneElement('objectKeys', objectKeys);

        const builder = new Builder(CREATE_SUBSCRIBE_DATA_UPDATES_REQUEST_BUFFER_SIZE);
        const referencesOffsets: Offset[] = [];

        let serviceKey: ServiceKey | null = null;
        for (const objectKey of objectKeys) {
            if (!serviceKey) {
                serviceKey = objectKey.classKey.serviceKey;
            } else {
                if (!objectKey.classKey.serviceKey.equals(serviceKey))
                    throw new Error('Not all objects are from the same service');
            }
            referencesOffsets.push(DataReferenceValueProto.createDataReferenceValueProto(builder,
                objectKey.classKey.classId, builder.createString(objectKey.primaryKey)));
        }

        if (!serviceKey)
            throw new Error('Unexpectedly serviceKey was falsey');

        const referencesVec = SubscribeDataUpdatesRequestProto.createReferencesVector(builder, referencesOffsets);

        return this.createRequest(builder, logContext, serviceKey.serviceId, serviceKey.serviceVersion,
            UserRequestUnionProto.SubscribeDataUpdatesRequestProto, builder => {
                return SubscribeDataUpdatesRequestProto.createSubscribeDataUpdatesRequestProto(
                    builder,
                    referencesVec
                );
            });
    }

    createUnsubscribeDataUpdatesRequest(logContext: string, objectKeys: DataKey[]): Uint8Array {
        requiresTruthy('objectKeys', objectKeys);
        requiresAtLeastOneElement('objectKeys', objectKeys);

        const builder = new Builder(CREATE_UNSUBSCRIBE_DATA_UPDATES_REQUEST_BUFFER_SIZE);
        const referencesOffsets: Offset[] = [];

        let serviceKey: ServiceKey | null = null;
        for (const objectKey of objectKeys) {
            if (!serviceKey) {
                serviceKey = objectKey.classKey.serviceKey;
            } else {
                if (!objectKey.classKey.serviceKey.equals(serviceKey))
                    throw new Error('Not all objects are from the same service');
            }
            referencesOffsets.push(DataReferenceValueProto.createDataReferenceValueProto(builder,
                objectKey.classKey.classId, builder.createString(objectKey.primaryKey)));
        }

        if (!serviceKey)
            throw new Error('Unexpectedly serviceKey was falsy');

        const referencesVec = UnsubscribeDataUpdatesRequestProto.createReferencesVector(builder, referencesOffsets);

        return this.createRequest(builder, logContext, serviceKey.serviceId, serviceKey.serviceVersion,
            UserRequestUnionProto.UnsubscribeDataUpdatesRequestProto, builder => {
                return UnsubscribeDataUpdatesRequestProto.createUnsubscribeDataUpdatesRequestProto(
                    builder,
                    referencesVec
                );
            });
    }
}

export class ResponseReader {

    constructor(private readonly endpointRegistry: EndpointRegistry,
                private readonly sessionRegistry: SessionRegistry,
                private readonly dataRegistry: DataRegistry,
                private readonly dataContext: DataContext) {
        requiresTruthy('endpointRegistry', endpointRegistry);
        requiresTruthy('sessionRegistry', sessionRegistry);
        requiresTruthy('dataRegistry', dataRegistry);
        requiresTruthy('dataContext', dataContext);
    }

    readResponse<T extends OkResponseType>(logContext: string,
                                           buffer: ArrayBuffer,
                                           expectedType: UserResponseUnionProto,
                                           c: new() => T,
                                           acceptMessages: boolean): UserResponse<T> {
        requiresTruthy('buffer', buffer);
        requiresTruthy('expectedType', expectedType);

        const outerByteBuffer = new ByteBuffer(new Uint8Array(buffer));
        const apiUserResponseProto = ApiUserResponseProto.getRootAsApiUserResponseProto(outerByteBuffer);

        // Get the console log
        let consoleLog;
        {
            const consoleLogBytesProto = apiUserResponseProto.consoleLog();
            if (consoleLogBytesProto) {
                const bytes = consoleLogBytesProto.bytesArray();
                if (bytes) {
                    consoleLog = ConsoleLogProto.getRootAsConsoleLogProto(new ByteBuffer(bytes));
                } else {
                    logError(logContext, "Unable to read console log output because the data returned was empty.")
                }
            }
        }

        // Get the user response
        let userResponseProto;
        {
            const userResponseWrapperBytesProto = apiUserResponseProto.response();
            if (!userResponseWrapperBytesProto)
                throw new Error('Response from Api contained no data');
            const bytes = userResponseWrapperBytesProto.bytesArray();
            if (!bytes)
                throw new Error('Response from Api contained an empty bytes array');
            userResponseProto = UserResponseUnionWrapperProto.getRootAsUserResponseUnionWrapperProto(new ByteBuffer(bytes));
        }

        const userResponseTypeProto = userResponseProto.valueType();
        switch (userResponseTypeProto) {
            case UserResponseUnionProto.NONE: {
                throw new Error(logError(logContext, 'Response contained invalid data because the response type was NONE'));
            }
            case UserResponseUnionProto.ErrorCodeResponseProto: {
                const responseProto = userResponseProto.value(new ErrorCodeResponseProto());
                if (!responseProto)
                    throw new Error(logError(logContext, 'ErrorCode response was invalid because it was empty'));
                const code = <Code>responseProto.errorCode();
                return UserResponse.createPlatformException<T>(new PlatformException(code, getCodeName(code)), consoleLog);
            }
            case UserResponseUnionProto.ExceptionResponseProto: {
                const responseProto = userResponseProto.value(new ExceptionResponseProto());
                if (!responseProto)
                    throw new Error(logError(logContext, 'Exception response was invalid because it was empty'));
                return UserResponse.createScriptException<T>(new ScriptException(
                    responseProto.stack() ? <string>responseProto.stack() : "<empty>",
                    responseProto.message() ? <string>responseProto.message() : "<empty>"), consoleLog);
            }
            default: {
                assertResponseType(expectedType, userResponseTypeProto);
                const responseProto = userResponseProto.value(new c());
                if (!responseProto)
                    throw new Error(logError(logContext, 'Response contained invalid data because it was empty'));

                if (!acceptMessages) {
                    if (apiUserResponseProto.messagesLength())
                        throw new Error(logError(logContext, 'Unexpectedly received messages in response'));
                    return UserResponse.createOk<T>(responseProto, undefined, consoleLog);
                } else if (apiUserResponseProto.messagesLength()) {
                    const messages: UserMessageUnionWrapperProto[] = [];
                    for (let i = 0; i < apiUserResponseProto.messagesLength(); ++i) {
                        const messageWrapperBytes = apiUserResponseProto.messages(i);
                        if (!messageWrapperBytes)
                            throw new Error(logError(logContext, 'Response contained invalid message data bytes'));
                        const bytes = messageWrapperBytes.bytesArray();
                        if (!bytes)
                            throw new Error(logError(logContext, 'Response contained and invalid message data bytes array'));
                        const messageWrapper = UserMessageUnionWrapperProto.getRootAsUserMessageUnionWrapperProto(new ByteBuffer(bytes));
                        if (!messageWrapper)
                            throw new Error(logError(logContext, 'Response contained invalid message data'));
                        messages.push(messageWrapper);
                    }
                    return UserResponse.createOk<T>(responseProto, messages, consoleLog);
                }

                return UserResponse.createOk<T>(responseProto, undefined, consoleLog);
            }
        }
    }
    readProperty(logContext: string, key: IKey, propertyProto: PropertyProto | NestedPropertyProto | null): { name: string, valueProto: ValueProto } {
        if (!propertyProto)
            throw new Error(logError(logContext, `Unable to read property of ${key.getFullyQualifiedName()} because it contained invalid data`));

        const name = propertyProto.name();
        if (!name)
            throw new Error(logError(logContext, `Unable to read property of ${key.getFullyQualifiedName()} because its name was empty`));

        let valueProto;
        if (propertyProto instanceof PropertyProto) {
            valueProto = propertyProto.value();
        } else /*NestedPropertyProto*/ {
            const valueBytes = propertyProto.valueBytesArray();
            if (!valueBytes)
                throw new Error(logError(logContext, `Unable to read property of ${key.getFullyQualifiedName()} because its value contained invalid data`));
            const valueBuffer = new ByteBuffer(valueBytes);
            valueProto = ValueProto.getRootAsValueProto(valueBuffer);
        }

        if (!valueProto)
            throw new Error(logError(logContext, `Unable to read property of ${key.getFullyQualifiedName()} because its value proto contained invalid data`));

        return {name, valueProto};
    }

    deserializeValue(logContext: string, serviceKey: ServiceKey, value: ValueProto, tracker: Tracker): { type: ValueUnionProto, value: any } {
        requiresTruthy('logContext', logContext);
        requiresTruthy('serviceKey', serviceKey);
        requiresTruthy('value', value);
        requiresTruthy('tracker', tracker);

        const type = value.valueType();
        switch (type) {
            case ValueUnionProto.UndefinedValueProto:
                return {type, value: undefined};
            case ValueUnionProto.NullValueProto:
                return {type, value: null};
            case ValueUnionProto.BooleanValueProto:
                return {type, value: unwrap<BooleanValueProto>(logContext, value, BooleanValueProto).value()};
            case ValueUnionProto.StringValueProto:
                return {type, value: unwrap<StringValueProto>(logContext, value, StringValueProto).value()};
            case ValueUnionProto.NumberValueProto:
                return {type, value: unwrap<NumberValueProto>(logContext, value, NumberValueProto).value()};
            case ValueUnionProto.ObjectValueProto: {
                const objectValueProto = unwrap<ObjectValueProto>(logContext, value, ObjectValueProto);
                const object = {};
                for (let i = 0; i < objectValueProto.propertiesLength(); ++i) {
                    const properties = objectValueProto.properties(i);
                    if (!properties)
                        throw new Error(logError(logContext, "Unable to deserialize object property because it was null"));

                    const name = properties.name();
                    if (!name)
                        throw new Error(logError(logContext, `Unable to deserialize object property name because it was null`));

                    const valueProto = properties.value();
                    if (!valueProto)
                        throw new Error(logError(logContext, 'Unable to deserialize object property value because it was null'));

                    const {
                        type: valueType,
                        value
                    } = this.deserializeValue(logContext, serviceKey, valueProto, tracker);

                    if (valueType == ValueUnionProto.DataReferenceValueProto) {
                        tracker.dataResolutionQueue.enqueue(<DataKey>value, data => {
                            Object.defineProperty(object, name, {
                                value: data,
                                configurable: false,
                                enumerable: true,
                                writable: true
                            });
                        });
                    } else {
                        Object.defineProperty(object, name, {
                            value: value,
                            configurable: false,
                            enumerable: true,
                            writable: true
                        });
                    }
                }
                return {type, value: object};
            }
            case ValueUnionProto.ArrayValueProto: {
                const arrayValueProto = unwrap<ArrayValueProto>(logContext, value, ArrayValueProto);
                const array = [];
                for (let i = 0; i < arrayValueProto.itemsLength(); ++i) {
                    const itemProto = arrayValueProto.items(i, new ArrayItemValueProto());
                    if (!itemProto)
                        throw new Error(logError(logContext, 'Unable to deserialize array item because it was null'));

                    const valueProto = itemProto.value(new ValueProto());
                    if (!valueProto)
                        throw new Error(logError(logContext, 'Unable to deserialize array item value because it was null'));

                    const {
                        type: valueType,
                        value
                    } = this.deserializeValue(logContext, serviceKey, valueProto, tracker);

                    const index = itemProto.index();

                    if (valueType == ValueUnionProto.DataReferenceValueProto) {
                        tracker.dataResolutionQueue.enqueue(<DataKey>value, data => {
                            array[index] = data;
                        });
                    } else {
                        array[index] = value;
                    }
                }
                return {type, value: array};
            }
            case ValueUnionProto.DataReferenceValueProto: {
                const objectReferenceValueProto = unwrap<DataReferenceValueProto>(logContext, value, DataReferenceValueProto);
                const primaryKey = objectReferenceValueProto.primaryKey();
                if (!primaryKey)
                    throw new Error(logError(logContext, 'Unable to deserialize service object reference because it contained an invalid primary key'));
                return {
                    type,
                    value: new DataKey(new DataClassKey(serviceKey, objectReferenceValueProto.classId()), primaryKey)
                };
            }
            case ValueUnionProto.SessionReferenceValueProto: {
                const referenceValueProto = unwrap<SessionReferenceValueProto>(logContext, value, SessionReferenceValueProto);
                const sessionId = referenceValueProto.sessionId();
                if (!sessionId)
                    throw new Error(logError(logContext, 'Unable to deserialize session reference because it contained an invalid session id.'));
                const endpointKey = new SessionKey(new SessionClassKey(serviceKey, referenceValueProto.classId()), sessionId);
                return {
                    type,
                    value: this.sessionRegistry.createInstance(endpointKey)
                };
            }
            case ValueUnionProto.EndpointReferenceValueProto: {
                const referenceValueProto = unwrap<EndpointReferenceValueProto>(logContext, value, EndpointReferenceValueProto);
                const primaryKey = referenceValueProto.primaryKey();
                if (!primaryKey)
                    throw new Error(logError(logContext, 'Unable to deserialize endpoint reference because it contained an invalid primary key'));
                const endpointKey = new EndpointKey(new EndpointClassKey(serviceKey, referenceValueProto.classId()), primaryKey);
                return {
                    type,
                    value: this.endpointRegistry.createInstance(endpointKey)
                };
            }
            case ValueUnionProto.MapValueProto: {
                const mapValueProto = unwrap<MapValueProto>(logContext, value, MapValueProto);
                const map = new Map<any, any>();
                for (let i = 0; i < mapValueProto.itemsLength(); ++i) {
                    const mapValueItemProto = mapValueProto.items(i, new MapValueItemProto());
                    if (!mapValueItemProto)
                        throw new Error(logError(logContext, 'Unable to deserialize map item because it was null'));

                    const keyValueProto = mapValueItemProto.key(new ValueProto());
                    if (!keyValueProto)
                        throw new Error(logError(logContext, 'Unable to deserialize map key because it was null'));

                    const valueValueProto = mapValueItemProto.value(new ValueProto());
                    if (!valueValueProto)
                        throw new Error(logError(logContext, 'Unable to deserialize map value because it was null'));

                    const {
                        type: keyType,
                        value: keyValue
                    } = this.deserializeValue(logContext, serviceKey, keyValueProto, tracker);

                    const {
                        type: valueType,
                        value: valueValue
                    } = this.deserializeValue(logContext, serviceKey, valueValueProto, tracker);

                    const keyNeedsResolve = keyType == ValueUnionProto.DataReferenceValueProto;
                    const valueNeedsResolve = valueType == ValueUnionProto.DataReferenceValueProto;

                    if (keyNeedsResolve && valueNeedsResolve) {
                        tracker.dataResolutionQueue.enqueueMultiple([<DataKey>keyValue, <DataKey>valueValue], dataMap => {
                            const ko = dataMap.get(<DataKey>keyValue);
                            const vo = dataMap.get(<DataKey>valueValue);
                            map.set(ko, vo);
                        });
                    } else if (keyNeedsResolve) {
                        tracker.dataResolutionQueue.enqueue(<DataKey>keyValue, data => {
                            map.set(data, valueValue);
                        });
                    } else if (valueNeedsResolve) {
                        tracker.dataResolutionQueue.enqueue(<DataKey>valueValue, data => {
                            map.set(keyValue, data);
                        });
                    } else {
                        map.set(keyValue, valueValue);
                    }
                }
                return {type, value: map};
            }
            case ValueUnionProto.SetValueProto: {
                const setValueProto = unwrap<SetValueProto>(logContext, value, SetValueProto);
                const set = new Set<any>();
                for (let i = 0; i < setValueProto.itemsLength(); ++i) {
                    const itemValueProto = setValueProto.items(i, new ValueProto());
                    if (!itemValueProto)
                        throw new Error(logError(logContext, 'Unable to deserialize set item because it was null'));

                    const {
                        type: itemType,
                        value: itemValue
                    } = this.deserializeValue(logContext, serviceKey, itemValueProto, tracker);

                    if (itemType == ValueUnionProto.DataReferenceValueProto) {
                        tracker.dataResolutionQueue.enqueue(<DataKey>itemValue, data => {
                            set.add(data);
                        });
                    } else {
                        set.add(itemValue);
                    }
                }
                return {type, value: set};
            }
            case ValueUnionProto.DateValueProto: {
                const dateValueProto = unwrap<DateValueProto>(logContext, value, DateValueProto);
                return {type, value: new Date(dateValueProto.value())};
            }
            default:
                throw new Error(logError(logContext, `Invalid type ${type} found while deserializing value`));
        }
    }

    getDataAndKeyMap(data: Data | Data[]):
        { serviceKey: ServiceKey, objects: Data[], objectKeyMap: KeyMap<DataKey, Data> } {
        requiresTruthy('data', data);

        let objects = normalizeArrayArg(data);

        let serviceKey;
        const objectKeyMap = new KeyMap<DataKey, Data>();
        for (const object of objects) {
            const classKey = this.dataRegistry.getClassKey(object.constructor);
            const objectKey = new DataKey(classKey, object.primaryKey);

            if (!serviceKey) {
                serviceKey = classKey.serviceKey;
            } else {
                if (!serviceKey.equals(classKey.serviceKey))
                    throw new Error(sysLogError(`Data ${objectKey.getFullyQualifiedName()} doesn't belong to the same service (${serviceKey.getFullyQualifiedName()}) as the others. All objects must be from the same service.`));
            }

            if (objectKeyMap.has(objectKey))
                throw new Error(sysLogError(`Duplicate object ${objectKey.getFullyQualifiedName()}`));

            objectKeyMap.set(objectKey, object);
        }

        if (!serviceKey)
            throw new Error(sysLogError('Unexpectedly serviceKey was falsey'));

        return {serviceKey: serviceKey, objects: objects, objectKeyMap: objectKeyMap};
    }

    getDataAndKeys(data: Data | Data[]): { serviceKey: ServiceKey, objects: Data[], dataKeys: DataKey[] } {
        requiresTruthy('data', data);

        let objects = normalizeArrayArg(data);

        let serviceKey;
        let objectKeys: DataKey[] = [];
        let objectKeysSet = new Set<string>();

        for (const object of objects) {
            const classKey = this.dataRegistry.getClassKey(object.constructor);
            const objectKey = new DataKey(classKey, object.primaryKey);

            if (!serviceKey) {
                serviceKey = classKey.serviceKey;
            } else {
                if (!serviceKey.equals(classKey.serviceKey))
                    throw new Error(sysLogError(`Data ${objectKey.getFullyQualifiedName()} doesn't belong to the same service (${serviceKey.getFullyQualifiedName()}) as the others. All objects must be from the same service.`));
            }

            if (objectKeysSet.has(objectKey.value))
                throw new Error(sysLogError(`Duplicate object ${objectKey.getFullyQualifiedName()}`));

            objectKeysSet.add(objectKey.value);
            objectKeys.push(objectKey);
        }

        if (!serviceKey)
            throw new Error(sysLogError('Unexpectedly serviceKey was falsy'));

        return {serviceKey: serviceKey, objects: objects, dataKeys: objectKeys};
    }

    mergeDeltaProperties(logContext: string, target: object, serviceKey: ServiceKey, objectKey: DataKey, deltaProto: DataDeltaProto, tracker: Tracker) {
        requiresTruthy('logContext', logContext);
        requiresTruthy('target', target);
        requiresTruthy('serviceKey', serviceKey);
        requiresTruthy('objectKey', objectKey);
        requiresTruthy('deltaProto', deltaProto);
        requiresTruthy('tracker', tracker);

        //update properties that have been updated
        for (let i = 0; i < deltaProto.propertiesLength(); ++i) {
            const {name, valueProto} = this.readProperty(logContext, objectKey, deltaProto.properties(i));
            const {type, value} = this.deserializeValue(logContext, serviceKey, valueProto, tracker);
            if(type == ValueUnionProto.DataReferenceValueProto) {
                tracker.dataResolutionQueue.enqueue(<DataKey> value, maybeData => {
                    // @ts-ignore
                    target[name] = maybeData;
                });
            } else {
                // @ts-ignore
                target[name] = value;
            }
        }

        //delete properties that have been deleted
        for (let i = 0; i < deltaProto.deletedPropertiesLength(); ++i) {
            const name = deltaProto.deletedProperties(i);
            // @ts-ignore
            delete target[name];
        }
    }

    mergeDelta(logContext: string, serviceKey: ServiceKey, deltaProto: DataDeltaProto, tracker: Tracker): void {
        requiresTruthy('logContext', logContext);
        requiresTruthy('serviceKey', serviceKey);
        requiresTruthy('deltaProto', deltaProto);
        requiresTruthy('tracker', tracker);

        const objectKey = createDataKeyFromDelta(serviceKey, deltaProto);

        const deltaObjectVersion = Unsigned.fromLong(deltaProto.objectVersion());
        if (!deltaObjectVersion || deltaObjectVersion.equals(UnsignedZero))
            throw new Error(logError(logContext, 'Unable to merge service object because the object version was zero or invalid'));

        let existingObject = this.dataContext.tryGetInstance(objectKey);
        let existingObjectVersion: Unsigned | undefined;
        if (existingObject)
            existingObjectVersion = this.dataContext.tryGetVersion(existingObject);

        if (deltaProto.deleted()) {
            // Deleted
            logVerbose(logContext, `Adding ${objectKey.getFullyQualifiedName()} to object updated firing queue and delete queue`);
            if (existingObject) {
                tracker.dataUpdatedFiringQueue.enqueue(existingObject, true);
            }
            tracker.dataDeleteQueue.enqueue(objectKey);
            logVerbose(logContext, `Delta applied: Object ${objectKey.getFullyQualifiedName()} deleted.`);
        } else if (!existingObjectVersion && deltaObjectVersion.equals(UnsignedOne)) {
            // New version (may have an existing object if they've created it locally)
            let object = existingObject;
            if (!object) {
                object = this.dataRegistry.createInstance(objectKey);
                this.dataContext.setInstance(objectKey, object);
            }
            this.mergeDeltaProperties(logContext, object, serviceKey, objectKey, deltaProto, tracker);
            this.dataContext.setVersion(object, UnsignedOne);
            tracker.dataUpdatedFiringQueue.enqueue(object, false);
            if (existingObject)
                logVerbose(logContext, `Delta applied: Locally created object ${objectKey.getFullyQualifiedName()} updated to verson 1.`);
            else
                logVerbose(logContext, `Delta applied: Object ${objectKey.getFullyQualifiedName()} created.`);
        } else if (existingObjectVersion && deltaObjectVersion.value === (existingObjectVersion.value + BigInt(1))) {
            // Updated
            if (!existingObject)
                throw new Error("Unexpectedly the existing object was empty when the existing object version was found.");
            this.mergeDeltaProperties(logContext, existingObject, serviceKey, objectKey, deltaProto, tracker);
            this.dataContext.setVersion(existingObject, deltaObjectVersion);
            tracker.dataUpdatedFiringQueue.enqueue(existingObject, false);
            logVerbose(logContext, `Delta applied: Object ${objectKey.getFullyQualifiedName()} updated to verson ${deltaObjectVersion.toString()}.`);
        } else {
            //Since the delta was rejected, remove the object if one exists and enqueue a getData to replace it.
            this.dataContext.remove(objectKey);
            tracker.dataResolutionQueue.enqueue(objectKey, null);

            if (getEnableVerboseLogging()) {
                logVerbose(logContext, `Delta rejected. Information used for determination: ${JSON.stringify({
                    objectKey: objectKey.getFullyQualifiedName(),
                    existingObject: existingObject ? JSON.stringify(existingObject) : "<none>",
                    existingObjectVersion: existingObjectVersion ? existingObjectVersion.toString() : "<none>",
                    deltaVersion: deltaObjectVersion.toString(),
                    deltaDeleted: deltaProto.deleted()
                })}`);
            }
        }
    }

    replaceData(logContext: string, serviceKey: ServiceKey, objectProto: DataProto | NestedDataProto, tracker: Tracker): Data | null {
        requiresTruthy('logContext', logContext);
        requiresTruthy('serviceKey', serviceKey);
        requiresTruthy('objectProto', objectProto);
        requiresTruthy('tracker', tracker);

        const classKey = new DataClassKey(serviceKey, objectProto.classId());

        const objectVersion = Unsigned.fromLong(objectProto.objectVersion());
        if (objectVersion.equals(UnsignedZero))
            throw new Error(logError(logContext, 'Unable to load service object because the object version was zero or invalid'));

        const primaryKey = objectProto.primaryKey();
        if (!primaryKey)
            throw new Error(logError(logContext, 'Unable to load service object because the primary key was invalid'));
        const objectKey = new DataKey(classKey, primaryKey);

        let reused = false;
        let object = this.dataContext.tryGetInstance(objectKey);
        if (object) {
            if (objectProto.deleted()) {
                tracker.dataUpdatedFiringQueue.enqueue(object, true);
                tracker.dataDeleteQueue.enqueue(objectKey);
                return null;
            }
            reused = true;
            for (const name of Object.getOwnPropertyNames(object)) {
                // @ts-ignore
                delete object[name];
            }
        } else {
            object = this.dataRegistry.createInstance(objectKey);
            this.dataContext.setInstance(objectKey, object);
        }

        for (let i = 0; i < objectProto.propertiesLength(); ++i) {
            const {name, valueProto} = this.readProperty(logContext, objectKey, objectProto.properties(i));
            const {type, value} = this.deserializeValue(logContext, serviceKey, valueProto, tracker);
            if(type == ValueUnionProto.DataReferenceValueProto) {
                tracker.dataResolutionQueue.enqueue(<DataKey>value, maybeData => {
                    Object.defineProperty(object, name, {
                        value: maybeData,
                        configurable: true,
                        enumerable: true,
                        writable: true
                    });
                });
            } else {
                Object.defineProperty(object, name, {
                    value: value,
                    configurable: true,
                    enumerable: true,
                    writable: true
                });
            }
        }

        this.dataContext.setVersion(object, objectVersion);

        logVerbose(logContext, `Object ${objectKey.getFullyQualifiedName()} replaced with version ${objectVersion.toString()}`);

        if (reused) {
            tracker.dataUpdatedFiringQueue.enqueue(object, false);
        }

        return object;
    }
}

function assertResponseType(expected: UserResponseUnionProto, actual: UserResponseUnionProto) {
    if (expected !== actual)
        throw new Error(sysLogError(`Received response type ${expected} when ${actual} expected.`));
}

function unwrap<T>(logContext: string, value: ValueProto, c: new() => T): T {
    const v = value.value(new c());
    if (!v)
        throw new Error(logError(logContext, `Unable to deserialize value because it contained invalid data`));
    return v;
}

export function isDataReferenceType(o: any) {
    return o === ValueUnionProto.DataReferenceValueProto;
}

export function isEndpointReferenceType(o: any) {
    return o === ValueUnionProto.EndpointReferenceValueProto;
}

export interface IUnwrappable<T> {
    __init(i: number, bb: ByteBuffer): T;
}

export function unwrapBytes<T extends IUnwrappable<T>>(logContext: string, bytes: Uint8Array | null, c: new() => T) {
    if (!bytes)
        throw new Error(logError(logContext, "Unable to unwrap because the byte array was empty"));
    const bb = new ByteBuffer(bytes);
    return new c().__init(bb.readInt32(bb.position()) + bb.position(), bb);
}

export function normalizeArrayArg<T>(arg: T | T[]): T[] {
    if (arg instanceof Array) {
        return arg;
    } else {
        return [arg];
    }
}

export function wrapScriptException(exception: ScriptException) {
    return new ScriptError(exception.message, exception.stack);
}

export function getErrorForNotOkResponse<T extends OkResponseType>(logContext: string, response: UserResponse<T>) {
    if (response.platformException) {
        return new PlatformError(`Roli encountered an error ${response.platformException.codeString}`, response.platformException.codeString, logContext);
    } else if (response.exception) {
        return wrapScriptException(response.exception);
    } else {
        return new Error(logError(logContext, 'Unexpected non-error and non-OK response'));
    }
}

export function friendlyArgumentRequired(name: string, arg: any) {
    if (!arg)
        throw new Error(`The argument ${name} is required but was either empty or not specified.`);
}

export function friendlyArrayArgumentRequired(name: string, arg: any) {
    if (!arg || !(arg instanceof Array) || arg.length === 0)
        throw new Error(`The argument ${name} is required but was either empty or not specified.`);
}

export function createDataKeyFromDelta(serviceKey: ServiceKey, delta: DataDeltaProto): DataKey {
    requiresTruthy('serviceKey', serviceKey);
    requiresTruthy('delta', delta);
    const primaryKey = delta.primaryKey();
    if (!primaryKey) {
        throw new Error(`Unable to create DataKey from delta because the primaryKey was empty`);
    }
    return new DataKey(new DataClassKey(serviceKey, delta.classId()), primaryKey);
}