import path from "path";
import fs from "fs";

export function readTemplate(templateFileName: string): string {
    let templateFile = path.resolve(__dirname, "..", "templates", templateFileName);
    return fs.readFileSync(templateFile, {flag: "r", encoding: "utf-8"});
}

export function copyTemplate(templateFileName: string, targetFileName: string) {
    let sourceFile = path.resolve(__dirname, "..", "templates", templateFileName);
    const dir = path.dirname(targetFileName);
    if(!fs.existsSync(dir))
        fs.mkdirSync(dir, {recursive: true});
    fs.copyFileSync(sourceFile, targetFileName);
}