const fs = require("fs");
const path = require("path");


let INSTANCE;
let COUNT;
let ID;
let LOG_PREFIX = null;

function setLogPrefix(prefix) {
    LOG_PREFIX = prefix;
}

function getLogPrefix() {
    return LOG_PREFIX ? LOG_PREFIX : "";
}

async function test(test_name, func) {
    console.log(`${getLogPrefix()}++ Test: ` + test_name);
    await func();
    console.log(`${getLogPrefix()}== OK`);
}

async function barrierWait(barrierId) {
    barrierId = String(barrierId).toUpperCase()
    const d = path.join("/tmp/", INSTANCE, barrierId);
    if (!fs.existsSync(d))
        fs.mkdirSync(d, {recursive: true});
    const myFile = path.join(d, String(ID));
    const confFile = path.join(d, "confirm");
    fs.writeFileSync(myFile, "stuff");
    console.log(`${getLogPrefix()} ????? Waiting for barrier ${barrierId}...`);
    return new Promise(resolve => {
        const intervalId = setInterval(() => {
            const files = fs.readdirSync(d);
            let done = false;
            if (files.length === COUNT) {
                fs.writeFileSync(confFile, "stuff");
                done = true;
            } else if (files.length === COUNT + 1) {
                for (let i = 0; i < COUNT; ++i) {
                    fs.unlinkSync(path.join(d, String(i)));
                }
                fs.unlinkSync(confFile);
                done = true;
            }
            if (done) {
                console.log(`${getLogPrefix()} ===== Barrier ${barrierId} waited successfully`);
                clearInterval(intervalId);
                resolve();
            }
        }, 500);
    });
}

function run(suites, shutdown) {
    const args = process.argv.slice(2);

    INSTANCE = String(args[0]);
    COUNT = Number(args[1]);
    ID = Number(args[2]);

    if (!(suites instanceof Array)) {
        suites = [suites];
    }

    if (ID > COUNT - 1) {
        console.error("Invalid ID");
        process.exitCode = 1;
        return;
    }

    if (suites.length !== COUNT) {
        console.error("Count must match the number of suites");
        process.exitCode = 1;
        return;
    }

    suites[ID](INSTANCE).then(value => {
        // don't change this. .test-browser.sh looks for it to know everything worked.
        // Also, the reason I'm not just using process.exit(1) is because browserify freezes if I use process.
        console.log(`${getLogPrefix()}####### All tests completed successfully #######`);
        process.exit(0);
    }).catch(reason => {
        console.error(`${getLogPrefix()}!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`);
        console.error(`${getLogPrefix()}!!!!!!! Failure: ${reason} !!!!!!!`);
        process.exit(1);
    });
}

module.exports = {test, run, barrierWait, getLogPrefix, setLogPrefix};