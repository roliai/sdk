import {Unsigned} from "./util/unsigned.js";
import {requiresPositiveUnsigned, requiresTruthy} from "./util/requires.js";
import {sysLogError} from "./util/logging.js";
import {Code} from "./code.js";

import {CallMethodResponseProto} from "./protocol/call-method-response-proto.js";
import {SaveDataResponseProto} from "./protocol/save-data-response-proto.js";
import {SubscribeEventResponseProto} from "./protocol/subscribe-event-response-proto.js";
import {UnsubscribeDataUpdatesResponseProto} from "./protocol/unsubscribe-data-updates-response-proto.js";
import {UnsubscribeEventResponseProto} from "./protocol/unsubscribe-event-response-proto.js";
import {ConsoleLogProto} from "./protocol/console-log-proto.js";
import {GetDataResponseProto} from "./protocol/get-data-response-proto.js";
import {UserMessageUnionWrapperProto} from "./protocol/user-message-union-wrapper-proto.js";
import {SubscribeDataUpdatesResponseProto} from "./protocol/subscribe-data-updates-response-proto.js";
import {ServiceReferenceUnionProto} from "./protocol/service-reference-union-proto.js";

export type ServiceIdString = string;
export type ServiceVersionString = string;
export type DataVersion = Unsigned;
export type DataKeyString = string;
export type EndpointKeyString = string;
export type SessionKeyString = string;
export type ClassKeyString = string;
export type ServiceKeyString = string;
export type ClassId = number;
export type MethodId = number;

export interface IKey {
    value: string;

    getName(): string;

    getFullyQualifiedName(): string;
}

export class KeySet<TK extends IKey> {
    private _set = new Set<string>();

    public size() {
        return this._set.size;
    }

    public has(key: TK): boolean {
        requiresTruthy('key', key);
        return this._set.has(key.value);
    }

    public add(key: TK): boolean {
        requiresTruthy('key', key);
        if (!this._set.has(key.value)) {
            this._set.add(key.value);
            return true;
        }
        return false;
    }

    public delete(key: TK) {
        requiresTruthy('key', key);
        this._set.delete(key.value);
    }

    public clear() {
        this._set.clear();
    }

    public keys(): IterableIterator<string> {
        return this._set.keys();
    }

    public values(): IterableIterator<string> {
        return this._set.values();
    }
}

export class KeyMap<TK extends IKey, TV> {
    private _map = new Map<string, TV>();

    public size() {
        return this._map.size;
    }

    public get(key: TK): TV {
        requiresTruthy('key', key);
        const value = this._map.get(key.value);
        if (!value) {
            console.log("_map: " + JSON.stringify(this._map));
            throw new Error(sysLogError(`KeyMap: Unable to find value by key ${key.value}`));
        }
        return value;
    }

    public tryGet(key: TK): TV | null {
        requiresTruthy('key', key);
        const value = this._map.get(key.value);
        return value ? value : null;
    }

    public has(key: TK): boolean {
        requiresTruthy('key', key);
        return this._map.has(key.value);
    }

    public trySet(key: TK, value: TV): boolean {
        requiresTruthy('key', key);
        if (!this._map.has(key.value)) {
            this._map.set(key.value, value);
            return true;
        }
        return false;
    }

    public set(key: TK, value: TV) {
        requiresTruthy('key', key);
        this._map.set(key.value, value);
    }

    public delete(key: TK) {
        requiresTruthy('key', key);
        this._map.delete(key.value);
    }

    public clear() {
        this._map.clear();
    }

    public keys(): IterableIterator<string> {
        return this._map.keys();
    }

    public values(): IterableIterator<TV> {
        return this._map.values();
    }
}

export const __ServiceKey_NameGetter = Symbol("Service key name getter");

export class ServiceKey implements IKey {
    public readonly value: ServiceKeyString;

    constructor(public readonly serviceId: Unsigned, public readonly serviceVersion: Unsigned) {
        requiresPositiveUnsigned('serviceId', serviceId);
        requiresPositiveUnsigned('serviceVersion', serviceVersion);
        this.value = `${ServiceKey.name}-${this.serviceId.toString()}@${this.serviceVersion.toString()}`;
    }

    equals(other: ServiceKey): boolean {
        if (!other)
            return false;
        return this.value === other.value;
    }

    getFullyQualifiedName(): string {
        return this.getName();
    }

    static [__ServiceKey_NameGetter]: (arg0: ServiceKey) => string;

    getName(): string {
        return ServiceKey[__ServiceKey_NameGetter](this);
    }
}

export const __DataClassKey_NameGetter = Symbol("Data class key name getter");
export class DataClassKey implements IKey {
    public readonly value: ClassKeyString;

    constructor(public readonly serviceKey: ServiceKey, public readonly classId: ClassId) {
        requiresTruthy('serviceKey', serviceKey);
        requiresTruthy('classId', classId);
        this.value = `${DataClassKey.name}-${serviceKey.value}-${classId}`;
    }

    equals(other: DataClassKey): boolean {
        if (!other)
            return false;
        return this.value === other.value;
    }

    getFullyQualifiedName(): string {
        return `${this.serviceKey.getFullyQualifiedName()}/${this.getName()}`;
    }

    static [__DataClassKey_NameGetter]: (arg0: DataClassKey) => string;

    getName(): string {
        return DataClassKey[__DataClassKey_NameGetter](this);
    }
}

export const __SessionClassKey_NameGetter = Symbol("Session class key name getter");

export class SessionClassKey implements IKey {
    public readonly value: ClassKeyString;

    constructor(public readonly serviceKey: ServiceKey, public readonly classId: ClassId) {
        requiresTruthy('serviceKey', serviceKey);
        requiresTruthy('classId', classId);
        this.value = `${SessionClassKey.name}-${serviceKey.value}-${classId}`;
    }

    equals(other: SessionClassKey): boolean {
        if (!other)
            return false;
        return this.value === other.value;
    }

    getFullyQualifiedName(): string {
        return `${this.serviceKey.getFullyQualifiedName()}/${this.getName()}`;
    }

    static [__SessionClassKey_NameGetter]: (arg0: SessionClassKey) => string;

    getName(): string {
        return SessionClassKey[__SessionClassKey_NameGetter](this);
    }
}

export const __EndpointClassKey_NameGetter = Symbol("Endpoint class key name getter");

export class EndpointClassKey implements IKey {
    public readonly value: ClassKeyString;

    constructor(public readonly serviceKey: ServiceKey, public readonly classId: ClassId) {
        requiresTruthy('serviceKey', serviceKey);
        requiresTruthy('classId', classId);
        this.value = `${EndpointClassKey.name}-${serviceKey.value}-${classId}`;
    }

    equals(other: EndpointClassKey): boolean {
        if (!other)
            return false;
        return this.value === other.value;
    }

    getFullyQualifiedName(): string {
        return `${this.serviceKey.getFullyQualifiedName()}/${this.getName()}`;
    }

    static [__EndpointClassKey_NameGetter]: (arg0: EndpointClassKey) => string;

    getName(): string {
        return EndpointClassKey[__EndpointClassKey_NameGetter](this);
    }
}

export const __EventClassKey_NameGetter = Symbol("Event class key name getter");

export class EventClassKey implements IKey {
    public readonly value: string;

    constructor(public readonly serviceKey: ServiceKey, public readonly classId: ClassId) {
        requiresTruthy('serviceKey', serviceKey);
        requiresTruthy('classId', classId);
        this.value = `${EventClassKey.name}-${serviceKey.value}-${classId}`;
    }

    equals(other: EventClassKey): boolean {
        if (!other)
            return false;
        return this.value === other.value;
    }

    getFullyQualifiedName(): string {
        return `${this.serviceKey.getFullyQualifiedName()}/${this.getName()}`;
    }

    static [__EventClassKey_NameGetter]: (arg0: EventClassKey) => string;

    getName(): string {
        return EventClassKey[__EventClassKey_NameGetter](this);
    }
}

export class DataKey implements IKey {
    public readonly value: DataKeyString;

    constructor(public readonly classKey: DataClassKey, public readonly primaryKey: string) {
        requiresTruthy('classKey', classKey);
        requiresTruthy('primaryKey', primaryKey);
        this.value = `${DataKey.name}-${classKey.value}-${primaryKey}`;
    }

    equals(other: DataKey): boolean {
        if (!other)
            return false;
        return this.value === other.value;
    }

    getFullyQualifiedName(): string {
        return `${this.classKey.getFullyQualifiedName()}#${this.primaryKey}`;
    }

    getName(): string {
        return `${this.classKey.getName()}#${this.primaryKey}`;
    }
}

export class SessionKey implements IKey {
    public readonly value: SessionKeyString;

    constructor(public readonly classKey: SessionClassKey, public readonly primaryKey: string) {
        requiresTruthy('classKey', classKey);
        requiresTruthy('primaryKey', primaryKey);
        this.value = `${SessionKey.name}-${classKey.value}-${primaryKey}`;
    }

    equals(other: SessionKey): boolean {
        if (!other)
            return false;
        return this.value === other.value;
    }

    getFullyQualifiedName(): string {
        return `${this.classKey.getFullyQualifiedName()}#${this.primaryKey}`;
    }

    getName(): string {
        return `${this.classKey.getName()}#${this.primaryKey}`;
    }
}

export class EndpointKey implements IKey {
    public readonly value: EndpointKeyString;

    constructor(public readonly classKey: EndpointClassKey, public readonly primaryKey: string) {
        requiresTruthy('classKey', classKey);
        requiresTruthy('primaryKey', primaryKey);
        this.value = `${EndpointKey.name}-${classKey.value}-${primaryKey}`;
    }

    equals(other: EndpointKey): boolean {
        if (!other)
            return false;
        return this.value === other.value;
    }

    getFullyQualifiedName(): string {
        return `${this.classKey.getFullyQualifiedName()}#${this.primaryKey}`;
    }

    getName(): string {
        return `${this.classKey.getName()}#${this.primaryKey}`;
    }
}

export type EventSourceKey = DataKey | EndpointKey;

export class EventInstanceKey implements IKey {
    public readonly value: string;

    constructor(public readonly eventClassKey: EventClassKey,
                public readonly sourceKey: EventSourceKey) {
        requiresTruthy('eventClassKey', eventClassKey);
        requiresTruthy('sourceKey', sourceKey);
        this.value = `${EventInstanceKey.name}-${eventClassKey.value}-${sourceKey.value}`;
    }

    equals(other: EventClassKey): boolean {
        if (!other)
            return false;
        return this.value === other.value;
    }

    getFullyQualifiedName(): string {
        return `${this.eventClassKey.getFullyQualifiedName()}/${this.getName()}`;
    }

    getName(): string {
        return `${this.sourceKey.getName()}`
    }

    getSourceServiceReferenceUnionProto(): ServiceReferenceUnionProto {
        if (this.sourceKey instanceof DataKey)
            return ServiceReferenceUnionProto.DataReferenceValueProto;
        else
            return ServiceReferenceUnionProto.EndpointReferenceValueProto;
    }
}

export class ServiceRegistration {
    constructor(public readonly name: string,
                public readonly serviceKey: ServiceKey,
                public readonly admin: boolean,
                public readonly authKey: string) {
        requiresTruthy('name', name);
        requiresTruthy('serviceKey', serviceKey);
        requiresTruthy('authKey', authKey);
    }
}

export class DataClassRegistration {
    constructor(public readonly classKey: DataClassKey,
                public readonly ctor: Function,
                public readonly name: string) {
        if (!ctor || typeof ctor !== 'function')
            throw new Error('invalid ctor');
        requiresTruthy('classKey', classKey);
        requiresTruthy('name', name);
    }
}

export class SessionClassRegistration {
    constructor(public readonly classKey: SessionClassKey,
                public readonly ctor: Function,
                public readonly name: string) {
        if (!ctor || typeof ctor !== 'function')
            throw new Error('invalid ctor');
        requiresTruthy('classKey', classKey);
        requiresTruthy('name', name);
    }
}

export class EndpointClassRegistration {
    constructor(public readonly classKey: EndpointClassKey,
                public readonly ctor: Function,
                public readonly name: string) {
        if (!ctor || typeof ctor !== 'function')
            throw new Error('invalid ctor');
        requiresTruthy('classKey', classKey);
        requiresTruthy('name', name);
    }
}

export class EventClassRegistration {
    constructor(public readonly classKey: EventClassKey,
                public readonly ctor: Function,
                public readonly name: string) {
        if (!ctor || typeof ctor !== 'function')
            throw new Error('invalid ctor');
        requiresTruthy('classKey', classKey);
        requiresTruthy('name', name);
    }
}

export type OkResponseType = CallMethodResponseProto |
    GetDataResponseProto |
    SaveDataResponseProto |
    SubscribeEventResponseProto |
    SubscribeDataUpdatesResponseProto |
    UnsubscribeEventResponseProto |
    UnsubscribeDataUpdatesResponseProto;


export class PlatformException {
    constructor(public code: Code,
                public codeString: string,
                public when: string | null) {
        requiresTruthy('code', code);
        requiresTruthy('codeString', codeString);
    }
}

export class ScriptException {
    constructor(public readonly stack: string,
                public readonly message: string) {
        requiresTruthy('stack', stack);
        requiresTruthy('message', message);
    }
}

export class UserResponse<T extends OkResponseType> {
    constructor(public readonly platformException: PlatformException | undefined,
                public readonly exception: ScriptException | undefined,
                public readonly response: T | undefined,
                public readonly messages: UserMessageUnionWrapperProto[] | undefined,
                public readonly consoleLog: ConsoleLogProto | undefined) {
    }

    static createOk<T extends OkResponseType>(response: T, messages: UserMessageUnionWrapperProto[] | undefined, consoleLog: ConsoleLogProto | undefined): UserResponse<T> {
        return new UserResponse<T>(undefined, undefined, response, messages, consoleLog);
    }

    static createScriptException<T extends OkResponseType>(exception: ScriptException, consoleLog: ConsoleLogProto | undefined): UserResponse<T> {
        return new UserResponse<T>(undefined, exception, undefined, undefined, consoleLog);
    }

    static createPlatformException<T extends OkResponseType>(platformException: PlatformException, consoleLog: ConsoleLogProto | undefined): UserResponse<T> {
        return new UserResponse<T>(platformException, undefined, undefined, undefined, consoleLog);
    }
}
