import {SERVICE_WARNINGS} from "../service-notice";
// @ts-ignore
import {box} from "ascii-box";

export function showServiceWarning() {
    for(let serviceWarning of SERVICE_WARNINGS) {
        if(serviceWarning.show) {
            console.log(box(
                `${serviceWarning.title} - ${serviceWarning.date.toLocaleString()}

${serviceWarning.details}`,
                {
                    border: 'round',
                    color: serviceWarning.color,
                    maxWidth: serviceWarning.maxWidth
                }
            ));
        }
    }
}