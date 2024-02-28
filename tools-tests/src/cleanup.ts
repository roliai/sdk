import {executeServiceDelete} from "roli-tools/command/delete-service.js";
import {executeAccountDelete} from "roli-tools/command/delete-account.js";
import {createLogContext} from "roli-tools/util/log-context.js"
import {executeUnregisterModel} from "roli-tools/command/unregister-model";

import {
    EXERCISE_TRACKER_SERVICE_NAME,
    METHOD_AND_SERIALIZATION_SERVICE_NAME,
    MEMORY_CAP_SERVICE_NAME,
    DOCTORSNOTES_SERVICE_NAME,
    ENABLE_DOCTORSNOTES_TEST,
    ENABLE_EXERCISE_TRACKER_TEST,
    ENABLE_MEMORY_CAP_TEST,
    ENABLE_METHOD_AND_SERIALIZATION_TEST,
    DOCTORSNOTES_MODEL_KEY
} from "./names"
import {IS_ENTERPRISE_EDITION} from "./config";
import {isLoggedIn} from "./util/util";

const LOG_CONTEXT = createLogContext();

const IS_PRE_CLEANUP = process.env.IS_PRE_CLEANUP == "1";

console.log("Test cleanup using log context " + LOG_CONTEXT);

async function test(testName: string, func: any) {
    console.log("++ Test: " + testName);
    await func();
    console.log("OK");
}

async function suite() {

    if(IS_PRE_CLEANUP) {
        console.log("====================================================================")
        console.log("== WARNING: Operating in Pre-Cleanup mode so most errors are ignored.");
        console.log("====================================================================")
    }

    if(IS_ENTERPRISE_EDITION) {
        if(!isLoggedIn()) {
            console.log("Cleanup skipped because there was no login file.");
            return;
        }
    }

    if(ENABLE_DOCTORSNOTES_TEST) {
        await test('unregister model', async function() {
           if(!await executeUnregisterModel(DOCTORSNOTES_MODEL_KEY, DOCTORSNOTES_SERVICE_NAME) && !IS_PRE_CLEANUP) {
               throw new Error("Unable to unregister doctors notes model");
           }
        });
        await test('service delete doctors notes', async function () {
            if(!await executeServiceDelete(DOCTORSNOTES_SERVICE_NAME, false) && !IS_PRE_CLEANUP)
                throw new Error("Unable to delete doctors notes service");
        });
    } else {
        console.log("Doctor's Notes test is disabled");
    }

    if(ENABLE_MEMORY_CAP_TEST) {
        await test('service delete memory cap', async function () {
            if(!await executeServiceDelete(MEMORY_CAP_SERVICE_NAME, false) && !IS_PRE_CLEANUP)
                throw new Error("Unable to delete memory cap service");
        });
    } else {
        console.log("Memory cap test is disabled");
    }

    if(ENABLE_EXERCISE_TRACKER_TEST) {
        await test('service delete exercise tracker', async function () {
            if(!await executeServiceDelete(EXERCISE_TRACKER_SERVICE_NAME, false) && !IS_PRE_CLEANUP)
                throw new Error("Unable to delete exercise tracker service");
        });
    } else {
        console.log("Exercise tracker test is disabled");
    }

    if(ENABLE_METHOD_AND_SERIALIZATION_TEST) {
        await test('service delete method and serialization', async function () {
            if(!await executeServiceDelete(METHOD_AND_SERIALIZATION_SERVICE_NAME, false) && !IS_PRE_CLEANUP)
                throw new Error("Unable to delete method and serialization service");
        });
    } else {
        console.log("Method and serialization test is disabled");
    }

    if(IS_ENTERPRISE_EDITION) {
        await test('delete account', async function(){
            if (!await executeAccountDelete(false) && !IS_PRE_CLEANUP)
                throw new Error("unable to delete anonymous account");
        });
    }
}

suite().then(value => {
    // don't change this. test-browser.sh looks for it to know everything worked.
    // Also, the reason I'm not just using process.exit(1) is because browserify freezes if I use process.
    console.log("All tests completed successfully");
    if (typeof window !== 'undefined') {
        window.close();
    }
}).catch(reason => {
    console.error(reason);
    if (typeof window !== 'undefined') {
        window.close();
    }
});
