import ts, {SourceFile, SyntaxKind} from "typescript";
import chalk from "chalk";
import path, {ParsedPath} from "path";
import {
    SERVICE_CLIENT_PACKAGE_NAME_MARKER,
    SERVICE_RUNTIME_PACKAGE_NAME
} from "../constants";
import fs, {PathLike} from "fs";
import {createDir} from "./loud-fs";
import {ErrorAlreadyLogged, logLocalError, logVerbose} from "./logging";
import {AuthorizeAssignment, PermissionAssignment} from "../service/admin";
import {Permission} from "./client-decorator-eval";

const permissionsDecoratorName = "permissions";
const authorizeDecoratorName = 'authorize';

// The server owns the remote object and the client marshals calls to it via a proxy.
const CallableBaseClasses = ['Endpoint', 'Session'];

// Classes that have an underlying RocksDB database object
const ObjectBaseClasses: string[] = ['Endpoint', 'Session', 'Data'];

const modPath = path.posix;

const TRANSFORMER_ERRORS: Map<string, string[]> = new Map<string, string[]>;

function format(str: string, values: string[]): string {
    return str.replace(/{([0-9]+)}/g, function (match, index) {
        return typeof values[index] == 'undefined' ? match : values[index];
    });
}

// RCC = Roli Client Compiler
const COMPILER_ERROR_PREFIX = "RCC";

class TransformerError {
    constructor(public code: number, public fmt: string) {
    }

    message(values: string[]): string {
        const c = this.code.toString();
        return format("[" + chalk.redBright(`${COMPILER_ERROR_PREFIX}${c.padStart(3, '0')}`) + "] " + this.fmt, values);
    }
}

let __code = 1;
const ERR = {
    // Notes:
    // 1. Don't ever change the ordering of these, add new items to the bottom.
    // 2. The number at the end of the keys denote the number of string format arguments.
    CallableGetAccessor_3: new TransformerError(__code++, 'The get accessor {0}.{1} is invalid. {2}s cannot have get/set accessors. Use a regular class method instead.'),
    CallableSetAccessor_3: new TransformerError(__code++, 'The set accessor {0}.{1} is invalid. {2}s cannot have get/set accessors. Use a regular class method instead.'),
    PermissionsDecoratorWrongClass_1: new TransformerError(__code++, 'The @' + permissionsDecoratorName + ' decorator cannot be applied to the class {0}. Only classes that derive from Endpoint, Session, or Data can have permissions.'),
    PermissionsDecoratorOnMethod_0: new TransformerError(__code++, 'The @' + permissionsDecoratorName + ' decorator must be applied to a class, not a method.'),
    AuthorizeDecoratorOnWrongClass_2: new TransformerError(__code++, 'The @' + authorizeDecoratorName + ' decorator cannot be applied to the method {0}.{1}. Only methods in classes that derive from Endpoint or Session can be authorized.'),
    AuthorizeDecoratorOnClass_0: new TransformerError(__code++, 'The @' + authorizeDecoratorName + ' decorator must be applied to a method, not a class.'),
    ObjectPermissionsInvalid_0: new TransformerError(__code++, 'The @' + permissionsDecoratorName + ' decorator has empty, zero, or invalid object permissions.'),
    ObjectPermissionsNoAccessCombined_0: new TransformerError(__code++, "The @" + permissionsDecoratorName + " decorator has an invalid permission value. NoAccess cannot be combined with other permissions."),
    DuplicatePermissionsDecorator_1: new TransformerError(__code++, 'The class {0} has too many @' + permissionsDecoratorName + ' decorators. Only a single @' + permissionsDecoratorName + ' decorator is allowed per class.'),
    DuplicateAuthorizeDecorator_2: new TransformerError(__code++, 'The method {0}.{1} has too many @' + authorizeDecoratorName + ' decorators. Only a single @' + authorizeDecoratorName + ' decorator is allowed per method.'),
    InvalidPermissionsScope_0: new TransformerError(__code++, "The @" + permissionsDecoratorName + " decorator has an invalid scope. Scopes must be non-empty and contain no whitespace."),
    InvalidAuthorizeScope_0: new TransformerError(__code++, "The @" + authorizeDecoratorName + " decorator has an invalid scope. Scopes must be non-empty and contain no whitespace."),
    UnableToEvalDecoratorArguments_1: new TransformerError(__code++, 'Unable to eval decorator arguments. Error: {0}')
}

function addTransformerError(node: ts.Node, error: TransformerError, ...values: string[]) {
    const sourceFile = node.getSourceFile();
    const path = sourceFile.fileName;
    const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const message = `${chalk.gray(`at line ${chalk.yellowBright(`${pos.line + 1}`)}:${pos.character}`)} ${error.message(values)}`;
    if (!TRANSFORMER_ERRORS.has(path))
        TRANSFORMER_ERRORS.set(path, [message]);
    else
        TRANSFORMER_ERRORS.get(path)?.push(message);
}

function hasTransformerErrors() {
    return TRANSFORMER_ERRORS.size > 0;
}

function getTransformerErrorCount(): number {
    let errorCount = 0;
    if (hasTransformerErrors()) {
        for (const value of TRANSFORMER_ERRORS.values())
            errorCount += value.length;
    }
    return errorCount;
}

function consumeAndPrintTransformerErrors() {
    if (!TRANSFORMER_ERRORS || TRANSFORMER_ERRORS.size == 0)
        return null;
    for (const file of TRANSFORMER_ERRORS.keys()) {
        console.log(chalk.yellowBright(`in ${file}:`));
        for (const error of TRANSFORMER_ERRORS.get(file)!) {
            console.log(` ${error}`);
        }
    }
    TRANSFORMER_ERRORS.clear();
}

function getDecoratorName(decorator: ts.Decorator): string {
    const outerExpression = decorator.expression as ts.CallExpression;
    const identifier = outerExpression.expression as ts.Identifier;
    return identifier.escapedText.toString();
}

const AllPermission = Permission.Create | Permission.Read | Permission.Write | Permission.Delete;

type ObjectPermission = {p: Permission; scopes: string[];}
type CallAuthorization = {scopes: string[];}

function validScope(s: any) {
    return typeof s === "string" && s.length > 0 && (s.search(/\s/) == -1);
}

function validateObjectPermission(o: ObjectPermission, node: ts.Node): boolean {
    if (! o.p || o.p.valueOf() === 0 || o.p > AllPermission) {
        addTransformerError(node, ERR.ObjectPermissionsInvalid_0);
        return false; // Invalid
    }

    if (o.p % 2 !== 0 && o.p > 1) {
        addTransformerError(node, ERR.ObjectPermissionsNoAccessCombined_0);
        return false; // NoAccess cannot be combined.
    }

    const scopesOk = o.scopes != null &&
        ((Array.isArray(o.scopes) && o.scopes.length > 0 && o.scopes.every((s, n) => validScope(s))) ||
            // @ts-ignore
            (validScope(o.scopes)));

    if(!scopesOk) {
        addTransformerError(node, ERR.InvalidPermissionsScope_0);
        return false;
    }

    return true;
}

function validateCallAuthorization(c: CallAuthorization, node: ts.Node): boolean {
    const scopesOk = c.scopes != null &&
        ((Array.isArray(c.scopes) && c.scopes.length > 0 && c.scopes.every((s, n) => validScope(s))) ||
            // @ts-ignore
            (validScope(c.scopes)));

    if(!scopesOk) {
        addTransformerError(node, ERR.InvalidAuthorizeScope_0);
        return false;
    }

    return true;
}

let ClientDecoratorEvalCode: string | null = null;
function getClientDecoratorEvalCode() {
    if(!ClientDecoratorEvalCode) {
        const clientDecoratorEvalCode = path.join(__dirname, "client-decorator-eval.js").toString();
        ClientDecoratorEvalCode = fs.readFileSync(clientDecoratorEvalCode).toString();
    }
    return ClientDecoratorEvalCode;
}

function evalDecoratorArguments(expressionText: string) : any {
    const pre = getClientDecoratorEvalCode();
    const code = `${pre}
    ${expressionText}`;
    return eval(code);
}

///////////////////////////////////////////////////

function tryGetPermissionsDecoratorArguments(decorator: ts.Decorator): ObjectPermission[] | null {
    let retval;
    try {
        retval = evalDecoratorArguments(decorator.expression.getFullText());
    } catch (e: any) {
        addTransformerError(decorator, ERR.UnableToEvalDecoratorArguments_1, e.message);
        return null;
    }
    if (Array.isArray(retval)) {
        if (retval.every((p) => validateObjectPermission(p, decorator))) {
            return retval;
        } else {
            return null; // already logged
        }
    } else {
        if (validateObjectPermission(retval, decorator)) {
            return [retval as ObjectPermission];
        } else {
            return null; // already logged
        }
    }
}

function tryGetAuthorizeDecoratorArguments(decorator: ts.Decorator): CallAuthorization[] | null {
    let retval;
    try {
        retval = evalDecoratorArguments(decorator.expression.getFullText());
    } catch (e: any) {
        addTransformerError(decorator, ERR.UnableToEvalDecoratorArguments_1, e.message);
        return null;
    }
    if (Array.isArray(retval)) {
        if (retval.every((c) => validateCallAuthorization(c, decorator))) {
            return retval;
        } else {
            return null; // already logged
        }
    } else {
        if (validateCallAuthorization(retval, decorator)) {
            return [retval as CallAuthorization];
        } else {
            return null; // already logged
        }
    }
}

function getClassName(node: ts.Node) {
    const classDecl = node as ts.ClassDeclaration;
    return classDecl.name?.text!;
}

function getMethodName(node: ts.Node): string {
    const methodDecl = node as ts.MethodDeclaration;
    return (methodDecl.name as ts.Identifier).text;
}

function getLocInfo(sourceFile: ts.SourceFile, node: ts.Node): { fileLine: number, fileColumn: number } {
    const location = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    return {fileColumn: location.character, fileLine: location.line + 1};
}

const ClassMethodHasAuthorizeDecorator = new Set();
const ClassHasPermissionsDecorator = new Set();

export function CreateStageTransformer(permissionAssignments: PermissionAssignment[],
                                       authorizeAssignments: AuthorizeAssignment[]) {
    return (program: ts.Program) => {
        const transformerFactory: (context: any) => (sourceFile: ts.SourceFile) => ts.Node | (ts.Node & undefined) = context => {
            return (sourceFile: ts.SourceFile) => {
                const visitor = (node: ts.Node): ts.Node => {

                        // Doctor the path so compilation will work locally
                        if (node.kind === ts.SyntaxKind.StringLiteral &&
                            node.parent &&
                            node.parent.kind === ts.SyntaxKind.ImportDeclaration) {
                            const literal = node as ts.StringLiteral;
                            const dir = modPath.dirname(sourceFile.fileName);
                            const updated = getUpdatedPath(dir, literal.text);
                            if (updated) {
                                return context.factory.createStringLiteral(updated);
                            }
                        }

                        // @permissions decorator on Object class
                        if (node.kind === ts.SyntaxKind.Decorator &&
                            getDecoratorName(node as ts.Decorator) === permissionsDecoratorName) {

                            if (node.parent.kind === ts.SyntaxKind.ClassDeclaration) {

                                const className = getClassName(node.parent);
                                if (hasBaseClass(ObjectBaseClasses, node.parent)) {
                                    if (!ClassHasPermissionsDecorator.has(className)) {
                                        ClassHasPermissionsDecorator.add(className);
                                        const {fileLine, fileColumn} = getLocInfo(sourceFile, node);
                                        const permissions = tryGetPermissionsDecoratorArguments(node as ts.Decorator);
                                        if (permissions) {
                                            permissionAssignments.push(...permissions.map((op) => {
                                                return {
                                                    className,
                                                    fileColumn,
                                                    fileLine,
                                                    fileName: sourceFile.fileName,
                                                    access: op.p,
                                                    scopes: op.scopes
                                                } as PermissionAssignment;
                                            }));
                                        }
                                    } else {
                                        addTransformerError(node, ERR.DuplicatePermissionsDecorator_1, className);
                                    }
                                } else {
                                    addTransformerError(node, ERR.PermissionsDecoratorWrongClass_1, className!);
                                }
                            } else {
                                addTransformerError(node, ERR.PermissionsDecoratorOnMethod_0);
                            }

                            // Remove the decorators because they can cause side effects.
                            return <ts.Node><unknown>undefined;
                        }

                        // @authorize decorator on a Callable class method
                        if (node.kind === ts.SyntaxKind.Decorator &&
                            getDecoratorName(node as ts.Decorator) === authorizeDecoratorName) {

                            if (node.parent.kind === ts.SyntaxKind.MethodDeclaration) {
                                const className = getClassName(node.parent.parent);
                                const methodName = getMethodName(node.parent);
                                const classMethod = `${className}.${methodName}`;

                                if (hasBaseClass(CallableBaseClasses, node.parent.parent)) {
                                    if (!ClassMethodHasAuthorizeDecorator.has(classMethod)) {
                                        ClassMethodHasAuthorizeDecorator.add(classMethod);

                                        const {fileLine, fileColumn} = getLocInfo(sourceFile, node);
                                        const authorizations = tryGetAuthorizeDecoratorArguments(node as ts.Decorator);
                                        if (authorizations) {
                                            authorizeAssignments.push(...authorizations.map((c) => {
                                                return {
                                                    className,
                                                    methodName,
                                                    fileColumn,
                                                    fileLine,
                                                    fileName: sourceFile.fileName,
                                                    scopes: c.scopes
                                                } as AuthorizeAssignment;
                                            }));
                                        }
                                    } else {
                                        addTransformerError(node, ERR.DuplicateAuthorizeDecorator_2, className, methodName);
                                    }
                                } else {
                                    addTransformerError(node, ERR.AuthorizeDecoratorOnWrongClass_2, className, methodName);
                                }
                            } else {
                                addTransformerError(node, ERR.AuthorizeDecoratorOnClass_0);
                            }

                            // Remove the decorators because they can cause side effects.
                            return <ts.Node><unknown>undefined;
                        }

                        // Callables cannot have getters
                        if (node.kind === ts.SyntaxKind.GetAccessor) {
                            const baseClass = tryGetBaseClass(CallableBaseClasses, node.parent);
                            if (baseClass) {
                                const property = node as ts.GetAccessorDeclaration;
                                const className = (<ts.ClassDeclaration>node.parent).name?.text!;
                                const propertyName = (<ts.Identifier>property.name)?.text;
                                addTransformerError(node, ERR.CallableGetAccessor_3, className!, propertyName, baseClass);
                            }
                        }

                        // Callables can't have setters
                        if (node.kind === ts.SyntaxKind.SetAccessor) {
                            const baseClass = tryGetBaseClass(CallableBaseClasses, node.parent);
                            if (baseClass) {
                                const property = node as ts.GetAccessorDeclaration;
                                const className = (<ts.ClassDeclaration>node.parent).name?.text;
                                const propertyName = (<ts.Identifier>property.name)?.text;
                                addTransformerError(node, ERR.CallableSetAccessor_3, className!, propertyName, baseClass);
                            }
                        }

                        return ts.visitEachChild(node, visitor, context);
                    }
                ;

                return ts.visitNode(sourceFile, visitor);
            };
        };

        return transformerFactory;
    };
}


export const ClientDeclTransformer = (program: ts.Program) => {
    const transformerFactory: (context: any) => (sourceFile: SourceFile) => ts.Node | (ts.Node & undefined) = context => {
        return sourceFile => {
            const visitor = (node: ts.Node): ts.Node => {
                // Change roli imports to import roli-client instead.
                if (node.kind === ts.SyntaxKind.StringLiteral &&
                    node.parent &&
                    node.parent.kind === ts.SyntaxKind.ImportDeclaration) {
                    const literal = node as ts.StringLiteral;
                    if (literal.text.indexOf(SERVICE_RUNTIME_PACKAGE_NAME) > -1) {
                        const updated = literal.text.replace(SERVICE_RUNTIME_PACKAGE_NAME, SERVICE_CLIENT_PACKAGE_NAME_MARKER);
                        return context.factory.createStringLiteral(updated);
                    }
                }

                if (node.kind === ts.SyntaxKind.MethodDeclaration && (tryGetBaseClass("Endpoint", node.parent) || tryGetBaseClass("Session", node.parent))) {
                    const method = node as ts.MethodDeclaration;
                    const methodName = (<ts.Identifier>method.name)?.text;
                    const type = method.type;

                    // Wrap the return type in a Promise
                    let adjustedType;

                    if (type?.kind === ts.SyntaxKind.UnionType) {
                        const unionRef = type as ts.UnionTypeNode;
                        adjustedType = context.factory.createTypeReferenceNode('Promise', [
                            context.factory.createUnionTypeNode(unionRef.types)
                        ]);
                    } else {
                        const typeNode = type as ts.TypeNode;
                        if (!typeNode)
                            throw new Error("Unknown type found");
                        adjustedType = context.factory.createTypeReferenceNode('Promise', [
                            typeNode
                        ]);
                    }

                    return context.factory.updateMethodDeclaration(
                        method,
                        method.modifiers,
                        method.asteriskToken,
                        // From the client's perspective, it's an Async call.
                        context.factory.createIdentifier(methodName),
                        method.questionToken,
                        method.typeParameters,
                        method.parameters,
                        adjustedType ?? undefined,
                        method.body);
                }

                // Remove property declarations off Endpoint/Session classes
                if (node.kind === ts.SyntaxKind.PropertyDeclaration &&
                    (tryGetBaseClass("Endpoint", node.parent) || tryGetBaseClass("Session", node.parent))) {
                    return <ts.Node><unknown>undefined;
                }

                return ts.visitEachChild(node, visitor, context);
            };

            return ts.visitNode(sourceFile, visitor);
        };
    };

    return transformerFactory;
};

function hasBaseClass(baseClassNames: string | string[], node: ts.Node) {
    return !!tryGetBaseClass(baseClassNames, node);
}

function tryGetBaseClass(baseClassNames: string | string[], node: ts.Node): string | null {
    if (node && node.kind === ts.SyntaxKind.ClassDeclaration) {
        const clz = node as ts.ClassDeclaration;
        if (clz.heritageClauses && clz.heritageClauses.length >= 1 &&
            clz.heritageClauses[0].kind === ts.SyntaxKind.HeritageClause) {
            const hc = clz.heritageClauses[0] as ts.HeritageClause;
            if (hc.types && hc.types[0].kind === ts.SyntaxKind.ExpressionWithTypeArguments) {
                const exp = hc.types[0] as ts.ExpressionWithTypeArguments;
                if (exp.expression && exp.expression.kind === ts.SyntaxKind.Identifier) {
                    const ident = exp.expression as ts.Identifier;
                    if (Array.isArray(baseClassNames)) {
                        for (const n of baseClassNames) {
                            if (ident.text === n) {
                                return n;
                            }
                        }
                    } else {
                        if (ident.text === baseClassNames) {
                            return baseClassNames;
                        }
                    }
                }
            }
        }
    }
    return null;
}

export const JavaScriptServiceExecutionTransformer = (program: ts.Program) => {
    const transformerFactory: (context: any) => (sourceFile: SourceFile) => ts.Node | (ts.Node & undefined) = context => {
        return sourceFile => {
            const visitor = (node: ts.Node): ts.Node => {

                // Remove all property declarations
                if (node.kind === ts.SyntaxKind.PropertyDeclaration) {
                    return <ts.Node><unknown>undefined;
                }

                return ts.visitEachChild(node, visitor, context);
            };

            return ts.visitNode(sourceFile, visitor);
        };
    };

    return transformerFactory;
};

class Module {
    public file: ParsedPath;
    public isTypeDef: boolean;
    public isIndex: boolean;
    public path: string;

    constructor(fileName: string, dirName: string) {
        this.file = modPath.parse(modPath.join(dirName, fileName));
        this.isTypeDef = this.file.name.endsWith('.d') && this.file.ext === '.ts';
        this.isIndex = this.file.name === "index" || this.file.name === "index.d";
        if (!this.isIndex) {
            if (this.isTypeDef) {
                const baseName = modPath.basename(this.file.name, '.d');
                this.path = modPath.join(this.file.dir, baseName);
            } else {
                this.path = modPath.join(this.file.dir, this.file.name);
            }
        } else {
            this.path = modPath.join(this.file.dir);
        }
    }
}

let MODULES: Module[];

function getUpdatedPath(fromDir: string, importPath: string): string | null {
    if (path.extname(importPath))
        return null;
    const res = modPath.resolve(fromDir, importPath).toString();
    const i = res.indexOf('/' + SERVICE_RUNTIME_PACKAGE_NAME);
    if (i > -1) {
        const x = res.substring(i + SERVICE_RUNTIME_PACKAGE_NAME.length + 1);
        if (x) {
            return SERVICE_RUNTIME_PACKAGE_NAME + x;
        } else {
            return SERVICE_RUNTIME_PACKAGE_NAME;
        }
    }
    for (const module of MODULES) {
        if (module.path === res) {
            if (module.isTypeDef) {
                return importPath;
            } else {
                let rel = modPath.relative(fromDir, module.file.dir);
                if (module.isIndex) {
                    rel = modPath.join(rel, "index.js");
                } else {
                    rel = modPath.join(rel, module.file.name + ".js");
                }
                if (!rel.startsWith('.')) {
                    rel = './' + rel;
                }
                return rel;
            }
        }
    }
    return null;
}

function parseModules(dir: string): Module[] {
    let files = fs.readdirSync(dir, {withFileTypes: true});
    let modules: Module[] = [];
    for (const file of files) {
        if (file.isDirectory()) {
            const those = parseModules(modPath.join(dir, file.name));
            modules.push(...those);
        } else {
            switch (path.extname(file.name)) {
                case ".ts":
                case ".mts":
                case ".js":
                case ".mjs":
                    modules.push(new Module(file.name, dir));
            }
        }
    }
    return modules;
}

function _findFilesByExtension(baseDir: string,
                               dir: string,
                               extensions: Set<string>,
                               files: string[],
                               badExtensions: Set<string> | null,
                               skipDirs: Set<string> | null,
                               uniqueBaseNames: Set<string> | null): string[] {

    let list = fs.readdirSync(dir);
    list.forEach(function (fileName) {
        const pathName = path.join(dir, fileName);
        let stat = fs.statSync(pathName);
        if (stat && stat.isDirectory()) {
            if (!skipDirs?.has(fileName)) {
                _findFilesByExtension(baseDir, pathName, extensions, files, badExtensions, skipDirs, uniqueBaseNames);
            }
        }
        const ext = path.extname(pathName);
        if (badExtensions && badExtensions.has(ext)) {
            throw new Error(logLocalError('Invalid file type found: ' + pathName));
        } else if (extensions.has(ext)) {
            if (uniqueBaseNames) {
                const p = path.parse(pathName);
                const baseName = path.join(p.dir, p.name);
                if (uniqueBaseNames.has(baseName)) {
                    throw new Error(logLocalError(`Duplicate file found. Cannot have multiple modules with the same base name (name without a file extension). File: ${pathName}`));
                }
                uniqueBaseNames.add(baseName);
            }
            files!.push(pathName);
        }
    });
    return files;
}

function findFilesByExtension(dir: string,
                              extensions: string[],
                              uniqueBaseName: boolean = true,
                              badExtensions: string[] | null,
                              skipDirs: string[] | null) {
    return _findFilesByExtension(
        dir,
        dir,
        new Set<string>(extensions),
        [],
        badExtensions ? new Set<string>(badExtensions) : null,
        skipDirs ? new Set<string>(skipDirs) : null,
        uniqueBaseName ? new Set<string>() : null);
}

export function transformTypeScript(inDir: PathLike,
                                    outDir: PathLike,
                                    compilerOptions: ts.CompilerOptions,
                                    transformer: any,
                                    fileExtensions: string[]): string[] {
    const inDir_ = path.resolve(inDir.toString()).toString();
    const outDir_ = path.resolve(outDir.toString()).toString();

    MODULES = parseModules(inDir_);

    let sourceFileNames = findFilesByExtension(
        inDir_,
        fileExtensions,
        true, // Because that's how the service runtime works; it doesn't care about extensions.
        null,
        [SERVICE_RUNTIME_PACKAGE_NAME]);

    const opts = Object.assign({}, compilerOptions);
    opts.noEmit = true;

    const compilerHost = ts.createCompilerHost(opts, true);
    let program = ts.createProgram(sourceFileNames, opts, compilerHost);
    const sourceFiles: SourceFile[] = [];
    for (const fileName of sourceFileNames) {
        sourceFiles.push(program.getSourceFile(fileName)!);
    }

    const result = ts.transform<ts.SourceFile>(sourceFiles, [transformer(program)], opts);

    if (hasTransformerErrors()) {
        const errorCount = getTransformerErrorCount();
        console.log("\n");
        logLocalError(`${errorCount} error${errorCount > 1 ? "s" : ""} occurred during compilation`);
        consumeAndPrintTransformerErrors();
        throw new ErrorAlreadyLogged();
    }

    createDir(outDir_);

    const printer = ts.createPrinter();
    const outputFiles = [];
    for (const transformedSourceFile of result.transformed) {
        const f = transformedSourceFile.fileName;
        const relTarget = f.substring(inDir_.length);
        const target = path.join(outDir_, relTarget);
        const p = path.dirname(target);
        if (!fs.existsSync(p))
            fs.mkdirSync(p, {recursive: true});

        fs.writeFileSync(target, printer.printFile(transformedSourceFile), {encoding: "utf8"});
        logVerbose(`Transformed ${f}`);
        outputFiles.push(target);
    }
    return outputFiles;
}