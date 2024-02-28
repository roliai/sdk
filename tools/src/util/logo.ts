import chalk from "chalk";
import * as figlet from "figlet";
export {Fonts} from "figlet";

export const DefaultFont = "Invita";

export function showLogo(font: figlet.Fonts = DefaultFont) {
    //display the header
    console.log(chalk.greenBright(
        figlet.textSync('Roli', font)
    ));
    console.log(chalk.gray("Copyright (c) 2024 Roli.ai, Inc. All Rights Reserved."));
    console.log()
}