#!/usr/bin/env bash
set -ex
cd $(dirname "${0}")
cd ..

# Copy the example's service code and use that as a test service backend
rm -rf "${ROLI_CLIENT_TESTS_DIR}/src/services/doctorsnotes"
cp -rv "${ROLI_DOCTORSNOTES_DIR}/service" "${ROLI_CLIENT_TESTS_DIR}/src/services/doctorsnotes" > /dev/null