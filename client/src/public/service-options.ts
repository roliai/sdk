export class ServiceOptions {
    constructor(public enableVerboseLogging: boolean = true,
                public enableMessageTracing: boolean = true,
                public debugLogHeader: string = "[roli]") {
    }
}