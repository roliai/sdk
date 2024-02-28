import {requiresTruthy} from "./requires";
import {ServiceIndexProto} from "../protocol/service-index-proto";
import {ByteBuffer} from "flatbuffers";

export function deserializeServiceIndex(serviceIndexStr: string): ServiceIndexProto {
    requiresTruthy('serviceIndexStr', serviceIndexStr);

    let b = Buffer.from(serviceIndexStr, 'base64');
    let c = new ByteBuffer(b);

    return ServiceIndexProto.getRootAsServiceIndexProto(c);
}