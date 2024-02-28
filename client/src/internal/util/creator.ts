import {TypeRegistry} from "./registry.js";
import {ServiceOptions} from "../../public/service-options.js";
import {requiresTruthy} from "./requires.js";
import {DataContext, EventContext, ServiceContext} from "./context.js";
import {RequestFactory, ResponseReader} from "./serde.js";
import {ApiClientFactory} from "../service/api-client.js";
import {TrackerFactory} from "./tracker.js";
import {Data, Endpoint, Session} from "../../public/model-types.js";
import {
    __Data_Context_Key,
    __Data_Registry_Key,
    __Endpoint_InternalClient_Key,
    __Session_InternalClient_Key
} from "../symbol.js";
import {
    __DataClassKey_NameGetter, __EventClassKey_NameGetter,
    __ServiceKey_NameGetter, __EndpointClassKey_NameGetter,
    DataClassKey, EventClassKey,
    ServiceKey,
    EndpointClassKey, SessionClassKey, __SessionClassKey_NameGetter
} from "../internal-model-types.js";
import {setEnableVerboseLogging, setLogHeader} from "./logging.js";
import {RoliClient, InternalClient} from "../../public/client.js";

export function internalCreateClient(
    typeRegistry: TypeRegistry,
    apiBaseUrl: string,
    options: ServiceOptions = new ServiceOptions()
): RoliClient {
    requiresTruthy('typeRegistry', typeRegistry);

    if (!options)
        options = new ServiceOptions();

    const dataContext = new DataContext();

    const eventContext = new EventContext();

    const requestFactory = new RequestFactory(typeRegistry.data, typeRegistry.endpoint, typeRegistry.session, dataContext);

    const responseReader = new ResponseReader(typeRegistry.endpoint, typeRegistry.session, typeRegistry.data, dataContext);

    const apiClientFactory = new ApiClientFactory(options.enableMessageTracing, typeRegistry.service,
        requestFactory, responseReader, apiBaseUrl);

    const trackerFactory = new TrackerFactory(dataContext, eventContext);

    const serviceContext = new ServiceContext(typeRegistry.service, typeRegistry.event, apiClientFactory,
        trackerFactory, responseReader);

    const internalClient = new InternalClient(serviceContext, typeRegistry.endpoint, typeRegistry.session, typeRegistry.event, responseReader, trackerFactory);

    trackerFactory.internalClient = internalClient;

    Data[__Data_Context_Key] = dataContext;
    Data[__Data_Registry_Key] = typeRegistry.data;
    Endpoint[__Endpoint_InternalClient_Key] = internalClient;
    Session[__Session_InternalClient_Key] = internalClient;
    ServiceKey[__ServiceKey_NameGetter] = (k: ServiceKey) => typeRegistry.service.getName(k);
    DataClassKey[__DataClassKey_NameGetter] = (k: DataClassKey) => typeRegistry.data.getName(k);
    SessionClassKey[__SessionClassKey_NameGetter] = (k: SessionClassKey) => typeRegistry.session.getName(k);
    EndpointClassKey[__EndpointClassKey_NameGetter] = (k: EndpointClassKey) => typeRegistry.endpoint.getName(k);
    EventClassKey[__EventClassKey_NameGetter] = (k: EventClassKey) => typeRegistry.event.getName(k);

    setLogHeader(options.debugLogHeader);
    setEnableVerboseLogging(options.enableVerboseLogging);

    return new RoliClient(options, typeRegistry, serviceContext, dataContext, eventContext, responseReader,
        requestFactory, internalClient, trackerFactory);
}