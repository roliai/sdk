import ts from "typescript";
import {EOL} from 'os';
import chalk from "chalk";
import fs, {PathLike} from "fs";
import path from "path";

import {SERVICE_RUNTIME_PACKAGE_NAME} from "../constants.js";
import {ServiceConfig} from "../model/service-config.js";
import {getColor, logLocalError, logVerbose} from "./logging.js";
import {createDir} from "./loud-fs.js";
import {writeRuntime} from "./runtime.js";
import {
    ClientDeclTransformer,
    JavaScriptServiceExecutionTransformer,
    CreateStageTransformer,
    transformTypeScript
} from "./transformer";
import {SingleBar} from "cli-progress";
import {PermissionAssignment, AuthorizeAssignment} from "../service/admin";

export interface CompilerOutput {
    // The directory that contains the JS files ready to be uploaded.
    schemaDir: string;
    // The directory that contains the .d.ts files ready to be used for client-side code gen.
    declDir: string;
    permissionAssignments: PermissionAssignment[];
    authorizeAssignments: AuthorizeAssignment[];
}

function writePackageJson(target: PathLike, obj: any) {
    fs.writeFileSync(target, JSON.stringify(obj), {encoding: "utf8"});
    logVerbose(`Wrote ${target}`);
}

function writeRuntimeStub(dir: string, decl: boolean) {
    // make a node_modules directory to make TSC happy
    const modulesDirName = 'node_modules';
    const modulesDir = path.join(dir, modulesDirName);
    fs.mkdirSync(modulesDir);

    const targetDir = path.join(modulesDir, SERVICE_RUNTIME_PACKAGE_NAME);
    fs.mkdirSync(targetDir);
    writeRuntime(targetDir, decl, true);

    writePackageJson(path.join(targetDir, 'package.json'), {
        "name": SERVICE_RUNTIME_PACKAGE_NAME,
        "main": 'index.mjs',
        "type": "module",
        "private": true
    });
}

function writeServicePackageJson(dir: string) {
    writePackageJson(path.join(dir, 'package.json'), {
        "name": "service-package",
        "type": "module",
        "private": true
    });
}

interface CompileTypeScriptResult {
    outDir: string;
    preSchemaDir: string;
    preDeclDir: string;
}

function compileTypeScript(buildDir: string,
                           stageDir: string,
                           fileNames: string[],
                           compilerOptions: ts.CompilerOptions): CompileTypeScriptResult {
    // path: service/.build/out
    const outDir = path.join(buildDir, 'out');
    createDir(outDir);

    // path: service/.build/pre-schema
    const preSchemaDir = path.join(buildDir, 'pre-schema');
    createDir(preSchemaDir);

    // path: service/.build/pre-decl
    const preDeclDir = path.resolve(buildDir, 'pre-decl');
    createDir(preDeclDir);

    compilerOptions.noEmit = false;
    compilerOptions.declaration = true;
    compilerOptions.noEmitOnError = true;
    compilerOptions.declarationDir = preDeclDir;
    compilerOptions.outDir = preSchemaDir;

    let program = ts.createProgram(fileNames, compilerOptions);

    let emitResult = program.emit();

    let allDiagnostics: ts.Diagnostic[] = ts
        .getPreEmitDiagnostics(program)
        .concat(emitResult.diagnostics);

    let errors: string[] = [];
    let warnings: string[] = [];

    allDiagnostics.forEach((diagnostic: ts.Diagnostic) => {
        let target;
        if (diagnostic.category === ts.DiagnosticCategory.Error)
            target = errors;
        else if (diagnostic.category === ts.DiagnosticCategory.Warning)
            target = warnings;
        else
            return;

        if (diagnostic.file) {
            let {line, character} = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start!);
            let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, EOL);
            target.push(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
        } else {
            target.push(ts.flattenDiagnosticMessageText(diagnostic.messageText, EOL));
        }
    });

    if (warnings.length > 0) {
        console.log(`${warnings.length} Warning${warnings.length > 1 ? "s" : ""}:`);
        warnings.forEach(warning => {
            console.log(getColor(chalk.yellowBright, warning));
        });
    }
    if (errors.length > 0) {
        if (warnings.length > 0)
            console.log("");
        console.log(`${errors.length} Error${errors.length > 1 ? "s" : ""}:`);
        errors.forEach(error => {
            console.log(getColor(chalk.redBright, error));
        });
        throw new Error("TypeScript compilation failed");
    }

    return {outDir, preSchemaDir, preDeclDir};
}

interface StageResult {
    transformedFiles: string[];
    stageDir: string;
    permissionAssignments: PermissionAssignment[];
    authorizeAssignments: AuthorizeAssignment[];
}

function stageForCompilation(buildDir: string, serviceDir: string, compilerOptions: ts.CompilerOptions): StageResult {
    // Transforms and parse the TypeScript, so it can be compiled
    logVerbose(`Preprocessing ${serviceDir}...`);

    const stageDir = path.join(buildDir, 'stage');

    const authorizeAssignments: AuthorizeAssignment[] = [];
    const permissionAssignments: PermissionAssignment[] = [];

    const stageTransformer = CreateStageTransformer(permissionAssignments, authorizeAssignments);

    const transformedFiles = transformTypeScript(serviceDir, stageDir, compilerOptions,
        stageTransformer, ['.ts', '.js', '.mjs']);

    writeRuntimeStub(stageDir, true); //needed for compilation
    writeServicePackageJson(stageDir); //needed for compilation

    return {transformedFiles, stageDir, permissionAssignments, authorizeAssignments};
}

function addCreateClientDeclaration(indexDTsFile: string) {
    let code = fs.readFileSync(indexDTsFile,'utf8');
    let c = "import { ServiceOptions, RoliClient } from \"roli-client\";\n" +
        code + "\nexport declare function createRoliClient(options?: ServiceOptions) : RoliClient;\n";

    fs.writeFileSync(indexDTsFile, c);
}

function transformDeclForClientCodeGen(outDir: string, preDeclDir: string, compilerOptions: ts.CompilerOptions): string {
    const declDir = path.join(outDir, 'decl');
    const outputFiles = transformTypeScript(preDeclDir, declDir, compilerOptions, ClientDeclTransformer, ['.ts' /* note: foo.d.ts has a .ts extension*/]);
    
    // Add a createRoliClient declaration to the index.d.ts file
    let found = false;
    outputFiles.findIndex((value, index) => {
       if(!found && value.endsWith("config.d.ts")) {
           addCreateClientDeclaration(value);
           found = true;
       }
    });
    
    if(!found) {
        throw new Error(logLocalError("Unable to load the service type declarations because the config.d.ts output file was not found"));
    }
    
    return declDir;
}

function transformJavaScriptForServiceExecution(outDir: string, preSchemaDir: string, compilerOptions: ts.CompilerOptions): string {
    const schemaDir = path.join(outDir, 'schema');
    transformTypeScript(preSchemaDir, schemaDir, compilerOptions, JavaScriptServiceExecutionTransformer, ['.mjs', '.js']);
    return schemaDir;
}

/***
 * Options when compiling service source code.
 */
export class CompilerOptions {
    constructor(public noImplicitAny: boolean = true,
                public allowJs: boolean = true,
                public strict: boolean = true)
    {}
}

/***
 * Compiles TypeScript/JavaScript service source code so that it can be run inside a service and have client code generated
 * to talk to it at runtime.
 * @param progress - progress object
 * @param buildDir - The intermediate build directory.
 * @param serviceDir - the service source code root directory
 * @param options - compiler options
 */
export async function compile(progress: SingleBar | null, buildDir: string, serviceDir: string,
                              options: CompilerOptions | null): Promise<CompilerOutput> {
    options = options ?? new CompilerOptions();

    if (!ServiceConfig.fileExists(serviceDir)) {
        throw new Error(logLocalError(`${serviceDir} is not a service. You may need to run 'roli init-service' in that directory.`));
    }

    if(!fs.existsSync(path.join(serviceDir, "config.ts")) &&
       !fs.existsSync(path.join(serviceDir, "config.js")) &&
       !fs.existsSync(path.join(serviceDir, "config.mjs"))) {
        throw new Error(logLocalError(`Missing config. Services must contain a file named config.ts, config.js, or config.mjs at the root.`));
    }

    const compilerOptions = <ts.CompilerOptions>{
        noImplicitAny: options.noImplicitAny,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        allowJs: options.allowJs,
        strict: options.strict,
        checkJs: false,
        experimentalDecorators: true,
        skipLibCheck: true
    };

    // Transform the TS code, so it can be compiled successfully.
    logVerbose(`Staging for compilation...`);
    const {
        transformedFiles,
        stageDir,
        permissionAssignments,
        authorizeAssignments
    } = stageForCompilation(buildDir, serviceDir, compilerOptions);
    progress?.increment();

    // Compile the TS into JS and .d.ts files
    logVerbose(`Compiling...`);
    const {outDir, preSchemaDir, preDeclDir} = compileTypeScript(buildDir, stageDir, transformedFiles, compilerOptions);
    progress?.increment();

    // Transform the .d.ts files, so they'll work for client-side code gen.
    logVerbose(`Transforming decl for client-side code-gen...`)
    const declDir = transformDeclForClientCodeGen(outDir, preDeclDir, compilerOptions);
    progress?.increment();

    // Transform the .js files, so they'll work in a service.
    logVerbose(`Transforming server-side js...`);
    const schemaDir = transformJavaScriptForServiceExecution(outDir, preSchemaDir, compilerOptions);
    progress?.increment();

    return {schemaDir, declDir, permissionAssignments, authorizeAssignments};
}

