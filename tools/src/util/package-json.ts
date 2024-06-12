import fs from "fs";
import {logWarning} from "./logging";

export function getPackageJsonIndentionRule(jsonStr: string): any {
    const def = {spaces: true, count: 2};
    const re = /^(\s*)"name"/m;
    let match = re.exec(jsonStr);
    if (!match) {
        logWarning("Unknown indention found in package.json, using npm default of 2 spaces");
        return def;
    }
    const spaceCount = (match[1].match(/ /g) || []).length;
    const tabCount = (match[1].match(/\t/g) || []).length;
    if (spaceCount && tabCount) {
        logWarning("Inconsistent indention found in package.json, using npm default of 2 spaces");
        return def;
    }
    if (!spaceCount && !tabCount) {
        logWarning("Unknown indention found in package.json, using npm default of 2 spaces");
        return def;
    }

    if (spaceCount)
        return {spaces: true, count: spaceCount};

    if (tabCount)
        return {spaces: false};
}

function updatePackageJson(packageJsonFile: string, withPackageJson: (obj: {}) => void) {
    let packageJsonStr = fs.readFileSync(packageJsonFile, {encoding: "utf8"});
    let indentionRule = getPackageJsonIndentionRule(packageJsonStr);
    let packageJsonObj = JSON.parse(packageJsonStr);

    withPackageJson(packageJsonObj);

    const indent = indentionRule.spaces ? indentionRule.count : "\t";
    let updatedPackageJsonStr = JSON.stringify(packageJsonObj, null, indent);
    fs.writeFileSync(packageJsonFile, updatedPackageJsonStr);
}

export function addServicePackageDependency(packageJsonFile: string, servicePackageName: string, relRootPath: string) {
    updatePackageJson(packageJsonFile, (obj:{}): void => {
        if (!obj.hasOwnProperty("dependencies")) {
            // @ts-ignore
            obj['dependencies'] = {};
        }

        // @ts-ignore
        obj['dependencies'][servicePackageName] = `file:./${relRootPath}`
    });
}



export function changePackageName(packageJsonFile: string, packageName: string) {
    updatePackageJson(packageJsonFile, (obj:{}):void => {
        // @ts-ignore
        obj["name"] = packageName;
    });
}