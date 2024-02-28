#!/usr/bin/env bash
set -ex
cd $(dirname $0)
cd ..

if [ "$#" -ne 3 ]; then
    echo "${0}: Illegal number of parameters: 3 required"
    exit 1
fi

TEST=${1}
TYPE=${2} #esm or cjs
COUNT=${3}
INSTANCE=$(uuidgen)

if [ ${TYPE} == "cjs" ]; then
    EXT="js"
else
    EXT="mjs"
fi

DIST_DIR="./dist/${TEST}-${TYPE}"

start_test() {
    NODE_ENV=development node "${DIST_DIR}/${TEST}-tests.${EXT}" "${INSTANCE}" "${COUNT}" "${1}" | tee "${2}" 2>&1
}

length=$((${COUNT} - 1))

mkdir -p "/tmp/${INSTANCE}"

pids=""
for i in $( seq 0 $length ); do
    TEST_OUT_FILE="${RENDER_DIR}/${TEST}-shared-${TYPE}-${i}.log"
    (start_test "${i}" "${TEST_OUT_FILE}") &
    pids+=" $!"
done

ANY_FAILED=false
for p in $pids; do
    if ! wait $p; then
        ANY_FAILED=true
    fi
done

WORKED_STRING="All tests completed successfully"

set +e
for i in $( seq 0 $length ); do
    TEST_OUT_FILE="${RENDER_DIR}/${TEST}-shared-${TYPE}-${i}.log"
    if ! grep "${WORKED_STRING}" "${TEST_OUT_FILE}" > /dev/null;
    then
        echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
        echo "!! Node shared test ${TEST}-${TYPE} $((i + 1))/${COUNT} failed"
        cat "${TEST_OUT_FILE}"
        ANY_FAILED=true
    fi
done

if ${ANY_FAILED}; then
    exit 1
else
    exit 0
fi
