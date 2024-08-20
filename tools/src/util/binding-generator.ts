import path from "path";
import fs from "fs";
import {logLocalError, logRemoteError} from "./logging";
import {getApiUrl} from "../model/connection-info-file";
import Mustache from "mustache";
import {requiresTruthy} from "./requires";
import {ServiceIndexProto} from "../protocol/service-index-proto";
import {DataClassProto} from "../protocol/data-class-proto";
import {EventClassProto} from "../protocol/event-class-proto";
import {CallableClassProto} from "../protocol/callable-class-proto";
import {CallableMethodProto} from "../protocol/callable-method-proto";
import {MethodArgumentProto} from "../protocol/method-argument-proto";
import {FreeClassProto} from "../protocol/free-class-proto";
import {FreeFunctionProto} from "../protocol/free-function-proto";
import {BUILD_INFO} from "../config";
import {ConstructorProto} from "../protocol/constructor-proto";
import {MethodKindProto} from "../protocol/method-kind-proto";
import {readBinaryTemplate, readTemplate} from "./template";
import JSZip from "jszip";
import {BindingConfig} from "../model/binding-config";
import {recreateDir} from "./loud-fs";
import {CallableKindProto} from "../protocol/callable-kind-proto";
import {changePackageName} from "./package-json.js";
import {SERVICE_CLIENT_PACKAGE_NAME_MARKER} from "../constants";

const {version} = require("../package.json");

const EOL = require('os').EOL;

function getMethodSeparator(): string {
    return EOL + EOL;
}

function getClassSeparator(): string {
    return EOL + EOL;
}

function getLineSeparator(): string {
    return EOL;
}

enum CodeGetDefClassKind {
    FreeClass,
    Data,
    Endpoint,
    Event
}

class GeneratedClient {
    constructor(public package_json: string, public index_js: string) {
        requiresTruthy('package_json', package_json);
        requiresTruthy('index_js', index_js);
    }
}

function generateClient(logContext: string, isEsm: boolean, userKey: string, apiUrl: string,
                        serviceIndex: ServiceIndexProto, regenCommand: string, clientPackageName: string): GeneratedClient {
    requiresTruthy('logContext', logContext);
    requiresTruthy('userKey', userKey);
    requiresTruthy('apiUrl', apiUrl);
    requiresTruthy('serviceIndex', serviceIndex);
    requiresTruthy('regenCommand', regenCommand);

    const clientExports = ["createRoliClient"];

    //read in the templates
    const indexTemplate = readTemplate("index.mustache");
    const serviceRegisterTemplate = readTemplate("service-register.mustache");
    const eventTemplate = readTemplate("event.mustache");
    const eventRegisterTemplate = readTemplate("event-register.mustache");
    const dataTemplate = readTemplate("data.mustache");
    const dataRegisterTemplate = readTemplate("data-register.mustache");
    const endpointTemplate = readTemplate("endpoint.mustache");
    const endpointRegisterTemplate = readTemplate("endpoint-register.mustache");
    const endpointMethodTemplate = readTemplate("endpoint-method.mustache");
    const sessionTemplate = readTemplate("session.mustache");
    const sessionRegisterTemplate = readTemplate("session-register.mustache");
    const sessionMethodTemplate = readTemplate("session-method.mustache");

    const serviceName = serviceIndex.serviceName();
    if (!serviceName)
        throw new Error(logRemoteError(logContext, 'Unable to read service index because the name was empty'));

    const serviceId = serviceIndex.serviceId();
    if (serviceId === BigInt(0))
        throw new Error(logRemoteError(logContext, 'Unable to read service index because the service id was invalid'));

    const serviceVersion = serviceIndex.serviceVersion();
    if (serviceVersion === BigInt(0))
        throw new Error(logRemoteError(logContext, 'Unable to read service index because the service version was invalid'));

    let serviceRegistration = Mustache.render(serviceRegisterTemplate, {
        SERVICE_NAME: serviceName,
        USER_KEY: userKey,
        SERVICE_ID: serviceId.toString(),
        SERVICE_VERSION: serviceVersion.toString()
    })

    let freeFunctions = [];
    for (let i = 0; i < serviceIndex.freeFunctionsLength(); ++i) {
        const freeFunction = serviceIndex.freeFunctions(i, new FreeFunctionProto());
        if (!freeFunction)
            throw new Error(logRemoteError(logContext, 'Unable to read free function from the service index because it contained invalid data'));
        const code = freeFunction.sourceCode();
        if (!code)
            throw new Error(logRemoteError(logContext, 'Unable to read free function from the service index because the source code was empty'))
        freeFunctions.push(code);
        const functionName = freeFunction.functionName();
        if (!functionName)
            throw new Error(logRemoteError(logContext, 'Unable to read free function from the service index because the function name was empty'));
        clientExports.push(functionName);
    }

    let freeClasses = [];
    for (let i = 0; i < serviceIndex.freeClassesLength(); ++i) {
        const freeClass = serviceIndex.freeClasses(i, new FreeClassProto());
        if (!freeClass)
            throw new Error(logRemoteError(logContext, 'Unable to read free class from the service index because it contained invalid data'));
        const code = freeClass.sourceCode();
        if (!code)
            throw new Error(logRemoteError(logContext, 'Unable to read free class from the service index because the source code was empty'))

        const className = freeClass.className();
        if (!className)
            throw new Error(logRemoteError(logContext, 'Unable to read free class name from the service index because it contained invalid data'));

        clientExports.push(className);
        freeClasses.push(code);
    }

    let dataClassRegistrations = [];
    let dataClasses = [];
    for (let i = 0; i < serviceIndex.dataClassesLength(); ++i) {
        const dataClass = serviceIndex.dataClasses(i, new DataClassProto());
        if (!dataClass)
            throw new Error(logRemoteError(logContext, 'Unable to read data class from the service index because it contained invalid data'));
        const name = dataClass.className();
        if (!name)
            throw new Error(logRemoteError(logContext, 'Unable to read data class from the service index because the name was empty'));

        clientExports.push(name);

        const classId = dataClass.classId();
        if (classId <= 0)
            throw new Error(logRemoteError(logContext, 'Unable to read data class from the service index because the class id was invalid'));
        const code = dataClass.sourceCode();
        if (!code)
            throw new Error(logRemoteError(logContext, 'Unable to read data class from the service index because the source code was empty'));

        dataClasses.push(Mustache.render(dataTemplate, {
            ESM_EXPORT: isEsm ? "export " : "",
            CODE: code
        }));

        dataClassRegistrations.push(Mustache.render(dataRegisterTemplate, {
            CLASS_NAME: name,
            CLASS_ID: classId
        }));
    }

    let eventClasses = [];
    let eventClassRegistrations = [];
    for (let i = 0; i < serviceIndex.eventClassesLength(); ++i) {
        const eventClass = serviceIndex.eventClasses(i, new EventClassProto());
        if (!eventClass)
            throw new Error(logRemoteError(logContext, 'Unable to read event class from the service index because it contained invalid data'));
        const name = eventClass.className();
        if (!name)
            throw new Error(logRemoteError(logContext, 'Unable to read event class from the service index because the name was empty'));
        const classId = eventClass.classId();
        if (classId <= 0)
            throw new Error(logRemoteError(logContext, 'Unable to read event class from the service index because the class id was invalid'));
        const code = eventClass.sourceCode();
        if (!code)
            throw new Error(logRemoteError(logContext, 'Unable to read event class from the service index because the source code was empty'));

        eventClasses.push(Mustache.render(eventTemplate, {
            ESM_EXPORT: isEsm ? "export " : "",
            CODE: code
        }));

        eventClassRegistrations.push(Mustache.render(eventRegisterTemplate, {
            CLASS_NAME: name,
            CLASS_ID: classId
        }));

        clientExports.push(name);
    }

    let endpointClassRegistrations = [];
    let endpointClasses = [];
    let sessionClassRegistrations = [];
    let sessionClasses = [];
    for (let i = 0; i < serviceIndex.callableClassesLength(); ++i) {
        const callableClass = serviceIndex.callableClasses(i, new CallableClassProto());
        if (!callableClass)
            throw new Error(logRemoteError(logContext, 'Unable to read endpoint class from the service index because it contained invalid data'));
        const className = callableClass.className();
        if (!className)
            throw new Error(logRemoteError(logContext, 'Unable to read endpoint class from the service index because the name was empty'));

        clientExports.push(className);

        const classId = callableClass.classId();
        if (classId <= 0)
            throw new Error(logRemoteError(logContext, 'Unable to read endpoint class from the service index because the class id was invalid'));

        const methods = [];
        for (let j = 0; j < callableClass.methodsLength(); ++j) {
            const callableMethod = callableClass.methods(j, new CallableMethodProto());
            if (!callableMethod)
                throw new Error(logRemoteError(logContext, 'Unable to read callable method from the service index because it contained invalid data'));
            const methodName = callableMethod.methodName();
            if (!methodName)
                throw new Error(logRemoteError(logContext, 'Unable to read callable method from the service index because the name was empty'));
            const methodId = callableMethod.methodId();
            if (methodId <= 0)
                throw new Error(logRemoteError(logContext, 'Unable to read callable method from the service index because the method id was invalid'));

            const methodArguments = [];
            for (let k = 0; k < callableMethod.argumentsLength(); ++k) {
                const methodArgument = callableMethod.arguments_(k, new MethodArgumentProto());
                if (!methodArgument)
                    throw new Error(logRemoteError(logContext, 'Unable to read callable method argument from the service index because it contained invalid data'));
                const methodArgumentName = methodArgument.name();
                if (!methodArgumentName)
                    throw new Error(logRemoteError(logContext, 'Unable to read callable method argument from the service index because the name was empty'));
                methodArguments.push(methodArgumentName)
            }

            let methodArgsPassString = "";
            if (methodArguments.length > 0) {
                methodArgsPassString = ", " + methodArguments.join(', ');
            }

            let methodTemplate;
            switch (callableClass.kind()) {
                case CallableKindProto.Endpoint:
                    methodTemplate = endpointMethodTemplate;
                    break;
                case CallableKindProto.Session:
                    methodTemplate = sessionMethodTemplate;
                    break;
            }

            methods.push(Mustache.render(methodTemplate, {
                METHOD_NAME: methodName,
                METHOD_ARGS_SIG: methodArguments.join(', '),
                METHOD_ID: methodId,
                METHOD_ARGS_PASS_STRING: methodArgsPassString
            }));
        }

        let methodsString = "";
        if (methods.length) {
            methodsString = EOL + methods.join(getMethodSeparator());
        }

        switch (callableClass.kind()) {
            case CallableKindProto.Endpoint:
                endpointClasses.push(Mustache.render(endpointTemplate, {
                    ESM_EXPORT: isEsm ? "export " : "",
                    CLASS_NAME: className,
                    METHODS: methodsString
                }));
                endpointClassRegistrations.push(Mustache.render(endpointRegisterTemplate, {
                    CLASS_NAME: className,
                    CLASS_ID: classId
                }));
                break;
            case CallableKindProto.Session:
                sessionClasses.push(Mustache.render(sessionTemplate, {
                    ESM_EXPORT: isEsm ? "export " : "",
                    CLASS_NAME: className,
                    METHODS: methodsString
                }));
                sessionClassRegistrations.push(Mustache.render(sessionRegisterTemplate, {
                    CLASS_NAME: className,
                    CLASS_ID: classId
                }));
                break;
        }
    }

    let cjsExports = "";
    if (!isEsm) {
        cjsExports = Mustache.render(readTemplate('index-exports-cjs.mustache'), {
            EXPORTS: clientExports.join(', ')
        });
    }

    const importTemplate = isEsm ?
        readTemplate("index-import-esm.mustache") :
        readTemplate("index-import-cjs.mustache");

    const indexImports = Mustache.render(importTemplate, {
        ROLI_CLIENT_PACKAGE_IMPORT: clientPackageName
    });

    const index_js = Mustache.render(indexTemplate, {
        "BUILD_INFO": BUILD_INFO,
        ROLI_TOOLS_VERSION: version,
        IMPORT: indexImports,
        CJS_EXPORT: cjsExports,
        ESM_CREATE_CLIENT_EXPORT: isEsm ? "export " : "",
        REGEN_COMMAND: regenCommand,
        FREE_FUNCTIONS: freeFunctions.length > 0 ? freeFunctions.join(getClassSeparator()) + getClassSeparator() : "",
        FREE_CLASSES: freeClasses.length > 0 ? freeClasses.join(getClassSeparator()) + getClassSeparator() : "",
        DATA: dataClasses.length > 0 ? dataClasses.join(getClassSeparator()) + getClassSeparator() : "",
        EVENTS: eventClasses.length > 0 ? eventClasses.join(getClassSeparator()) + getClassSeparator() : "",
        ENDPOINTS: endpointClasses.length > 0 ? endpointClasses.join(getClassSeparator()) + getClassSeparator() : "",
        SESSIONS: sessionClasses.length > 0 ? sessionClasses.join(getClassSeparator()) + getClassSeparator() : "",
        REGISTER_SERVICE: serviceRegistration + getLineSeparator(),
        REGISTER_ENDPOINTS: endpointClassRegistrations.length > 0 ? endpointClassRegistrations.join(getLineSeparator()) : "",
        REGISTER_SESSIONS: sessionClassRegistrations.length > 0 ? sessionClassRegistrations.join(getLineSeparator()) : "",
        REGISTER_EVENTS: eventClassRegistrations.length > 0 ? eventClassRegistrations.join(getLineSeparator()) : "",
        REGISTER_DATA: dataClassRegistrations.length > 0 ? dataClassRegistrations.join(getLineSeparator()) : "",
        API_BASE_URL: apiUrl
    });

    const package_json = isEsm ?
        readTemplate("package-json-esm.json") :
        readTemplate("package-json-cjs.json");

    return new GeneratedClient(package_json, index_js);
}

function generateRootPackage(react: boolean,
                             packageName: string,
                             serviceVersion: bigint,
                             clientPackageName: string,
                             reactPackageName?: string): string {
    requiresTruthy('packageName', packageName);
    requiresTruthy('serviceVersion', serviceVersion);
    requiresTruthy('clientPackageName', clientPackageName);
    if (react)
        requiresTruthy('reactPackageName', reactPackageName);

    const view = {
        PACKAGE_NAME: packageName,
        VERSION: `${serviceVersion.toString()}.0.0`,
        CLIENT_PACKAGE_NAME: clientPackageName
    }

    let template;
    if (react) {
        // @ts-ignore
        view["REACT_PACKAGE_NAME"] = reactPackageName;
        template = readTemplate("root-package-with-react-json.mustache");
    } else {
        template = readTemplate("root-package-json.mustache");
    }

    return Mustache.render(template, view);
}

async function writeTypeDefinitions(compressedServiceTypeDefinitionsStr: string, packageDir: string, clientPackageName: string) {
    requiresTruthy('compressedServiceTypeDefinitionsStr', compressedServiceTypeDefinitionsStr);
    if (!fs.existsSync(packageDir))
        throw new Error(logLocalError(`Package directory ${packageDir} must already exist`));
    const zip = await JSZip.loadAsync(compressedServiceTypeDefinitionsStr, {base64: true});

    const files = zip.files;
    const fileNames = Object.keys(files);
    for (let relativePath of fileNames) {
        const archive = files[relativePath];
        if (archive.dir)
            continue; //don't create empty directories

        if (relativePath.endsWith("config.d.ts"))
            relativePath = relativePath.replace("config", "index");

        const fullPath = path.resolve(packageDir, relativePath);
        const dirPath = path.dirname(fullPath);

        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, {recursive: true});
        }

        let content = await archive.async('string');

        content = content.replaceAll(SERVICE_CLIENT_PACKAGE_NAME_MARKER, clientPackageName);

        fs.writeFileSync(fullPath, content, {encoding: "utf8"});
    }
}

async function unzipTemplate(sourceTemplateFile: string, packageDir: string) {
    const bin = readBinaryTemplate(sourceTemplateFile);
    const zip = await JSZip.loadAsync(bin);

    const files = zip.files;
    const fileNames = Object.keys(files);
    for (let relativePath of fileNames) {
        const archive = files[relativePath];
        if (archive.dir)
            continue; //don't create empty directories

        const fullPath = path.resolve(packageDir, relativePath);
        const dirPath = path.dirname(fullPath);

        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, {recursive: true});
        }

        const content = await archive.async('string');
        fs.writeFileSync(fullPath, content, {encoding: "utf8"});
    }
}

export async function createOrUpdateBinding(
    logContext: string,
    userKey: string,
    serviceIndex: ServiceIndexProto,
    regenCommand: string,
    projectDir: string,
    compressedServiceTypeDefinitionsStr: string,
    react: boolean
):
    Promise<{ servicePackageName: string, servicePackageDir: string, wasUpdate: boolean }> {

    if (!fs.existsSync(projectDir)) {
        throw new Error(logLocalError("Destination project directory does not exist."));
    }

    // Create the package name and the root package
    const serviceName = serviceIndex.serviceName();
    if (!serviceName)
        throw new Error(logLocalError("Service name was empty"));
    let canonicalServiceName = serviceName.toLowerCase();
    let packageName = ""
    if (!canonicalServiceName.includes("service")) {
        packageName = canonicalServiceName
        if (!canonicalServiceName.endsWith('-')) {
            packageName += '-';
        }
        packageName += 'service';
    } else {
        packageName = canonicalServiceName;
    }

    const serviceVersion = serviceIndex.serviceVersion();
    if (serviceVersion === BigInt(0))
        throw new Error(logLocalError(`Invalid service version`));


    const apiUrl = getApiUrl();

    const clientPackageName = `roli-client-${packageName}-${serviceVersion}`;

    // Generate the CJS client
    const cjsClient = generateClient(logContext, false, userKey, apiUrl, serviceIndex, regenCommand, clientPackageName);

    // Generate the ESM client
    const esmClient = generateClient(logContext, true, userKey, apiUrl, serviceIndex, regenCommand, clientPackageName);

    // create necessary directories
    const relRootPath = ".roli/bindings/" + canonicalServiceName;
    const rootDir = path.join(projectDir, relRootPath);
    const cjsDir = path.join(rootDir, "cjs");
    const esmDir = path.join(rootDir, "esm");
    const depsDir = path.join(rootDir, "deps");

    let isUpdate = fs.existsSync(rootDir);

    fs.mkdirSync(rootDir, {recursive: true});

    recreateDir(cjsDir);
    recreateDir(esmDir);
    recreateDir(depsDir);

    const clientDir = path.join(depsDir, clientPackageName);
    fs.mkdirSync(clientDir, {recursive: true});
    await unzipTemplate("client.zip", clientDir);
    changePackageName(path.join(clientDir, 'package.json'), clientPackageName);

    const reactPackageName = `roli-react-${packageName}-${serviceVersion}`;
    if (react) {
        const reactDir = path.join(depsDir, reactPackageName);
        fs.mkdirSync(reactDir, {recursive: true});
        await unzipTemplate("react.zip", reactDir);
        changePackageName(path.join(reactDir, 'package.json'), reactPackageName);
    }

    //write the files
    const bindingConfig = new BindingConfig(rootDir, canonicalServiceName, serviceVersion);
    bindingConfig.write();

    const rootPackage = generateRootPackage(react, packageName, serviceVersion, clientPackageName,
        react ? reactPackageName : undefined);

    fs.writeFileSync(path.join(rootDir, "package.json"), rootPackage, {encoding: "utf8"})
    fs.writeFileSync(path.join(cjsDir, "package.json"), cjsClient.package_json, {encoding: "utf8"});
    fs.writeFileSync(path.join(cjsDir, "index.js"), cjsClient.index_js, {encoding: "utf8"});
    fs.writeFileSync(path.join(esmDir, "package.json"), esmClient.package_json, {encoding: "utf8"});
    fs.writeFileSync(path.join(esmDir, "index.js"), esmClient.index_js, {encoding: "utf8"});

    //write the type definitions
    await writeTypeDefinitions(compressedServiceTypeDefinitionsStr, cjsDir, clientPackageName);
    await writeTypeDefinitions(compressedServiceTypeDefinitionsStr, esmDir, clientPackageName);

    return {servicePackageName: packageName, servicePackageDir: relRootPath, wasUpdate: isUpdate};
}