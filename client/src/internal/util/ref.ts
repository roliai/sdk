import {WEAK_DATA_REF_ENABLED} from "../config.js";

class Ref<T extends object> {
    constructor(private readonly value: T) {
    }

    deref(): T {
        return this.value;
    }
}

// @ts-ignore
export declare type RefShim<T extends object> = Ref<T> | WeakRef<T>;

export function createRef<T extends object>(o: T): RefShim<T> {
    if (WEAK_DATA_REF_ENABLED && typeof WeakRef !== "undefined") {
        // @ts-ignore
        return new WeakRef(o);
    } else {
        return new Ref(o);
    }
}