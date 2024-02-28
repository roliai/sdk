#!/usr/bin/env bash
set -ex
cd "$(dirname "${0}")"
cd ..

if [ "$#" -ne 4 ]; then
    echo "${0}: Illegal number of parameters: 4 required"
    exit 1
fi

TEST=${1}
TYPE=${2} #esm or cjs
RUNNER=${3} #shared or single
BROWSER=${4}

STAGE_DIR="./stage/${TEST}-${TYPE}"
DIST_DIR="./dist/${TEST}-${TYPE}"

rm -rf "${STAGE_DIR}"
rm -rf "${DIST_DIR}"

if [ "${TYPE}" == "cjs" ]; then
    EXT="js"
else
    EXT="mjs"
fi

compile() {
    rm -rf "${1}"
    mkdir -p "${1}"
    cat "./src/${TEST}-import-${TYPE}.in.${EXT}" > "${1}/${TEST}-tests.${EXT}"
    cat "./src/${TEST}-tests.in.mjs" >> "${1}/${TEST}-tests.${EXT}"
    cp "./src/${RUNNER}-runner.js" "${1}/"
    cp "./src/assert.js" "${1}/"
}

if [ "${BROWSER}" = true ]; then
    compile "${STAGE_DIR}"
    mkdir -p "${DIST_DIR}"
    ./node_modules/.bin/esbuild "${STAGE_DIR}/${TEST}-tests.${EXT}" --bundle --outfile="${DIST_DIR}/${TEST}-tests.bundle.${EXT}"
else
    compile "${DIST_DIR}"
fi

rm -rf ./stage