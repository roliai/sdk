#!/usr/bin/env bash
set -ex
cd $(dirname ${0})
cd ..

if [ "$#" -ne 2 ]; then
    echo "${0}: Illegal number of parameters: 1 required"
    exit 1
fi

TEST=${1}
BROWSER=${2}
DIST="./dist/${TEST}-cjs/${TEST}-tests.bundle.js"

WORKED_STRING="All tests completed successfully"

run_browser_test() {
    local test_out_file="${RENDER_DIR}/${TEST}-${1}.log"
    export DISPLAY=':99.0'
    Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &
	cat "${DIST}" | ./node_modules/.bin/browser-run --browser "${1}" | tee "${test_out_file}" 2>&1
    if ! grep "${WORKED_STRING}" "${test_out_file}" > /dev/null;
    then		
		echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
		echo "!! ${1} test ${TEST} failed"
		cat "${test_out_file}"
		exit 1
    fi
}

run_browser_test ${BROWSER}
