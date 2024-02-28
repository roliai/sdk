function fail(msg) {
    console.trace(msg);
    throw new Error(msg);
}
let assert = {
    singleInstanceOf(ar, clazz) {
        let found = null;
        for (let v of ar) {
            if (v instanceof clazz) {
                if (found)
                    throw new Error("Duplicate instance of type found")
                found = v;
            }
        }
        return found;
    },
    type(v, t) {
        if (typeof v !== t)
            fail(`Expected type to be ${t} but was ${typeof v}`);
    },
    value(v, c) {
        if (v !== c)
            fail(`${v} !== ${c}`);
    },
    isArrayWithMinLength(v, len) {
        if(!Array.isArray(v)) {
            fail(`Expected to find an Array in ${JSON.stringify(v)} but could not.`);
        }
        if(v.length < len) {
            fail(`Expected ${v} to have at least ${len} elements but it only had ${v.length} elements.`);
        }
    },
    typeValue(v, t, c) {
        this.type(v, t);
        this.value(v, c);
    },
    some(ar, pred) {
        if(!ar.some(pred))
            fail("Item not found");
    },
    someType(ar, t) {
        if(!ar.some(_ => typeof _ === t))
            fail(`Expected to find type ${t} in ${JSON.stringify(ar)} but could not.`);
    },
    someTypeValue(ar, t, v) {
        if(!ar.some(_ => typeof _ === t && _ === v))
            fail(`Expected to find type ${t} with value ${v} in ${JSON.stringify(ar)} but could not.`);
    },
    someInstanceOfManagedType(ar, clazz, clazzName, pk) {
        this.someInstanceOf(ar, clazz, clazzName, _ => typeof _.primaryKey === "string" && _.primaryKey === pk);
    },
    someInstanceOf(ar, clazz, clazzName, and_pred = null) {
        if(!ar.some(_ => typeof _ === "object" && _ instanceof clazz && (and_pred && and_pred(_))))
            fail(`Expected to find an instance of ${clazzName} in ${JSON.stringify(ar)} but could not.`);
    },
    instanceOf(v, clazz, clazzName) {
        if (typeof v !== "object")
            fail(`Expected ${v} to be an object when it was an ${typeof v}`);
        if (!(v instanceof clazz)) {
            fail(`Expected ${v} to be an instance of ${clazzName} but it wasn't.`);
        }
    },
    fail(msg) {
        fail(msg);
    },
    stringMinLength(str, len) {
        if(typeof str !== 'string') {
            fail(`Expected ${str} to be a string when it was an ${typeof str}`);        
        }
        if(str.length < len) {
            fail(`Expected ${str} to have at least ${len} characters but it only had ${str.length} characters.`);
        }
    }
};

module.exports = {assert};