import {
    KeyMap,
    EventClassKey,
    EventClassRegistration,
    ServiceIdString,
    ServiceKey,
    DataClassKey,
    DataClassRegistration,
    ServiceRegistration,
    EndpointClassKey,
    EndpointClassRegistration,
    EndpointKey,
    ClassId,
    DataKey,
    SessionClassKey,
    SessionClassRegistration,
    SessionKey
} from "../internal-model-types.js";
import {sysLogError} from "./logging.js";
import {requiresFalsy, requiresTruthy} from "./requires.js";
import {
    Data,
    Endpoint,
    EndpointConstructor,
    Event,
    Session,
    SessionConstructor
} from "../../public/model-types.js";
import {__Data_Primary_Key} from "../symbol.js";

export class TypeRegistry {
    constructor(
                public readonly env: RoliEnvironment,
                public readonly service: ServiceRegistry,
                public readonly endpoint: EndpointRegistry,
                public readonly session: SessionRegistry,
                public readonly data: DataRegistry,
                public readonly event: EventRegistry) {
        requiresTruthy('env', env);
        requiresTruthy('service', service);
        requiresTruthy('endpoint', endpoint);
        requiresTruthy('session', session);
        requiresTruthy('data', data);
        requiresTruthy('event', event);
    }
}

// note: This must match RoliEnvironment in roli/framework/public/tools/src/util/client-generator.ts
interface RoliEnvironment {
    clientChecksum: number;
    apiBaseUrl: string;
    serviceName: string;
    userKey: string;
    serviceIdString: string;
    serviceVersionString: string;
}

export function parseEnvFromKey(key: string) : RoliEnvironment | null {
    const envJson = atob(key);
    const env = JSON.parse(envJson);
    return env as RoliEnvironment;
}

export class TypeRegistryBuilder {
    private readonly _service: ServiceRegistryBuilder;
    private readonly _endpoint: EndpointRegistryBuilder;
    private readonly _session: SessionRegistryBuilder;
    private readonly _data: DataRegistryBuilder;
    private readonly _event: EventRegistryBuilder;
    private readonly _env: RoliEnvironment;
    private _built: boolean = false;

    constructor(env: RoliEnvironment, clientChecksum: number) {
        requiresTruthy('env', env);
        if(env.clientChecksum !== clientChecksum) {
            throw new Error(sysLogError("Client checksum mismatch. The key provided is for a different code generated client."));
        }
        this._env = env;
        this._service = new ServiceRegistryBuilder();
        this._endpoint = new EndpointRegistryBuilder();
        this._session = new SessionRegistryBuilder();
        this._data = new DataRegistryBuilder();
        this._event = new EventRegistryBuilder();
    }

    registerService(admin: boolean): ServiceKey {
        requiresFalsy("built", this._built);
        const serviceKey = new ServiceKey(BigInt(this._env.serviceIdString), BigInt(this._env.serviceVersionString));
        this._service.register(new ServiceRegistration(this._env.serviceName, serviceKey, admin, this._env.userKey));
        return serviceKey;
    }

    registerEndpoint<T extends Endpoint>(name: string, ctor: EndpointConstructor<T>, serviceKey: ServiceKey, classId: ClassId) {
        requiresFalsy("built", this._built);
        this._endpoint.register(new EndpointClassRegistration(new EndpointClassKey(serviceKey, classId), ctor, name));
    }

    registerSession<T extends Session>(name: string, ctor: SessionConstructor<T>, serviceKey: ServiceKey, classId: ClassId) {
        requiresFalsy("built", this._built);
        this._session.register(new SessionClassRegistration(new SessionClassKey(serviceKey, classId), ctor, name));
    }

    registerData<T extends Data>(name: string, ctor: Function, serviceKey: ServiceKey, classId: ClassId) {
        requiresFalsy("built", this._built);
        this._data.register(new DataClassRegistration(new DataClassKey(serviceKey, classId), ctor, name));
    }

    registerEvent<T extends Event>(name: string, ctor: Function, serviceKey: ServiceKey, classId: ClassId) {
        requiresFalsy("built", this._built);
        this._event.register(new EventClassRegistration(new EventClassKey(serviceKey, classId), ctor, name))
    }

    build(): TypeRegistry {
        requiresFalsy("built", this._built);

        const registry = new TypeRegistry(
            this._env,
            this._service.build(),
            this._endpoint.build(),
            this._session.build(),
            this._data.build(),
            this._event.build());

        this._built = true;

        return registry;
    }
}

class ServiceRegistryBuilder {
    private _serviceIdToServiceKey = new Map<ServiceIdString, ServiceKey>();
    private _serviceKeyToServiceRegistration = new KeyMap<ServiceKey, ServiceRegistration>();
    private _built: boolean = false;

    public register(serviceRegistration: ServiceRegistration) {
        requiresFalsy('built', this._built);
        requiresTruthy('serviceRegistration', serviceRegistration);

        if (this._serviceKeyToServiceRegistration!.has(serviceRegistration.serviceKey))
            throw new Error(sysLogError(`Cannot re-register service ${serviceRegistration.serviceKey.value} aka '${serviceRegistration.name}'`));
        if (this._serviceIdToServiceKey!.has(serviceRegistration.serviceKey.serviceId.toString()))
            throw new Error(sysLogError(`Failed to register another version of the service '${serviceRegistration.name}`));

        this._serviceKeyToServiceRegistration!.set(serviceRegistration.serviceKey, serviceRegistration);
        this._serviceIdToServiceKey!.set(serviceRegistration.serviceKey.serviceId.toString(), serviceRegistration.serviceKey);
    }

    build(): ServiceRegistry {
        requiresFalsy('built', this._built);

        const registry = new ServiceRegistry(this._serviceIdToServiceKey,
            this._serviceKeyToServiceRegistration);

        // @ts-ignore
        this._serviceIdToServiceKey = null;

        // @ts-ignore
        this._serviceKeyToServiceRegistration = null;

        this._built = true;

        return registry;
    }
}

class DataRegistryBuilder {
    private _classKeyToClassRegistration = new KeyMap<DataClassKey, DataClassRegistration>();
    private _ctorToClassKey = new Map<Function, DataClassKey>();
    private _built: boolean = false;

    public register(classRegistration: DataClassRegistration) {
        requiresFalsy('built', this._built);
        requiresTruthy('classRegistration', classRegistration);
        if (this._classKeyToClassRegistration.has(classRegistration.classKey))
            throw new Error(`Cannot re-register class ${classRegistration.classKey.value}`);
        this._classKeyToClassRegistration.set(classRegistration.classKey, classRegistration);
        this._ctorToClassKey.set(classRegistration.ctor, classRegistration.classKey);
    }

    public build(): DataRegistry {
        requiresFalsy('built', this._built);

        const registry = new DataRegistry(this._classKeyToClassRegistration, this._ctorToClassKey);

        // @ts-ignore
        this._ctorToClassKey = null;

        // @ts-ignore
        this._classKeyToClassRegistration = null;

        this._built = true;

        return registry;
    }
}

class EndpointRegistryBuilder {
    private _classKeyToClassRegistration = new KeyMap<EndpointClassKey, EndpointClassRegistration>();
    private _ctorToClassKey = new Map<Function, EndpointClassKey>();
    private _built: boolean = false;

    public register(classReg: EndpointClassRegistration) {
        requiresFalsy('built', this._built);
        requiresTruthy('classReg', classReg);
        if (this._classKeyToClassRegistration.has(classReg.classKey))
            throw new Error(`Cannot re-register class ${classReg.classKey.value}`);
        this._classKeyToClassRegistration.set(classReg.classKey, classReg);
        this._ctorToClassKey.set(classReg.ctor, classReg.classKey);
    }

    public build(): EndpointRegistry {
        requiresFalsy('built', this._built);

        const registry = new EndpointRegistry(this._classKeyToClassRegistration, this._ctorToClassKey);

        // @ts-ignore
        this._ctorToClassKey = null;

        // @ts-ignore
        this._classKeyToClassRegistration = null;

        this._built = true;

        return registry;
    }
}

class SessionRegistryBuilder {
    private _classKeyToClassRegistration = new KeyMap<SessionClassKey, SessionClassRegistration>();
    private _ctorToClassKey = new Map<Function, SessionClassKey>();
    private _built: boolean = false;

    public register(classReg: SessionClassRegistration) {
        requiresFalsy('built', this._built);
        requiresTruthy('classReg', classReg);
        if (this._classKeyToClassRegistration.has(classReg.classKey))
            throw new Error(`Cannot re-register class ${classReg.classKey.value}`);
        this._classKeyToClassRegistration.set(classReg.classKey, classReg);
        this._ctorToClassKey.set(classReg.ctor, classReg.classKey);
    }

    public build(): SessionRegistry {
        requiresFalsy('built', this._built);

        const registry = new SessionRegistry(this._classKeyToClassRegistration, this._ctorToClassKey);

        // @ts-ignore
        this._ctorToClassKey = null;

        // @ts-ignore
        this._classKeyToClassRegistration = null;

        this._built = true;

        return registry;
    }
}

class EventRegistryBuilder {
    private _classKeyToClassRegistration = new KeyMap<EventClassKey, EventClassRegistration>();
    private _ctorToClassKey = new Map<Function, EventClassKey>();
    private _built: boolean = false;

    public register(classReg: EventClassRegistration) {
        requiresFalsy('built', this._built);
        requiresTruthy('classReg', classReg);
        if (this._classKeyToClassRegistration.has(classReg.classKey))
            throw new Error(`Cannot re-register class ${classReg.classKey.value}`);
        this._classKeyToClassRegistration.set(classReg.classKey, classReg);
        this._ctorToClassKey.set(classReg.ctor, classReg.classKey);
    }

    build(): EventRegistry {
        requiresFalsy('built', this._built);

        const registry = new EventRegistry(this._classKeyToClassRegistration, this._ctorToClassKey);

        // @ts-ignore
        this._classKeyToClassRegistration = null;

        // @ts-ignore
        this._ctorToClassKey = null;

        this._built = true;

        return registry;
    }
}

export class ServiceRegistry {
    private readonly _serviceIdToServiceKey: Map<ServiceIdString, ServiceKey>;
    private readonly _serviceKeyToServiceRegistration: KeyMap<ServiceKey, ServiceRegistration>;

    constructor(serviceIdToServiceKey: Map<ServiceIdString, ServiceKey>,
                serviceKeyToServiceRegistration: KeyMap<ServiceKey, ServiceRegistration>) {
        requiresTruthy('serviceIdToServiceKey', serviceIdToServiceKey);
        requiresTruthy('serviceKeyToServiceRegistration', serviceKeyToServiceRegistration);
        this._serviceIdToServiceKey = serviceIdToServiceKey;
        this._serviceKeyToServiceRegistration = serviceKeyToServiceRegistration;
    }

    public isRegistered(serviceKey: ServiceKey): boolean {
        return this._serviceKeyToServiceRegistration.has(serviceKey);
    }

    public getAuth(serviceKey: ServiceKey): [authKey: string, admin: boolean] {
        requiresTruthy('serviceKey', serviceKey);
        const reg = this._serviceKeyToServiceRegistration.get(serviceKey);
        return [reg.authKey, reg.admin];
    }

    public getName(serviceKey: ServiceKey): string {
        requiresTruthy('serviceKey', serviceKey);
        return this._serviceKeyToServiceRegistration.get(serviceKey).name;
    }

    public tryGetServiceKeyByServiceId(serviceId: bigint): ServiceKey | undefined {
        requiresTruthy('serviceId', serviceId);
        return this._serviceIdToServiceKey.get(serviceId.toString());
    }

    public validateServiceTarget(expected: ServiceKey, other: ServiceKey, what: string) {
        requiresTruthy('expected', expected);
        requiresTruthy('other', other);

        if (expected.equals(other))
            return; //OK

        if (expected.serviceId === other.serviceId) {
            //the version has changed, making this client incompatible.
            const service_name = this.getName(expected);
            throw new Error(sysLogError(`The service client for ${service_name} is out of date and must be re-generated. Debug: ${expected.value} !== ${other.value}`));
        }

        if (this.isRegistered(other)) {
            //data meant for a different service (roli programming error)
            const service_name = this.getName(expected);
            const other_service_name = this.getName(other);
            throw new Error(sysLogError(`Unexpectedly received ${what} destined for the service ${other_service_name} when ${service_name} was expected.`));
        }

        const maybe_other_service_key = this.tryGetServiceKeyByServiceId(other.serviceId);
        if (!maybe_other_service_key) {
            //totally unknown service, not quite sure how this could happen.
            throw new Error(sysLogError(`Unexpectedly received ${what} destined for unknown service ${other.value}.`));
        }

        const other_service_name = this.getName(maybe_other_service_key);
        //if the event was destined for a different service and that service's version is different from what's registered with this client
        throw new Error(sysLogError(`Unexpectedly received ${what} destined for the service ${other_service_name}.`));
    }
}

export class DataRegistry {
    private readonly _classKeyToClassRegistration: KeyMap<DataClassKey, DataClassRegistration>;
    private readonly _ctorToClassKey: Map<Function, DataClassKey>;

    constructor(classKeyToClassRegistration: KeyMap<DataClassKey, DataClassRegistration>,
                ctorToClassKey: Map<Function, DataClassKey>) {

        requiresTruthy('classKeyToClassRegistration', classKeyToClassRegistration);
        requiresTruthy('ctorToClassKey', ctorToClassKey);

        this._classKeyToClassRegistration = classKeyToClassRegistration;
        this._ctorToClassKey = ctorToClassKey;
    }

    public createInstance(dataKey: DataKey): Data {
        requiresTruthy('objectKey', dataKey);

        const ctor = this.getCtor(dataKey.classKey);

        const object = {
            [__Data_Primary_Key]: dataKey.primaryKey
        };

        if (!Reflect.setPrototypeOf(object, ctor.prototype))
            throw new Error(sysLogError(`Failed to set the prototype of ${dataKey.classKey.getFullyQualifiedName()}`));

        return <Data>object;
    }

    public getClassKey(ctor: Function): DataClassKey {
        const classKey = this._ctorToClassKey.get(ctor);
        if (!classKey)
            throw new Error("Data class key not found for constructor, the type has not been registered.");
        return classKey!;
    }

    public getDataRegistration(dataClassKey: DataClassKey): DataClassRegistration {
        return this._classKeyToClassRegistration.get(dataClassKey);
    }

    public getCtor(dataClassKey: DataClassKey): any {
        const class_reg = this.getDataRegistration(dataClassKey);
        return class_reg.ctor;
    }

    public getName(dataClassKey: DataClassKey) {
        return this._classKeyToClassRegistration.get(dataClassKey).name;
    }
}

export class SessionRegistry {
    private readonly _classKeyToClassRegistration: KeyMap<SessionClassKey, SessionClassRegistration>;
    private readonly _ctorToClassKey: Map<Function, SessionClassKey>;

    constructor(classKeyToClassRegistration: KeyMap<SessionClassKey, SessionClassRegistration>,
                ctorToClassKey: Map<Function, SessionClassKey>) {
        requiresTruthy('classKeyToClassRegistration', classKeyToClassRegistration);
        requiresTruthy('ctorToClassKey', ctorToClassKey);
        this._ctorToClassKey = ctorToClassKey;
        this._classKeyToClassRegistration = classKeyToClassRegistration;
    }

    public isRegistered(ctor: Function): boolean {
        return this._ctorToClassKey.has(ctor);
    }

    public getClassKey(ctor: Function): SessionClassKey {
        const classKey = this._ctorToClassKey.get(ctor);
        if (!classKey)
            throw new Error("Session class key not found for constructor, the type has not been registered.");
        return classKey!;
    }

    public getRegistration(classKey: SessionClassKey): SessionClassRegistration {
        return this._classKeyToClassRegistration.get(classKey);
    }

    public getCtor(classKey: SessionClassKey): Function {
        const classRegistration = this.getRegistration(classKey);
        return classRegistration.ctor;
    }

    public createInstance(sessionKey: SessionKey) {
        const ctor = <SessionConstructor<Session>>this.getCtor(sessionKey.classKey);
        return new ctor(sessionKey.primaryKey);
    }

    public getName(classKey: SessionClassKey): string {
        return this._classKeyToClassRegistration.get(classKey).name;
    }
}

export class EndpointRegistry {
    private readonly _classKeyToClassRegistration: KeyMap<EndpointClassKey, EndpointClassRegistration>;
    private readonly _ctorToClassKey: Map<Function, EndpointClassKey>;

    constructor(classKeyToClassRegistration: KeyMap<EndpointClassKey, EndpointClassRegistration>,
                ctorToClassKey: Map<Function, EndpointClassKey>) {
        requiresTruthy('classKeyToClassRegistration', classKeyToClassRegistration);
        requiresTruthy('ctorToClassKey', ctorToClassKey);
        this._ctorToClassKey = ctorToClassKey;
        this._classKeyToClassRegistration = classKeyToClassRegistration;
    }

    public isRegistered(ctor: Function): boolean {
        return this._ctorToClassKey.has(ctor);
    }

    public getClassKey(ctor: Function): EndpointClassKey {
        const classKey = this._ctorToClassKey.get(ctor);
        if (!classKey)
            throw new Error(`Endpoint class key not found for constructor ${ctor.name}, the type has not been registered.`);
        return classKey!;
    }

    public getRegistration(classKey: EndpointClassKey): EndpointClassRegistration {
        return this._classKeyToClassRegistration.get(classKey);
    }

    public getCtor(classKey: EndpointClassKey): Function {
        const classRegistration = this.getRegistration(classKey);
        return classRegistration.ctor;
    }

    public createInstance(endpointKey: EndpointKey) {
        const ctor = <EndpointConstructor<Endpoint>>this.getCtor(endpointKey.classKey);
        return new ctor(endpointKey.primaryKey);
    }

    public getName(classKey: EndpointClassKey): string {
        return this._classKeyToClassRegistration.get(classKey).name;
    }
}

export class EventRegistry {
    private _classKeyToClassRegistration: KeyMap<EventClassKey, EventClassRegistration>;
    private _ctorToClassKey: Map<Function, EventClassKey>;

    constructor(classKeyToClassRegistration: KeyMap<EventClassKey, EventClassRegistration>,
                ctorToClassKey: Map<Function, EventClassKey>) {
        requiresTruthy('classKeyToClassRegistration', classKeyToClassRegistration);
        requiresTruthy('ctorToClassKey', ctorToClassKey);
        this._classKeyToClassRegistration = classKeyToClassRegistration;
        this._ctorToClassKey = ctorToClassKey;
    }

    public createInstance(eventClassKey: EventClassKey): Event {
        requiresTruthy('classKey', eventClassKey);
        const ctor = this.getCtor(eventClassKey);

        const event = {};

        if (!Reflect.setPrototypeOf(event, ctor.prototype))
            throw new Error(sysLogError(`Failed to set the prototype of ${eventClassKey.getFullyQualifiedName()}`));

        return <Event>event;
    }

    public isRegistered(ctor: Function): boolean {
        return this._ctorToClassKey.has(ctor);
    }

    public getClassKey(ctor: Function): EventClassKey {
        const classKey = this._ctorToClassKey.get(ctor);
        if (!classKey) {
            throw new Error("Event class key not found for constructor, the type has not been registered.");
        }
        return classKey!;
    }

    public getRegistration(classKey: EventClassKey): EventClassRegistration {
        return this._classKeyToClassRegistration.get(classKey);
    }

    public getCtor(classKey: EventClassKey): Function {
        const classRegistration = this.getRegistration(classKey);
        return classRegistration.ctor;
    }

    public getName(classKey: EventClassKey): string {
        return this._classKeyToClassRegistration.get(classKey).name;
    }
}