#!/usr/bin/env bash
set -ex
cd $(dirname ${0})

# Method and Serialization Tests
TEST="method-and-serialization"
./.compile.sh ${TEST} cjs single false
./.run-single.sh ${TEST} cjs

./.compile.sh ${TEST} esm single false
./.run-single.sh ${TEST} esm

./.compile.sh ${TEST} cjs single true
./.run-browser.sh ${TEST} electron
./.run-browser.sh ${TEST} chrome

# TODO: make Firefox work again
# ./.run-browser.sh ${TEST} firefox