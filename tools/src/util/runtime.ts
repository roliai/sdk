import fs from "fs";
import path from "path";

export function writeRuntime(targetDir: string, includeDefs: boolean, includeStubs: boolean) : string[] {
    if (!fs.existsSync(targetDir))
        fs.mkdirSync(targetDir);

    const sourceDir = path.resolve(__dirname, "..", "templates/runtime");
    let list = fs.readdirSync(sourceDir);

    let copied: string[] = [];
    list.forEach(function (fileName) {
        if((includeDefs && fileName.endsWith('.d.ts')) ||
            (includeStubs && fileName.endsWith('.js'))) {
            const sourceFile = path.join(sourceDir, fileName);
            const targetFile = path.join(targetDir, fileName);
            fs.copyFileSync(sourceFile, targetFile);
            copied.push(targetFile);
        }
    });

    return copied;
}