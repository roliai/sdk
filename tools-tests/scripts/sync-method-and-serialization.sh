#!/usr/bin/env bash
set -ex
cd $(dirname "${0}")
cd ..

# Copy the test code from the native tests and use that as the backend
rm -rf "${ROLI_CLIENT_TESTS_DIR}/src/services/method-and-serialization"
cp -rv "${ROLI_CPP_TEST_DATA_DIR}/contract_callable_method_tests/MethodAndSerialization" "${ROLI_CLIENT_TESTS_DIR}/src/services/method-and-serialization" > /dev/null