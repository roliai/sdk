import chalk from "chalk";
import * as figlet from "figlet";

export function showLogo() {
    //display the header
    console.log(chalk.greenBright(
        figlet.textSync('Roli', {"font": "Invita"})
    ));
    console.log(chalk.gray("Copyright (c) 2024 Roli.ai, Inc. All Rights Reserved."));
    console.log()
}