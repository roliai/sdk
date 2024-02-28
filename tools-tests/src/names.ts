import path from "node:path";

function logVar(name: string, val: string) {
    console.log(`${name}: ${val}`);
}

export const RUN_DIR = path.join(process.env.ROLI_CLIENT_TESTS_DIR!, "run");
logVar("RUN_DIR", RUN_DIR);

export const SRC_DIR = path.join(process.env.ROLI_CLIENT_TESTS_DIR!, "src");
logVar("SRC_DIR", SRC_DIR);

export const SERVICES_DIR_NAME = "services";

export const EXERCISE_TRACKER_SERVICE_NAME = "exercise-tracker";
export const METHOD_AND_SERIALIZATION_SERVICE_NAME = "method-and-serialization";
export const MEMORY_CAP_SERVICE_NAME = "memory-cap";
export const DOCTORSNOTES_SERVICE_NAME = "doctorsnotes";
export const DOCTORSNOTES_MODEL_KEY = "doctorsnotes-model";
export const DOCTORS_NOTES_MODEL_FILE = "doctorsnotes-model.json";

export const ENABLE_DOCTORSNOTES_TEST = process.env.ENABLE_DOCTORSNOTES_TEST == "1";
export const ENABLE_EXERCISE_TRACKER_TEST = process.env.ENABLE_EXERCISE_TRACKER_TEST == "1";
export const ENABLE_METHOD_AND_SERIALIZATION_TEST = process.env.ENABLE_METHOD_AND_SERIALIZATION_TEST == "1";
export const ENABLE_MEMORY_CAP_TEST = process.env.ENABLE_MEMORY_CAP_TEST == "1";