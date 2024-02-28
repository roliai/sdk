#!/usr/bin/env node
import chalk from "chalk";
import {executeRoli} from "./command/roli";
import {logIfNotAlready} from "./util/logging";

function main() {
    try{
        executeRoli();
    }
    catch(e) {
        logIfNotAlready(e);
    }
}

main();
