import __ws, {ICloseEvent, w3cwebsocket} from "websocket";
const {w3cwebsocket: W3CWebSocket} = __ws;
import {requiresTruthy} from "../util/requires.js"
import {logError, sysLogError, sysLogVerbose, sysLogWarn} from "../util/logging.js";

type Resolver<T> = (value: T | PromiseLike<T>) => void;
type Rejecter = (reason?: any) => void;

const HEADER_SIZE_BYTES = 8;

enum SendKind {
    Invalid = 0,
    Response = 1,
    Message = 2
}

class ResponseExecutor {
    resolve: Resolver<ArrayBuffer>;
    reject: Rejecter;

    constructor(resolver: Resolver<ArrayBuffer>, rejecter: Rejecter) {
        requiresTruthy('resolver', resolver);
        requiresTruthy('rejecter', rejecter);
        this.resolve = resolver;
        this.reject = rejecter;
    }
}

interface IMessageHandler {
    (messageBuffer: ArrayBuffer) : Promise<void>
}

export class OuterspaceClientFactory {
    constructor(private readonly baseUrl: string,
        private readonly admin: boolean,        
        private readonly authKey: string,
        private readonly accessToken: string | null,
        private readonly messageHandler: IMessageHandler) {
        requiresTruthy('baseUrl', baseUrl);
        requiresTruthy('authKey', authKey);
        requiresTruthy('messageHandler', messageHandler);
    }
    public async create() : Promise<OuterspaceClient> {
        let url = new URL(this.baseUrl);
        if(url.protocol === "http:") {
            url.protocol = "ws:";
        }
        else if(url.protocol === "https:") {
            url.protocol = "wss:";
        }
        let wsUrl = `${url.toString()}?${this.admin ? 'admn_key' : 'user_key'}=${this.authKey}`;
        return new Promise<OuterspaceClient>((resolve, reject) => {
            const headers = {};

            let connection: w3cwebsocket;
            if(this.accessToken) {
                connection = new W3CWebSocket(wsUrl, this.accessToken);
            } else {
                connection = new W3CWebSocket(wsUrl);
            }

            //This says this should work in the browser.
            // https://hpbn.co/websocket/#wsab
            connection.binaryType = 'arraybuffer';

            connection.onerror = (e: Error) => {
                console.error(`W3CWebSocket connection error: ${e.name}\nmessage:${e.message}\nstack:${e.stack}`);
            };
            connection.onclose = (event) => {
                reject(event.reason);
            };
            connection.onopen = () => {
                resolve(new OuterspaceClient(connection, this.messageHandler));
            };
        });
    }
}

export class OuterspaceClient {
    private _nextRequestId: number;
    private _isOpen: boolean = true;
    private readonly _waitingRequests: Map<number, ResponseExecutor>;
    private readonly _connection: any;
    private readonly _messageHandler: IMessageHandler;

    constructor(connection: any,
                messageHandler: IMessageHandler) {
        requiresTruthy('connection', connection);
        requiresTruthy('messageHandler', messageHandler);

        connection.binaryType = 'arraybuffer';
        connection.onerror = this.onError;
        connection.onclose = this.onClose;
        connection.onopen = this.onOpen;
        connection.onmessage = this.onMessage;

        this._messageHandler = messageHandler;
        this._connection = connection;
        this._nextRequestId = 1;
        this._waitingRequests = new Map<number, ResponseExecutor>();
    }

    public shutdown() {
        if (this._isOpen)
            this._connection.close();
    }

    public sendRequest(logContext: string, request: Uint8Array): Promise<ArrayBuffer> {
        requiresTruthy('request', request);

        if (!this._isOpen)
            return Promise.reject(new Error(logError(logContext, "Unable to send because the connection has been closed")));

        let [buffer, requestId] = this.bundleRequest(request);

        if (!this.isReady()) {
            return Promise.reject(new Error(logError(logContext, "Unable to send because the underlying WebSocket connection wasn't ready")));
        }

        return new Promise<ArrayBuffer>((resolve, reject) => {
            this._waitingRequests.set(requestId, new ResponseExecutor(resolve, reject));
            this._connection.send(buffer);
        });
    }

    private bundleRequest(request: Uint8Array): [ArrayBuffer, number] {
        requiresTruthy('request', request);

        let buffer = new ArrayBuffer(HEADER_SIZE_BYTES + request.byteLength);

        let requestId = this._nextRequestId++;

        //write the header
        let headerView = new Uint32Array(buffer);
        headerView[0] = requestId;
        headerView[1] = request.byteLength;

        //write the payload
        let payloadView = new Uint8Array(buffer);
        payloadView.set(request, HEADER_SIZE_BYTES);
        return [buffer, requestId];
    }

    private static parseHeader(buffer: ArrayBuffer): [number, SendKind, number] {
        requiresTruthy('buffer', buffer);

        let view = new DataView(buffer);
        let requestId = view.getUint32(0, true);
        let sendKind = view.getUint8(4);
        return [requestId, sendKind, 5];
    }

    private handleResponse(requestId: number, payloadBuffer: ArrayBuffer) {
        let executor = this._waitingRequests.get(requestId);
        if (!executor) {
            sysLogWarn(`Received response with request id ${requestId} the client didn't know about`);
            return;
        }
        this._waitingRequests.delete(requestId);
        executor.resolve(payloadBuffer); //resolve the promise returned by the send_request method
    }

    public isReady(): boolean {
        return this._connection.readyState === this._connection.OPEN;
    }

    private onMessage = (message: any) => {
        if (!message.data) {
            throw new Error(sysLogError("Empty message received from Roli"));
        } else {
            if (message.data instanceof ArrayBuffer) {
                //node.js
                let arrayBuffer = <ArrayBuffer>message.data;
                let [requestId, sendKind, payloadOffset] = OuterspaceClient.parseHeader(arrayBuffer);
                let payloadBuffer = arrayBuffer.slice(payloadOffset);
                switch (sendKind) {
                    case SendKind.Invalid:
                        throw new Error(sysLogError("Invalid message received from Roli: invalid SendKind value"));
                    case SendKind.Response:
                        this.handleResponse(requestId, payloadBuffer);
                        break;
                    case SendKind.Message:
                        this._messageHandler(payloadBuffer)
                            .then(() => {}) //not sure I need this.
                            .catch(reason => {
                                throw new Error(sysLogError(`Uncaught exception in message handler callback: ${reason}`))
                            });
                        break;
                    default:
                        throw new Error(sysLogError("Invalid message received from Roli: unknown SendKind value"));
                }
            } else {
                throw new Error(sysLogError("Invalid message received from Roli"));
            }
        }
    };

    private onOpen() {
        sysLogVerbose("Connection opened");
    }

    private onError(error: Error) {
        sysLogError(`An error occurred with the underlying WebSocket connection.\n
        name: ${error ? error.name : "<none>"}
        message: ${error ? error.message : "<none>"}
        stack: ${error ? error.stack : "<none>"}`);
    }

    private onClose(event: ICloseEvent) {
        const reason = event ? event.reason : "<none>";
        const code = event ? event.code : "<none>";

        if (event.wasClean) {
            sysLogVerbose(`Connection closed cleanly. Reason: ${reason} Code: ${code}`);
        } else {
            sysLogWarn(`Connection closed. Reason: ${reason} Code: ${code}`);
        }
    }
}