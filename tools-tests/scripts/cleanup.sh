#!/usr/bin/env bash
set -ex
cd $(dirname "${0}")

cd ..

WORKED_STRING="All tests completed successfully"

scripts/sync-exercise-tracker.sh

rm -rf dist

./node_modules/.bin/tsc

cd ./dist

INSTANCE=$(uuidgen)
mkdir -p "/tmp/${INSTANCE}"
OUT_FILE="/tmp/${INSTANCE}/cleanup.out"

if ! node ./cleanup.js | tee "${OUT_FILE}" 2>&1; then
    echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
    echo "!! Setup failed to start"
    cat "${OUT_FILE}"
    exit 1
fi

if ! grep "${WORKED_STRING}" "${OUT_FILE}" > /dev/null; then
    echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
    echo "!! Setup failed to run completely"
    cat "${OUT_FILE}"
    exit 1
fi
