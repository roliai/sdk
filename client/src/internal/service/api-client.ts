import {ByteBuffer} from "flatbuffers";

import {requiresTruthy} from "../util/requires.js";
import {OuterspaceClient, OuterspaceClientFactory} from "./outerspace-client.js";
import {logVerbose, logDebug, logError, sysLogError} from "../util/logging.js";
import {ServiceRegistry} from "../util/registry.js";
import {
    RequestFactory, ResponseReader
} from "../util/serde.js";
import {UserResponseUnionProto} from "../protocol/user-response-union-proto.js";
import {CallMethodResponseProto} from "../protocol/call-method-response-proto.js";
import {EventMessageProto} from "../protocol/event-message-proto.js";
import {UnsubscribeDataUpdatesResponseProto} from "../protocol/unsubscribe-data-updates-response-proto.js";
import {UnsubscribeEventResponseProto} from "../protocol/unsubscribe-event-response-proto.js";
import {GetDataResponseProto} from "../protocol/get-data-response-proto.js";
import {SubscribeDataUpdatesResponseProto} from "../protocol/subscribe-data-updates-response-proto.js";
import {UserMessageUnionProto} from "../protocol/user-message-union-proto.js";
import {DataUpdateMessageProto} from "../protocol/data-update-message-proto.js";
import {SaveDataResponseProto} from "../protocol/save-data-response-proto.js";
import {SubscribeEventResponseProto} from "../protocol/subscribe-event-response-proto.js";
import {ApiUserMessageProto} from "../protocol/api-user-message-proto.js";
import {UserMessageUnionWrapperProto} from "../protocol/user-message-union-wrapper-proto.js";

import {
    MethodId,
    OkResponseType,
    UserResponse, EventInstanceKey,
    ServiceKey,
    DataKey,
    EndpointKey
} from "../internal-model-types.js";
import {Data} from "../../public/model-types.js"

export type DataUpdateMessageHandler = (logContext: string, service_key: ServiceKey, objectUpdateMessageProto: DataUpdateMessageProto) => Promise<void>;
export type EventMessageHandler = (logContext: string, service_key: ServiceKey, eventMessageProto: EventMessageProto) => Promise<void>;

export class ApiClientFactory {
    private readonly _messageTracing: boolean;
    private readonly _serviceRegistry: ServiceRegistry;
    private readonly _requestFactory: RequestFactory;
    private readonly _responseReader: ResponseReader;
    private readonly _apiBaseUrl: string;

    constructor(messageTracing: boolean,
                serviceRegistry: ServiceRegistry,
                requestFactory: RequestFactory,
                responseReader: ResponseReader,
                apiBaseUrl: string) {
        requiresTruthy('serviceRegistry', serviceRegistry);
        requiresTruthy('requestFactory', requestFactory);
        requiresTruthy('responseReader', responseReader);
        requiresTruthy('apiBaseUrl', apiBaseUrl);
        this._messageTracing = messageTracing;
        this._serviceRegistry = serviceRegistry;
        this._requestFactory = requestFactory;
        this._responseReader = responseReader;
        this._apiBaseUrl = apiBaseUrl;
    }

    async create(serviceKey: ServiceKey,
                 admin: boolean,
                 authKey: string,
                 accessToken: string | null,
                 updateHandler: DataUpdateMessageHandler,
                 eventMessageHandler: EventMessageHandler): Promise<ApiClient> {
        const serviceRegistry = this._serviceRegistry;
        return new ApiClient(this._messageTracing, this._requestFactory, this._responseReader,
            new OuterspaceClientFactory(this._apiBaseUrl, admin, authKey, accessToken, function (messageBuffer) {
                requiresTruthy('messageBuffer', messageBuffer);

                const apiUserMessage = ApiUserMessageProto.getRootAsApiUserMessageProto(new ByteBuffer(new Uint8Array(messageBuffer)));

                const logContext = apiUserMessage.logContext();
                if (!logContext)
                    throw new Error(sysLogError('Unable to read message because it contained an empty log context'));

                const otherServiceKey = new ServiceKey(apiUserMessage.serviceId(), apiUserMessage.serviceVersion());

                const message = apiUserMessage.message();
                if (!message)
                    throw new Error(sysLogError("Failed to read user message from Api because it was empty"));

                const userMessageWrapperBytes = message.bytesArray();
                if (!userMessageWrapperBytes)
                    throw new Error(sysLogError("Failed to read user message from Api because it was empty"));

                const userMessageUnionWrapper = UserMessageUnionWrapperProto.getRootAsUserMessageUnionWrapperProto(new ByteBuffer(userMessageWrapperBytes!));

                switch (userMessageUnionWrapper.valueType()) {
                    case UserMessageUnionProto.DataUpdateMessageProto: {
                        serviceRegistry.validateServiceTarget(serviceKey, otherServiceKey, "an object update");
                        const update = new DataUpdateMessageProto();
                        if (userMessageUnionWrapper.value(update)) {
                            return updateHandler(logContext, serviceKey, update);
                        } else {
                            throw new Error(sysLogError("Failed to read service object update because it contained invalid data"));
                        }
                    }
                    case UserMessageUnionProto.EventMessageProto: {
                        serviceRegistry.validateServiceTarget(serviceKey, otherServiceKey, "an event");
                        const event = new EventMessageProto();
                        if (userMessageUnionWrapper.value(event)) {
                            return eventMessageHandler(logContext, serviceKey, event);
                        } else {
                            throw new Error(sysLogError("Failed to read event because it contained invalid data"));
                        }
                    }
                    case UserMessageUnionProto.NONE:
                        throw new Error(sysLogError(`Message contained an invalid message type`));
                }
            }));
    }
}

function logSend(logContext: string, method: string) {
    logDebug(logContext, `Calling "${method}"`);
}

function logReceive<T extends OkResponseType>(logContext: string, method: string, userResponse: UserResponse<T>) {
    if (userResponse.response) {
        const messageCount = userResponse.messages ? userResponse.messages.length : 0;
        logVerbose(logContext, `Received: ${method} OK with ${messageCount} messages`);
    } else if (userResponse.platformException) {
        let msg = `Received: PlatformError ${userResponse.platformException.codeString}`;
        if(userResponse.platformException.when) {
            msg += ` when ${userResponse.platformException.when}`;
        }
        logError(logContext, msg);
    } else if (userResponse.exception) {
        const scriptException = userResponse.exception;
        logError(logContext, `Received: ScriptException "${scriptException.message}" at ${scriptException.stack}`);
    }
}

export class ApiClient {
    private readonly _outerspaceClientFactory: OuterspaceClientFactory;
    private _outerspaceClient: OuterspaceClient | null;

    constructor(
        private readonly messageTracing: boolean,
        private readonly requestFactory: RequestFactory,
        private readonly responseReader: ResponseReader,
        private readonly outerspaceClientFactory: OuterspaceClientFactory
    ) {
        requiresTruthy('requestFactory', requestFactory);
        requiresTruthy('responseReader', responseReader);
        requiresTruthy('outerspaceClientFactory', outerspaceClientFactory);
        this._outerspaceClientFactory = outerspaceClientFactory;
        this._outerspaceClient = null;
    }

    shutdown() {
        if (this._outerspaceClient)
            this._outerspaceClient.shutdown();
    }

    private async getOuterspaceClient(): Promise<OuterspaceClient> {
        if (this._outerspaceClient && this._outerspaceClient.isReady())
            return this._outerspaceClient;
        this._outerspaceClient = await this._outerspaceClientFactory.create();
        return this._outerspaceClient;
    }

    async getData(logContext: string, dataKey: DataKey): Promise<UserResponse<GetDataResponseProto>> {
        const _ = `getData ${dataKey.getFullyQualifiedName()}`;
        requiresTruthy('dataKey', dataKey);
        if (this.messageTracing)
            logSend(logContext, _);
        const requestBuffer = this.requestFactory.createGetDataRequest(logContext, dataKey);
        const outerspaceClient = await this.getOuterspaceClient();
        const responseBuffer = await outerspaceClient.sendRequest(logContext, requestBuffer);
        const response = this.responseReader.readResponse<GetDataResponseProto>(logContext, responseBuffer,
            UserResponseUnionProto.GetDataResponseProto, GetDataResponseProto, false);
        if (this.messageTracing)
            logReceive<GetDataResponseProto>(logContext, _, response);
        return response;
    };

    async callMethod(logContext: string, endpointKey: EndpointKey, methodId: MethodId, args: any[]): Promise<UserResponse<CallMethodResponseProto>> {
        const _ = `callMethod ${endpointKey.getFullyQualifiedName()} methodId:${methodId} args:${JSON.stringify(args)}`;
        if (this.messageTracing)
            logSend(logContext, _);
        const requestBuffer = this.requestFactory.createCallMethodRequest(logContext, endpointKey, methodId, args);
        const outerspaceClient = await this.getOuterspaceClient();
        const responseBuffer = await outerspaceClient.sendRequest(logContext, requestBuffer);
        const response = this.responseReader.readResponse<CallMethodResponseProto>(logContext, responseBuffer,
            UserResponseUnionProto.CallMethodResponseProto, CallMethodResponseProto, true);
        if (this.messageTracing)
            logReceive<CallMethodResponseProto>(logContext, _, response);
        return response;
    };

    async saveData(logContext: string, data: Data[]): Promise<UserResponse<SaveDataResponseProto>> {
        const _ = 'saveData';
        if (this.messageTracing)
            logSend(logContext, _);
        const requestBuffer = this.requestFactory.createSaveDataRequest(logContext, data);
        const outerspaceClient = await this.getOuterspaceClient();
        const responseBuffer = await outerspaceClient.sendRequest(logContext, requestBuffer);
        const response = this.responseReader.readResponse<SaveDataResponseProto>(logContext, responseBuffer,
            UserResponseUnionProto.SaveDataResponseProto, SaveDataResponseProto, true);
        if (this.messageTracing)
            logReceive<SaveDataResponseProto>(logContext, _, response);
        return response;
    };

    async subscribeEvent(logContext: string, eventInstanceKey: EventInstanceKey): Promise<UserResponse<SubscribeEventResponseProto>> {
        const _ = 'subscribeEvent';
        if (this.messageTracing)
            logSend(logContext, _);
        const requestBuffer = this.requestFactory.createSubscribeEventRequest(logContext, eventInstanceKey);
        const outerspaceClient = await this.getOuterspaceClient();
        const responseBuffer = await outerspaceClient.sendRequest(logContext, requestBuffer);
        const response = this.responseReader.readResponse<SubscribeEventResponseProto>(logContext, responseBuffer,
            UserResponseUnionProto.SubscribeEventResponseProto, SubscribeEventResponseProto, false);
        if (this.messageTracing)
            logReceive<SubscribeEventResponseProto>(logContext, _, response);
        return response;
    };

    async unsubscribeEvent(logContext: string, eventInstanceKey: EventInstanceKey): Promise<UserResponse<UnsubscribeEventResponseProto>> {
        const _ = 'unsubscribeEvent';
        if (this.messageTracing)
            logSend(logContext, _);
        const requestBuffer = this.requestFactory.createUnsubscribeEventRequest(logContext, eventInstanceKey);
        const outerspaceClient = await this.getOuterspaceClient();
        const responseBuffer = await outerspaceClient.sendRequest(logContext, requestBuffer);
        const response = this.responseReader.readResponse<UnsubscribeEventResponseProto>(logContext, responseBuffer,
            UserResponseUnionProto.UnsubscribeEventResponseProto, UnsubscribeEventResponseProto, false);
        if (this.messageTracing)
            logReceive<UnsubscribeEventResponseProto>(logContext, _, response);
        return response;
    };

    async subscribeDataUpdates(logContext: string, dataKeys: DataKey[]): Promise<UserResponse<SubscribeDataUpdatesResponseProto>> {
        const _ = 'subscribeDataUpdates';
        if (this.messageTracing)
            logSend(logContext, _);
        const requestBuffer = this.requestFactory.createSubscribeDataUpdatesRequest(logContext, dataKeys);
        const outerspaceClient = await this.getOuterspaceClient();
        const responseBuffer = await outerspaceClient.sendRequest(logContext, requestBuffer);
        const response = this.responseReader.readResponse<SubscribeDataUpdatesResponseProto>(logContext, responseBuffer,
            UserResponseUnionProto.SubscribeDataUpdatesResponseProto, SubscribeDataUpdatesResponseProto, false);
        if (this.messageTracing)
            logReceive<SubscribeDataUpdatesResponseProto>(logContext, _, response);
        return response;
    };

    async unsubscribeDataUpdates(logContext: string, dataKeys: DataKey[]): Promise<UserResponse<UnsubscribeDataUpdatesResponseProto>> {
        const _ = 'unsubscribeDataUpdates';
        if (this.messageTracing)
            logSend(logContext, _);
        const requestBuffer = this.requestFactory.createUnsubscribeDataUpdatesRequest(logContext, dataKeys);
        const outerspaceClient = await this.getOuterspaceClient();
        const responseBuffer = await outerspaceClient.sendRequest(logContext, requestBuffer);
        const response = this.responseReader.readResponse<UnsubscribeDataUpdatesResponseProto>(logContext, responseBuffer,
            UserResponseUnionProto.UnsubscribeDataUpdatesResponseProto, UnsubscribeDataUpdatesResponseProto, false);
        if (this.messageTracing)
            logReceive<UnsubscribeDataUpdatesResponseProto>(logContext, _, response);
        return response;
    };
}
