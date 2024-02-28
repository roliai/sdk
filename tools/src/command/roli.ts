import {GlobalOptions} from "../util/global-options";
import {showServiceWarning} from "../util/service-warning";

import {program} from "commander";
import {showLogo as showLogo_} from "../util/logo";

import {createDeleteAccountCommand} from "./delete-account";
import {createDeleteServiceCommand} from "./delete-service";
import {createDeployServiceCommand} from "./deploy-service";
import {createGenerateClientCommand} from "./generate-client";
import {createInitServiceCommand} from "./init-service";
import {createListServicesCommand} from "./list-services";
import {createLoginCommand} from "./login";
import {createLogoutCommand} from "./logout";
import {createSetConnectionInfoCommand} from "./set-connection-info";
import {createGetConnectionInfoCommand} from "./get-connection-info";
import {createDeleteServiceVersionCommand} from "./delete-version";
import {getIsEnterprise} from "../model/connection-info-file";
import {createRegisterModelCommand} from "./register-model";
import {createUnregisterModelCommand} from "./unregister-model";
import {createListModelsCommand} from "./list-models";
import {createGetModelCommand} from "./get-model";

const {version} = require("../package.json");

function createRoliOptions() {
    program.option('--no-logo', "Don't show the Roli logo on start");
    program.on('option:no-logo', function () {
        GlobalOptions.showLogo = false;
    });

    program.option('--version', "Output the version of roli-tools and exit.")
    program.on('option:version', function () {
        console.log(version);
        process.exit(0);
    });

    program.option('--verbose', "Show verbose messages");
    program.on('option:verbose', function () {
        GlobalOptions.verbose = true;
    });

    program.option('--quiet', "Don't show any success/ok messages (implies --no-logo).");
    program.on('option:quiet', function () {
        GlobalOptions.showLogo = false;
        GlobalOptions.quiet = true;
        GlobalOptions.showServiceWarning = false;
    });
}

export function executeRoli() {
    createRoliOptions();

    let start = (showLogo: boolean = true) => {
        if (GlobalOptions.showServiceWarning)
            showServiceWarning();

        if (showLogo && GlobalOptions.showLogo)
            showLogo_();
    }

    //roli init-service
    program.addCommand(createInitServiceCommand(start));

    //roli generate-client
    program.addCommand(createGenerateClientCommand(start));

    //roli deploy-service
    program.addCommand(createDeployServiceCommand(start))

    //roli list-services
    program.addCommand(createListServicesCommand(start));

    //roli delete-service
    program.addCommand(createDeleteServiceCommand(start));

    //roli delete-service-version
    program.addCommand(createDeleteServiceVersionCommand(start));

    //roli set-connection-info
    program.addCommand(createSetConnectionInfoCommand(start));

    //roli get-connection-info
    program.addCommand(createGetConnectionInfoCommand(start));

    //roli register-model
    program.addCommand(createRegisterModelCommand(start));

    //roli unregister-model
    program.addCommand(createUnregisterModelCommand(start));

    //roli list-models
    program.addCommand(createListModelsCommand(start));

    //roli get-model
    program.addCommand(createGetModelCommand(start));

    if (getIsEnterprise()) {
        //roli login
        program.addCommand(createLoginCommand(start));

        //roli logout
        program.addCommand(createLogoutCommand(start));

        //roli delete-account
        program.addCommand(createDeleteAccountCommand(start));
    }

    program.parse(process.argv);
}