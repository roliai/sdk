import {Long} from "flatbuffers";

export class Unsigned {
    value: bigint;

    constructor(value: bigint | string) {
        value = BigInt(value);

        if (value < 0)
            throw new Error("invalid negative value");

        this.value = value;
    }

    equals(other: Unsigned): boolean {
        return this.value === other.value;
    }

    toLong(): Long {
        let high = Number((this.value & BigInt(0xFFFFFFFF00000000)) >> BigInt(32));
        let low = Number(this.value & BigInt(0xFFFFFFFF));
        return new Long(low, high);
    }

    toNumber(): number {
        return Number(this.value);
    }

    toString(): string {
        return this.value.toString();
    }

    static fromLong(long: Long): Unsigned {
        const UINT_MAX = 4294967295;

        let high = long.high < 0 ? long.high + UINT_MAX + 1 : long.high;
        let low = long.low < 0 ? long.low + UINT_MAX + 1 : long.low;

        let value = BigInt(BigInt(high) << BigInt(32) | BigInt(low));
        if (value < 0)
            throw new Error("invalid negative value");

        return new Unsigned(value);
    }

    static tryParse(str: string) : Unsigned | null {
        // todo: find a better way to do this.
        try {
            return new Unsigned(str);
        }
        catch {
            return null;
        }
    }
}

export const UnsignedZero = new Unsigned(BigInt(0));
export const UnsignedOne = new Unsigned(BigInt(1));