import {executeLogin} from "roli-tools/command/login.js";
import {executeSetConnectionInfo} from "roli-tools/command/set-connection-info.js";
import {executeInitService} from "roli-tools/command/init-service.js";
import {executeDeployService} from "roli-tools/command/deploy-service.js";
import {getServiceVersions} from "roli-tools/command/list-services.js";
import {getModelRegistrations} from "roli-tools/command/list-models";
import {tryGetModelRegistration} from "roli-tools/command/get-model";
import {executeGenerateClient} from "roli-tools/command/generate-client.js";
import {executeRegisterModel} from "roli-tools/command/register-model";
import {GlobalOptions} from "roli-tools//util/global-options.js";
import { ServiceVersion } from "roli-tools/model/service-version.js";

import path from "path";
import {createLogContext} from "roli-tools/util/log-context.js";
import {SERVICE_CONFIG_FILE_NAME} from "roli-tools/model/service-config"

import fetch from 'cross-fetch';
import fs from "fs";

import {
    DOCTORSNOTES_SERVICE_NAME,
    EXERCISE_TRACKER_SERVICE_NAME,
    METHOD_AND_SERIALIZATION_SERVICE_NAME,
    MEMORY_CAP_SERVICE_NAME,
    SERVICES_DIR_NAME,
    RUN_DIR,
    SRC_DIR,
    ENABLE_DOCTORSNOTES_TEST,
    ENABLE_EXERCISE_TRACKER_TEST,
    ENABLE_MEMORY_CAP_TEST,
    ENABLE_METHOD_AND_SERIALIZATION_TEST, 
    DOCTORSNOTES_MODEL_KEY, 
    DOCTORS_NOTES_MODEL_FILE
} from "./names"
import { DEFAULT_ADMIN_SERVICE_BASE_URL, DEFAULT_API_SERVICE_BASE_URL, IS_ENTERPRISE_EDITION } from "./config";
import {tryOpenAndParse} from "roli-tools/util/config-file";
import {deepCompare, isLoggedIn, LOGIN_FILE} from "./util/util";

GlobalOptions.verbose = true;

const LOG_CONTEXT = createLogContext();

console.log("Test setup using log context " + LOG_CONTEXT);

async function suite() {
    if(IS_ENTERPRISE_EDITION) {
        if(isLoggedIn())
            throw new Error(`Unable to run tests because a login file exists. Delete ${LOGIN_FILE} and rerun.`)
    }

    await test("verify Admin's health endpoint", async function () {
        // Health endpoint is defined here:
        // build/in/admin/remote/admin-deployment.in.yaml
        await fetch(`${DEFAULT_ADMIN_SERVICE_BASE_URL}`); // should return 200
    })
    
    await test("verify Api's health endpoint", async function () {
        // Health endpoint is defined here:
        // build/in/api/remote/api-deployment.in.yaml
        await fetch(DEFAULT_API_SERVICE_BASE_URL); // should return 200
    })

    if(IS_ENTERPRISE_EDITION) {
        await test('login with anonymous account', async function () {
            if(!await executeLogin(null, true, true))
                throw new Error("login failed");
        });
    }

    await test('setup services', async function () {
        // clean out and copy the run dir
        if(fs.existsSync(RUN_DIR))
            fs.rmSync(RUN_DIR, { recursive: true, force: true });

        // copy the project from src/client to run/<name>
        const clientSrcDir = path.join(SRC_DIR, "client");
        copyFolderSync(clientSrcDir, RUN_DIR);

        // copy and set up the services
        const servicesDir = path.join(RUN_DIR, SERVICES_DIR_NAME);

        if(ENABLE_DOCTORSNOTES_TEST) {
            //Doctor's Notes
            const modelFile = path.join(servicesDir, DOCTORSNOTES_SERVICE_NAME, DOCTORS_NOTES_MODEL_FILE);
            copyFolderSync(
                path.join(SRC_DIR, SERVICES_DIR_NAME, DOCTORSNOTES_SERVICE_NAME),
                path.join(servicesDir, DOCTORSNOTES_SERVICE_NAME));
            await setupService(RUN_DIR, DOCTORSNOTES_SERVICE_NAME, false);
            await setupModel(DOCTORSNOTES_MODEL_KEY, DOCTORSNOTES_SERVICE_NAME, modelFile);
        } else {
            console.log("Doctor's Notes test is disabled");
        }

        if(ENABLE_EXERCISE_TRACKER_TEST) {
            //Exercise Tracker
            copyFolderSync(
                path.join(SRC_DIR, SERVICES_DIR_NAME, EXERCISE_TRACKER_SERVICE_NAME),
                path.join(servicesDir, EXERCISE_TRACKER_SERVICE_NAME));
            await setupService(RUN_DIR, EXERCISE_TRACKER_SERVICE_NAME, true);
        } else {
            console.log("Exercise tracker test is disabled");
        }

        if(ENABLE_METHOD_AND_SERIALIZATION_TEST) {
            //Method and Serialization
            copyFolderSync(
                path.join(SRC_DIR, SERVICES_DIR_NAME, METHOD_AND_SERIALIZATION_SERVICE_NAME),
                path.join(servicesDir, METHOD_AND_SERIALIZATION_SERVICE_NAME));
            await setupService(RUN_DIR, METHOD_AND_SERIALIZATION_SERVICE_NAME, false);
        } else  {
            console.log("Method and serialization test is disabled");
        }

        if(ENABLE_MEMORY_CAP_TEST) {
            //Memory Cap
            copyFolderSync(
                path.join(SRC_DIR, SERVICES_DIR_NAME, MEMORY_CAP_SERVICE_NAME),
                path.join(servicesDir, MEMORY_CAP_SERVICE_NAME));
            await setupService(RUN_DIR, MEMORY_CAP_SERVICE_NAME, true);
        } else  {
            console.log("Memory cap test is disabled");
        }
    });
}

async function test(test_name: string, func: any) {
    console.log("++ Test: " + test_name);
    await func();
    console.log("OK");
}

function copyFolderSync(from: string, to: string) {
    if (!fs.existsSync(to))
        fs.mkdirSync(to, {recursive: true});
    fs.readdirSync(from).forEach((element: any) => {
        if (fs.lstatSync(path.join(from, element)).isFile()) {
            fs.copyFileSync(path.join(from, element), path.join(to, element));
        } else {
            copyFolderSync(path.join(from, element), path.join(to, element));
        }
    });
}

async function assertSingleModelFound(serviceName: string, key: string, model: any) {
    const registrations = await getModelRegistrations(serviceName);

    if(!registrations)
        throw new Error("no registrations found");

    let found = false;
    for(const key_ of registrations.keys()) {
        if(key_ !== key) {
            throw new Error("Extra model found: " + key_);
        } else {
            const comp = registrations.get(key_);

            if(!comp)
                throw new Error("Model registration was empty");

            if(comp.primaryKey !== key_)
                throw new Error("Model registration primaryKey did not match the expected key");

            if(!deepCompare(model, comp.model))
                throw new Error("Model returned from getModelRegistrations was different");

            found = true;
        }
    }

    if(!found)
        throw new Error("Model not found " + key);
}

async function assertServiceFound(serviceName: string, serviceVersionStr: string) : Promise<void> {
    //Ensure the service is listed in the owned services
    const serviceVersions = <ServiceVersion[]>await getServiceVersions();
    if (!serviceVersions)
        throw new Error("no services found");
    let found = false;
    for (const serviceVersion of serviceVersions) {
        if (serviceVersion.serviceName === serviceName)
        {
            if(serviceVersionStr === serviceVersion.serviceVersionStr) {
                found = true;
                break;
            } else {
                throw new Error(`Service ${serviceName} was found but the version ${serviceVersion.serviceVersionStr} did not equal ${serviceVersionStr}`);
            }
        }
    }
    if (!found)
        throw new Error(`${serviceName} was not found in the list of known services`);
}

async function setupModel(key: string, serviceName: string, modelFile: string) {
    // Register the model
    if(!await executeRegisterModel(key, serviceName, modelFile)) {
        throw new Error("Unable to register model");
    }

    // Ensure the model we get back is the same as we've registered
    const registration = await tryGetModelRegistration(serviceName, key);
    if(!registration)
        throw new Error("Unable to get the model registration");

    const model = tryOpenAndParse(modelFile);
    if(!model)
        throw new Error("Model file was empty");

    if(!deepCompare(registration.model, model))
        throw new Error("The model registration returned by tryGetModelRegistration did not match the model in the model file");

    // Ensure it is in the list of models and nothing else.
    await assertSingleModelFound(serviceName, key, model);
}

async function setupService(clientRunDir: string, serviceName: string, specificVersion: boolean) {
    const servicesDir = path.join(clientRunDir, "services");
    const serviceDir = path.resolve(servicesDir, serviceName);

    console.log("===================================================================================")
    console.log(`= Setting up service ${serviceName} in ${serviceDir} and connecting it to the client located at ${clientRunDir} ...`);

    //remove the old service.json, so I can initialize it
    const serviceJsonFile = path.resolve(serviceDir, SERVICE_CONFIG_FILE_NAME);
    if (fs.existsSync(serviceJsonFile))
        fs.rmSync(serviceJsonFile);

    console.log(`== executeInit(serviceDir: ${serviceDir} ,serviceName: ${serviceName} ...)`)
    if (!await executeInitService(serviceDir, serviceName, false))
        throw new Error("init failed");

    //Verify the service.json files were written
    if (!path.resolve(serviceDir, SERVICE_CONFIG_FILE_NAME)) {
        throw new Error("service.json is missing");
    }

    //Deploy the service
    console.log(`== executeDeploy(serviceDir: ${serviceDir} ...)`)
    if (!await executeDeployService(serviceDir, false, true, true, false))
        throw new Error("first deploy failed");

    //Ensure the service is listed in the owned services
    await assertServiceFound(serviceName, "1");

    //Deploy the service
    console.log(`== executeDeploy(serviceDir: ${serviceDir} ...)`)
    if (!await executeDeployService(serviceDir, false, true, true, true))
        throw new Error("second deploy failed");

    //Ensure the service is listed in the owned services
    await assertServiceFound(serviceName, "2");

    //Connect the service
    console.log(`== executeConnect(clientRunDir: ${clientRunDir} , serviceName: ${serviceName} ...)`)
    const versionStr = specificVersion ? String("1") : null;
    if (!await executeGenerateClient(clientRunDir, serviceName, versionStr, false, true))
        throw new Error("connect failed");
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
