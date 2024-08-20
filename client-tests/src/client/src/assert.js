function deepCompare () {
    var i, l, leftChain, rightChain;
  
    function compare2Objects (x, y) {
      var p;
  
      // remember that NaN === NaN returns false
      // and isNaN(undefined) returns true
      if (isNaN(x) && isNaN(y) && typeof x === 'number' && typeof y === 'number') {
           return true;
      }
  
      // Compare primitives and functions.     
      // Check if both arguments link to the same object.
      // Especially useful on the step where we compare prototypes
      if (x === y) {
          return true;
      }
  
      // Works in case when functions are created in constructor.
      // Comparing dates is a common scenario. Another built-ins?
      // We can even handle functions passed across iframes
      if ((typeof x === 'function' && typeof y === 'function') ||
         (x instanceof Date && y instanceof Date) ||
         (x instanceof RegExp && y instanceof RegExp) ||
         (x instanceof String && y instanceof String) ||
         (x instanceof Number && y instanceof Number)) {
          return x.toString() === y.toString();
      }
  
      // At last checking prototypes as good as we can
      if (!(x instanceof Object && y instanceof Object)) {
          return false;
      }
  
      if (x.isPrototypeOf(y) || y.isPrototypeOf(x)) {
          return false;
      }
  
      if (x.constructor !== y.constructor) {
          return false;
      }
  
      if (x.prototype !== y.prototype) {
          return false;
      }
  
      // Check for infinitive linking loops
      if (leftChain.indexOf(x) > -1 || rightChain.indexOf(y) > -1) {
           return false;
      }
  
      // Quick checking of one object being a subset of another.
      // todo: cache the structure of arguments[0] for performance
      for (p in y) {
          if (y.hasOwnProperty(p) !== x.hasOwnProperty(p)) {
              return false;
          }
          else if (typeof y[p] !== typeof x[p]) {
              return false;
          }
      }
  
      for (p in x) {
          if (y.hasOwnProperty(p) !== x.hasOwnProperty(p)) {
              return false;
          }
          else if (typeof y[p] !== typeof x[p]) {
              return false;
          }
  
          switch (typeof (x[p])) {
              case 'object':
              case 'function':
  
                  leftChain.push(x);
                  rightChain.push(y);
  
                  if (!compare2Objects (x[p], y[p])) {
                      return false;
                  }
  
                  leftChain.pop();
                  rightChain.pop();
                  break;
  
              default:
                  if (x[p] !== y[p]) {
                      return false;
                  }
                  break;
          }
      }
  
      return true;
    }
  
    if (arguments.length < 1) {
      return true; //Die silently? Don't know how to handle such case, please help...
      // throw "Need two or more arguments to compare";
    }
  
    for (i = 1, l = arguments.length; i < l; i++) {
  
        leftChain = []; //Todo: this can be cached
        rightChain = [];
  
        if (!compare2Objects(arguments[0], arguments[i])) {
            return false;
        }
    }
  
    return true;
}

function fail(msg) {
    console.trace(msg);
    throw new Error(msg);
}
let assert = {
    deepEqual(l, r) {
        if(!deepCompare(l, r)) {
            throw new Error(`Expected objects to be equal but they were not.\nLeft: ${JSON.stringify(l)}\nRight: ${JSON.stringify(r)}`);
        }
    },
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