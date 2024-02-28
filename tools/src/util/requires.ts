export function requiresTruthy(name: string, value: any) {
    if(!value) {
        throw new Error(`${name} was falsy when it needed to be truthy`);
    }
}
export function requiresAtLeastOneElement(name: string, value: any[]) {
    if(!value || value.length == 0) {
        throw new Error(`${name} array had no elements when it needed to have at least one`);
    }
}