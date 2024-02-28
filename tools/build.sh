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
        echo "  target: local | test | production"
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

if [ ! -f "${ROLI_CLIENT_DIR}/config.${BUILD_TARGET}.${BUILD_TYPE_L}.stamp" ]; then
    echo "error: Must render client configuration first"
    exit 1
fi

if [ ! -d "${ROLI_CLIENT_DIR}/dist" ]; then
    echo "error: Must build client first"
    exit 1
fi

if [ ! -f "./config.${BUILD_TARGET}.${BUILD_TYPE_L}.stamp" ]; then
    echo "error: Must render the configuration first"
    exit 1
fi

if [ "${BUILD_TYPE_L}" == "debug" ]; then
    export NODE_ENV="development"
    SOURCE_MAP=true
    DECLARATION=true
elif [ "${BUILD_TYPE_L}" == "release" ]; then
    export NODE_ENV="production"
    SOURCE_MAP=true
    DECLARATION=true
fi

merge_dependencies() {
    if [ "$#" -ne 3 ]; then
        echo "Usage: merge_dependencies <file1> <file2> <kind>"
        return 1
    fi

    file1=$1
    file2=$2
    kind=$3

    if [ ! -f "$file1" ] || [ ! -f "$file2" ]; then
        echo "Both files must exist."
        return 1
    fi

    # Extract dependencies
    deps1=$(jq ".$kind" $file1)
    deps2=$(jq ".$kind" $file2)

    # Check for conflicting versions
    for key in $(jq -r 'keys[]' <<< "$deps1"); do
        if jq -e ".[\"$key\"]" <<< "$deps2" &>/dev/null; then
            version1=$(jq -r ".[\"$key\"]" <<< "$deps1")
            version2=$(jq -r ".[\"$key\"]" <<< "$deps2")
            if [ "$version1" != "$version2" ]; then
                echo "Conflicting versions found for $key: $version1 vs $version2"
                return 1
            fi
        fi
    done

    # Merge dependencies and update the first file
    jq ".$kind |= (""$deps1"' + '"$deps2"')' $file1 > temp.json && mv temp.json $file1
}

move_dependency() {
    local package_name="$1"
    local package_json="./package.json"

    if [ -z "$package_name" ]; then
        echo "Please provide a package name."
        return 1
    fi

    if [ ! -f "$package_json" ]; then
        echo "$package_json does not exist."
        return 1
    fi

    local version=$(jq -r ".devDependencies[\"$package_name\"]" "$package_json")

    if [ "$version" == "null" ]; then
        echo "Package $package_name not found in devDependencies."
        return 1
    fi

    jq ".dependencies[\"$package_name\"] = .devDependencies[\"$package_name\"] | del(.devDependencies[\"$package_name\"])" "$package_json" > tmp.json && mv tmp.json "$package_json"
}

echo "Merging dependencies between Tools and Client"
merge_dependencies ./package.json ${ROLI_CLIENT_DIR}/package.json dependencies
merge_dependencies ./package.json ${ROLI_CLIENT_DIR}/package.json devDependencies
move_dependency typescript

echo "Embedding the client"
rm -rf ./src/client
cp -r ${ROLI_CLIENT_DIR}/src ./src/client

echo "Building tools for the ${BUILD_TARGET} environment in ${BUILD_TYPE_L} mode"

DIST_DIR=$(readlink -f "./dist")
rm -rf "${DIST_DIR}"

echo "Compiling TypeScript..."
./node_modules/.bin/tsc --outDir "${DIST_DIR}" --sourceMap ${SOURCE_MAP} --declaration ${DECLARATION}

echo "Creating npm package..."
DIST_DIR=${DIST_DIR} node ./setup-npm-package.js

echo "Copying README.md..."
cp "${ROLI_ROOT_DIR}/README.md" "${DIST_DIR}/"

echo "Copying templates..."
mkdir -p "${DIST_DIR}/templates"
cp -r src/templates/* "${DIST_DIR}/templates/"

echo "Updating permissions on index.js..."
chmod +x "${DIST_DIR}/roli.js"