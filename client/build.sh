#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
source "${ROLI_ROOT_DIR}/.roli.env"

if [ "${#}" == 1 ] && [ "${1}" == "--ci" ]; then
    set -x
    [ -z "${BUILD_TARGET}" ] && echo "Missing BUILD_TARGET" && exit 1
    [ -z "${IS_PRODUCTION}" ] && echo "Missing IS_PRODUCTION" && exit 1
    [ -z "${IS_TEST}" ] && echo "Missing IS_TEST" && exit 1
    [ -z "${IS_DEV}" ] && echo "Missing IS_DEV" && exit 1
    [ -z "${BUILD_TYPE_L}" ] && echo "Missing BUILD_TYPE_L" && exit 1
else
    if [ ! "${#}" == 2 ]; then
        echo "error: Invalid options specified"
        echo $(basename ${0})" --ci | <target> <type>"
        echo "  target: dev | test | production"
        echo "  type: debug | release"
        exit 1
    fi

    export BUILD_TARGET="${1}"

    if [ "${2}" == "debug" ]; then
        export BUILD_TYPE_L="debug"
    elif [ "${2}" == "release" ]; then
        export BUILD_TYPE_L="release"
    else
        echo "error: Invalid build type \"${2}\""
        exit 1
    fi
fi

if [ ! -f "./config.${BUILD_TARGET}.${BUILD_TYPE_L}.stamp" ]; then
    echo "error: Must render the configuration first"
    exit 1
fi

if [ "${BUILD_TYPE_L}" == "debug" ]; then
    export NODE_ENV="development"
elif [ "${BUILD_TYPE_L}" == "release" ]; then
    export NODE_ENV="production"
fi

echo "Building for the ${BUILD_TARGET} environment in ${BUILD_TYPE_L} mode"

DIST_DIR="./dist"
rm -rf ${DIST_DIR}

TSC=./node_modules/.bin/tsc

echo "Building for CommonJS..."
${TSC} -p ./tsconfig-build-cjs.json --outDir "${DIST_DIR}/cjs"

echo "Building for ESM..."
${TSC} -p ./tsconfig-build-esm.json --outDir "${DIST_DIR}/esm"

cp "${ROLI_ROOT_DIR}/README.md" ${DIST_DIR}/

echo "Creating package.json..."
DIST_DIR=${DIST_DIR} node ./setup-npm-package.js