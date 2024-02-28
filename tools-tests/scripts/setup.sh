#!/usr/bin/env bash
set -ex
cd $(dirname "${0}")

./compile.sh $@
cd ../dist

INSTANCE=$(uuidgen)
mkdir -p "/tmp/${INSTANCE}"
OUT_FILE="/tmp/${INSTANCE}/setup.out"

if ! node ./setup.js | tee "${OUT_FILE}" 2>&1; then
    echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
    echo "!! Setup failed to start"
    cat "${OUT_FILE}"
    exit 1
fi

WORKED_STRING="All tests completed successfully"

if ! grep "${WORKED_STRING}" "${OUT_FILE}" > /dev/null; then
    echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
    echo "!! Setup failed to run completely"
    cat "${OUT_FILE}"
    exit 1
fi
