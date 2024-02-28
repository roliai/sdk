#!/usr/bin/env bash
set -e
cd $(dirname ${0})

TEST="memory-cap"
./.compile.sh ${TEST} cjs single false
./.run-single.sh ${TEST} cjs

./.compile.sh ${TEST} esm single false
./.run-single.sh ${TEST} esm
