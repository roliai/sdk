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

async function internalRun(suites) {
    if(Array.isArray(suites)) {
        for(const suite of suites) {
            await suite();
        }
    } else {
        await suites();
    }
}

function run(suites, shutdown) {
    internalRun(suites).then(() => {
        shutdown();
    
        // don't change this. test-browser.sh looks for it to know everything worked.
        // Also, the reason I'm not just using process.exit(1) is because browserify freezes if I use process.
        console.log(`${getLogPrefix()}####### All tests completed successfully #######`);
        
        if (typeof window !== 'undefined') {
            window.close();
        }

        if(typeof process !== 'undefined') {
            process.exit(0);
        }
    }).catch(reason => {
        shutdown();

        console.error(`${getLogPrefix()}!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`);
        console.error(`${getLogPrefix()}!!!!!!! Failure: ${reason} !!!!!!!`);
        console.trace(reason);
        
        if (typeof window !== 'undefined') {
            window.close();
        }
        
        if(typeof process !== 'undefined') {
            process.exit(1);
        }
    });    
}

module.exports = {test, run, getLogPrefix, setLogPrefix};