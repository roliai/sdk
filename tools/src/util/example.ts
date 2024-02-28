import fs from "fs";
import path from 'path';
import {logLocalError} from "./logging";
import jszip from "jszip";

function replaceExampleServiceName(file: string, serviceName: string) {
    if (!fs.existsSync(file))
        throw new Error(logLocalError(`${file} does not exist`));
    let code = fs.readFileSync(file, {encoding: "utf8", flag: "r"});
    code = code.split("MY-SERVICE-NAME").join(serviceName)
    fs.writeFileSync(file, code, {encoding: "utf-8"});
}

async function extractExample(projectDir: string, exampleZipFile: string) {
    const exampleZip = path.resolve(__dirname, "..", exampleZipFile);
    const content = fs.readFileSync(exampleZip);
    const zip = new jszip();
    const result = await zip.loadAsync(content);
    for(const key of Object.keys(result.files)) {
        const item = result.files[key];
        if(item.dir) {
            const dir = path.join(projectDir, item.name);
            fs.mkdirSync(dir, {recursive: true});
        } else {
            const file = path.join(projectDir, item.name);
            fs.writeFileSync(file, Buffer.from(await item.async('arraybuffer')));
        }
    }
}