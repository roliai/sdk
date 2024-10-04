import {Command} from "commander";
import {
    logRemoteError, logLocalError,
    logIfNotAlready, logOk, logVerbose
} from "../util/logging";
import {
    IdentityClassMapping,
    ServiceClassMapping,
    ServiceSrcClassTagMapping,
    ServiceIdentity, ServiceConfig
} from "../model/service-config";
import fs from "fs";
import path from "path";
import crc32 from "crc-32";
import {AdminSingleton, AuthorizeAssignment, PermissionAssignment, ServiceFileContent} from "../service/admin";
import {uuidv4} from "../util/util";
import {createLogContext} from "../util/log-context";
import chalk from "chalk";
import {compile} from "../util/compiler";
import JSZip from "jszip";
import {recreateDir} from "../util/loud-fs";
import {SingleBar} from "cli-progress";
import {SERVICE_RUNTIME_PACKAGE_NAME} from "../constants";
import {authEnabled, loginWithStoredCredentials} from "../service/auth";

function compare(l: ServiceFileContent, r: ServiceFileContent) {
    let comparison = 0;
    if (l.name > r.name) {
        comparison = 1;
    } else if (l.name < r.name) {
        comparison = -1;
    }
    return comparison;
}

function getServiceFileContent(baseDir: string, dir: string, ext: string[]): ServiceFileContent[] {
    let results: ServiceFileContent[] = [];
    let list = fs.readdirSync(dir);
    const baseFileNames = new Set();
    list.forEach(function (fileName: string) {
        const pathName = path.join(dir, fileName);
        let stat = fs.statSync(pathName);
        if (stat && stat.isDirectory()) {
            if (fileName !== SERVICE_RUNTIME_PACKAGE_NAME)
                results = results.concat(getServiceFileContent(baseDir, pathName, ext));
        } else {
            if (!ext || ext.includes(path.extname(fileName))) {
                const name = path.relative(baseDir, pathName);
                const baseFileName = path.join(path.parse(name).dir, path.parse(name).name);
                if (baseFileNames.has(baseFileName))
                    throw new Error(`Duplicate file name: ${pathName}. All service code must have unique file base names (I.e. cannot have a file named foo.js and a file named foo.mjs in the same directory.)`);
                baseFileNames.add(baseFileName);
                const code = fs.readFileSync(pathName, {encoding: "utf8", flag: "r"});
                if (!code || code.trim().length == 0)
                    throw new Error(`Unable to push empty code file: ${pathName}`);
                results.push({
                    name: name,
                    code: code
                });
            }
        }
    });
    return results.sort(compare);
}

function getServiceChecksum(permissionAssignments: PermissionAssignment[], authorizeAssignments: AuthorizeAssignment[], serviceName: string, serviceFiles: ServiceFileContent[]): number {
    //note: don't need to know which one changed, just that any of them changed.
    let value = 0;

    value = crc32.bstr(serviceName, value);

    if(permissionAssignments && permissionAssignments.length > 0) {
        permissionAssignments.forEach(pa => {
            value = crc32.bstr(pa.fileName, value);
            value = crc32.bstr(pa.className, value);
            value = crc32.bstr(pa.fileLine.toString(), value);
            value = crc32.bstr(pa.fileColumn.toString(), value);
            value = crc32.bstr(pa.access.toString(), value);
            pa.scopes.forEach(scope => {
                value = crc32.bstr(scope, value);
            })
        })
    }

    if(authorizeAssignments && authorizeAssignments.length > 0) {
        authorizeAssignments.forEach(a => {
            value = crc32.bstr(a.fileName, value);
            value = crc32.bstr(a.className, value);
            value = crc32.bstr(a.methodName, value);
            value = crc32.bstr(a.fileLine.toString(), value);
            value = crc32.bstr(a.fileColumn.toString(), value);
            a.scopes.forEach(scope => {
                value = crc32.bstr(scope, value);
            })
        })
    }

    serviceFiles.forEach(serviceFile => {
        //include the filename in the crc to detect filename changes
        value = crc32.bstr(serviceFile.name, value); //note: file is already relative to serviceDir
        //add the file's contents to the crc to detect file content changes
        value = crc32.bstr(serviceFile.code, value);
    });

    return value;
}

export function createDeployServiceCommand(before: any): Command {
    return new Command('deploy-service')
        .option(`-d, --dir <serviceDirectory>`, "The Roli service directory containing code changes you'd like to deploy.")
        .option('--no-progress', "Hide the progress bar")
        .option('--debug', "Don't delete intermediate build directories")
        .option('--force', "Deploy a new version even if there aren't any changes.")
        .description('Deploy service code changes, creating a new service version. You must run `roli generate-client ...` in a client code project to use the new version.')
        .action(async (opts: any) => {
            if (before)
                before();
            if (await executeDeployService(opts.dir, opts.progress ?? false, opts.debug ?? false, true, opts.force ?? false)) {
                process.exit(0);
            } else {
                process.exit(1);
            }
        });
}

// Calculates whether there were any class mapping changes
// note: Class mappings are stored in service.json and service.json changes don't change the checksum.
function hasClassMappingChanges(serviceConfig: ServiceConfig, classMappings: ServiceClassMapping[]) {
    const prevClassNames = new Set<string>();

    // @ts-ignore
    for (const identityClassMapping of serviceConfig.identity.identityClassMappings) {
        prevClassNames.add(identityClassMapping.className);
    }

    let hasDiff = classMappings.length !== serviceConfig.identity.identityClassMappings?.length;
    if (!hasDiff) {
        for (const classMapping of classMappings) {
            if (!prevClassNames.has(classMapping.className)) {
                hasDiff = true;
                break;
            }
        }
    }
    return hasDiff;
}

function _zipTypeDefinitionFiles(zip: JSZip, baseDir: string, dir: string) {
    fs.readdirSync(dir).forEach(function (fileName) {
        const pathName = path.join(dir, fileName);
        const relPath = path.relative(baseDir, pathName);
        if (fs.statSync(pathName)?.isDirectory()) {
            _zipTypeDefinitionFiles(zip.folder(relPath)!, baseDir, pathName);
        } else if (fileName.endsWith('.d.ts')) {
            const content = fs.readFileSync(pathName, {encoding: "utf8"});
            zip.file(relPath, content);
        }
    });
}

async function compressTypeDefinitionFiles(rootDir: string): Promise<string | null> {
    const zip = new JSZip();
    _zipTypeDefinitionFiles(zip, rootDir, rootDir);
    return await zip.generateAsync({
        compression: "DEFLATE",
        compressionOptions: {level: 9},
        type: "base64"
    });
}

export async function executeDeployService(dir: string,
                                           showProgress: boolean,
                                           debug: boolean,
                                           log: boolean,
                                           force: boolean): Promise<boolean> {
    if (authEnabled() && !await loginWithStoredCredentials()) {
        return false; //already logged
    }

    // if the projectDir wasn't specified, start with the current directory and search upward for the project
    let serviceConfig: ServiceConfig | null = null;
    if (!dir) {
        const dir = process.cwd();
        serviceConfig = ServiceConfig.tryFindAndOpen(dir);
    } else {
        serviceConfig = ServiceConfig.tryOpen(dir);
    }

    if (!serviceConfig) {
        return false; //already logged
    }


    let buildDir: string | null = null;
    let complete = false;
    try {
        buildDir = path.join(serviceConfig.loadedFromDir, '.build');

        let progress = null;

        if (showProgress) {
            progress = new SingleBar({
                format: `Compiling |` + chalk.blue('{bar}') + '| {percentage}%',
                barCompleteChar: '\u2588',
                barIncompleteChar: '\u2591',
                hideCursor: true
            });
        }

        progress?.start(4, 0);

        recreateDir(buildDir);

        logVerbose(`Compiling ${serviceConfig.loadedFromDir}...`);
        const {
            schemaDir,
            declDir,
            permissionAssignments,
            authorizeAssignments
        } = await compile(progress, buildDir, serviceConfig.loadedFromDir, serviceConfig.compilerOptions);

        logVerbose(`Compressing typedef files in ${declDir}...`);
        const compressedServiceTypeDefinitionsStr = await compressTypeDefinitionFiles(declDir);
        if (!compressedServiceTypeDefinitionsStr) {
            logLocalError('No type definitions emitted from TypeScript');
            complete = true;
            return false;
        }

        const schemaFiles = getServiceFileContent(schemaDir, schemaDir, [".js", ".mjs"]);
        if (!schemaFiles || schemaFiles.length == 0) {
            logLocalError(`No JavaScript files found in ${schemaDir} directory.`);
            complete = true;
            return false;
        }

        let checksum = getServiceChecksum(permissionAssignments, authorizeAssignments, serviceConfig.name, schemaFiles);

        const classMappings: ServiceClassMapping[] = [];
        if (serviceConfig.classes.length > 0) {
            for (const classTag of serviceConfig.classes) {
                let found = false;
                // @ts-ignore
                for (const identityClass of serviceConfig.identity.identityClassMappings) {
                    if (identityClass.tag === classTag.tag) {
                        classMappings.push(new ServiceClassMapping(classTag.name, identityClass.classId));
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    logLocalError(`Invalid class mapping in ${serviceConfig.fullFileName}. The class key ${classTag.name} has an unknown tag. If you're attempting to add a new class, simply delete the extra class key service that file, write your class, and boot like normal. The class mappings will be updated automatically.`);
                    complete = true;
                    return false;
                }
            }
        }

        progress?.stop();

        // if this isn't a new service (checksum exists) and the checksum matches the current checksum
        if (!force && serviceConfig.identity.checksum &&
            serviceConfig.identity.checksum === checksum) {
            if (!hasClassMappingChanges(serviceConfig, classMappings)) {
                if (log)
                    logOk("No changes found. Use --force  to override.");
                complete = true;
                return true;
            }
        }

        const logContext = createLogContext();

        try {
            logVerbose(`Deploying service package...`);
            const response = await AdminSingleton.deployService(
                logContext,
                serviceConfig.name,
                schemaFiles,
                compressedServiceTypeDefinitionsStr,
                permissionAssignments,
                authorizeAssignments,
                classMappings,
                serviceConfig.identity.serviceId,
                serviceConfig.identity.lastClassId
            );

            const classes = [];
            const identityClasses = [];
            let lastClassId = serviceConfig.identity.lastClassId ?? 0;
            for (const serviceClassMapping of response.serviceClassMappings) {
                let tag = null;
                if (serviceConfig.identity.identityClassMappings) {
                    for (const prev of serviceConfig.identity.identityClassMappings) {
                        if (prev.classId === serviceClassMapping.classId) {
                            tag = prev.tag;
                            break;
                        }
                    }
                }
                if (!tag) {
                    tag = uuidv4(false);
                }
                classes.push(new ServiceSrcClassTagMapping(serviceClassMapping.className, tag));
                identityClasses.push(new IdentityClassMapping(serviceClassMapping.className, serviceClassMapping.classId, tag));
                if (serviceClassMapping.classId > lastClassId)
                    lastClassId = serviceClassMapping.classId;
            }

            serviceConfig.classes = classes;
            serviceConfig.identity = new ServiceIdentity(checksum, response.serviceIdStr, response.serviceVersionStr, identityClasses, lastClassId);
            serviceConfig.writeToDir(serviceConfig.loadedFromDir);
            progress?.stop();

            const message = `The "${serviceConfig.name}" service is now ${chalk.yellowBright("live")} at version ${serviceConfig.identity.serviceVersion}.`;

            if (log)
                logOk(message);

            complete = true;
            return true;
        } catch (e) {
            // @ts-ignore
            logRemoteError(logContext, e.message);
            return false;
        }
    } catch (e) {
        logIfNotAlready(e);
        return false;
    } finally {
        if (buildDir && fs.existsSync(buildDir)) {
            if (!debug && complete) {
                fs.rmSync(buildDir, {recursive: true, force: true});
            }
        }
    }
}