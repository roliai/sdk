#!/usr/bin/env bash
set -ex
cd $(dirname ${0})
cd ..

if [ "$#" -ne 2 ]; then
    echo "${0}: Illegal number of parameters: 2 required"
    exit 1
fi

TEST=${1}
TYPE=${2}

DIST_DIR="./dist/${TEST}-${TYPE}"
TEST_OUT_FILE="${RENDER_DIR}/${TEST}-single-${TYPE}.log"

rm -f ${TEST_OUT_FILE}

if [ "${TYPE}" == "cjs" ]; then
    EXT="js"
else
    EXT="mjs"
fi

set +e
node "${DIST_DIR}/${TEST}-tests.${EXT}" | tee "${TEST_OUT_FILE}" 2>&1
set -e

WORKED_STRING="All tests completed successfully"

if ! grep "${WORKED_STRING}" "${TEST_OUT_FILE}" > /dev/null;
then
    echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
    echo "!! Node test ${TEST}-${TYPE} failed"
    cat "${TEST_OUT_FILE}"
    exit 1
fi
