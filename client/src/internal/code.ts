// THIS FILE WAS CODE GENERATED

export enum Code {
    Ok = 1,
    InvalidRequest = 2,
    InvalidLogContext = 3,
    ScriptEngine_SessionDoesNotExist = 4,
    ScriptEngine_AtLeastOneDataOrEndpointRequired = 5,
    ScriptEngine_AtLeastOneFileRequired = 6,
    ScriptEngine_ClassNotFound = 7,
    ScriptEngine_MethodNotFound = 8,
    ScriptEngine_CannotCallMethodOnClassType = 9,
    ScriptEngine_NoCode = 10,
    ScriptEngine_BadFileId = 11,
    ScriptEngine_FailedToCompileModuleUnknownReason = 12,
    ScriptEngine_FailedToInstanciateModuleUnknownReason = 13,
    ScriptEngine_FailedToEvaluateModuleUnknownReason = 14,
    ScriptEngine_UnableToGetMethod = 15,
    ScriptEngine_UnableToGetMethodBecauseItWasNotAFunction = 16,
    ScriptEngine_UnableToCallMethod = 17,
    ScriptEngine_UnknownFunctionCallFailure = 18,
    ScriptEngine_DuplicateModuleName = 19,
    ScriptEngine_UnsupportedValueType = 20,
    ScriptEngine_UnableToSetArrayValue = 21,
    ScriptEngine_UnableToSetObjectValue = 22,
    ScriptEngine_UnexpectedPromiseStatePending = 23,
    ScriptEngine_UnhandledPromiseRejection = 24,
    ScriptEngine_TimedOutWaitingForPromiseResult = 25,
    Datastore_UnsavedChanges = 26,
    Datastore_TypeMismatch = 27,
    Datastore_ObjectDeleted = 28,
    Datastore_WriteConflictTryAgain = 29,
    Datastore_ObjectNotFound = 30,
    Datastore_Unknown = 31,
    Datastore_MustGetLatestObject = 32,
    Datastore_DuplicateObject = 33,
    Datastore_ObjectInstanceCorrupted = 34,
    Datastore_ObjectPropertiesIndexCorrupted = 35,
    Datastore_ClientHasVersionInvalid = 36,
    Datastore_UnableToOpen = 37,
    Datastore_UnableToCreateDirectory = 38,
    Datastore_UnknownSystemError = 39,
    Datastore_DeletedFlagExists = 40,
    Datastore_DeletedFileExists = 41,
    Datastore_FailedToSetInitialServiceVersion = 42,
    Datastore_ServiceIndexCorrupted = 43,
    Datastore_ServiceSourceCorrupted = 44,
    Datastore_ServiceIndexNotFound = 45,
    Datastore_ServiceSourceNotFound = 46,
    Validator_ClientMustUpgrade = 50,
    Validator_InvalidFlatbuffer = 51,
    Validator_Forbidden = 52,
    Validator_PrimaryKeyTooLarge = 53,
    Validator_PrimaryKeyTooSmall = 54,
    Validator_InvalidRequest = 55,
    Innerspace_ConnectionFault = 58,
    Innerspace_RequestTooLarge = 59,
    Innerspace_Shutdown = 60,
    Innerspace_UnableToResolveHostPort = 61,
    Innerspace_NoEndpoints = 62,
    Launcher_TimedOutWhileGettingService = 64,
    Launcher_FailedToSpawnService = 65,
    Service_ServiceDeleted = 67,
    HttpCallFactory_InvalidHostPort = 68,
    HttpCall_UnableToSetClientHostname = 69,
    HttpCall_FailedToResolveHostname = 70,
    HttpCall_UnableToConnect = 71,
    HttpCall_UnableToPerformSslHandshake = 72,
    HttpCall_FailedToWriteToServerStream = 73,
    HttpCall_FailedToReadFromServerStream = 74,
    Config_InvalidKey = 75,
    Config_ValueNotFound = 76
}

export function getCodeName(code: Code) {
    switch (code) {
        case Code.Ok:
            return 'Ok';
        case Code.InvalidRequest:
            return 'InvalidRequest';
        case Code.InvalidLogContext:
            return 'InvalidLogContext';
        case Code.ScriptEngine_SessionDoesNotExist:
            return 'ScriptEngine_SessionDoesNotExist';
        case Code.ScriptEngine_AtLeastOneDataOrEndpointRequired:
            return 'ScriptEngine_AtLeastOneDataOrEndpointRequired';
        case Code.ScriptEngine_AtLeastOneFileRequired:
            return 'ScriptEngine_AtLeastOneFileRequired';
        case Code.ScriptEngine_ClassNotFound:
            return 'ScriptEngine_ClassNotFound';
        case Code.ScriptEngine_MethodNotFound:
            return 'ScriptEngine_MethodNotFound';
        case Code.ScriptEngine_CannotCallMethodOnClassType:
            return 'ScriptEngine_CannotCallMethodOnClassType';
        case Code.ScriptEngine_NoCode:
            return 'ScriptEngine_NoCode';
        case Code.ScriptEngine_BadFileId:
            return 'ScriptEngine_BadFileId';
        case Code.ScriptEngine_FailedToCompileModuleUnknownReason:
            return 'ScriptEngine_FailedToCompileModuleUnknownReason';
        case Code.ScriptEngine_FailedToInstanciateModuleUnknownReason:
            return 'ScriptEngine_FailedToInstanciateModuleUnknownReason';
        case Code.ScriptEngine_FailedToEvaluateModuleUnknownReason:
            return 'ScriptEngine_FailedToEvaluateModuleUnknownReason';
        case Code.ScriptEngine_UnableToGetMethod:
            return 'ScriptEngine_UnableToGetMethod';
        case Code.ScriptEngine_UnableToGetMethodBecauseItWasNotAFunction:
            return 'ScriptEngine_UnableToGetMethodBecauseItWasNotAFunction';
        case Code.ScriptEngine_UnableToCallMethod:
            return 'ScriptEngine_UnableToCallMethod';
        case Code.ScriptEngine_UnknownFunctionCallFailure:
            return 'ScriptEngine_UnknownFunctionCallFailure';
        case Code.ScriptEngine_DuplicateModuleName:
            return 'ScriptEngine_DuplicateModuleName';
        case Code.ScriptEngine_UnsupportedValueType:
            return 'ScriptEngine_UnsupportedValueType';
        case Code.ScriptEngine_UnableToSetArrayValue:
            return 'ScriptEngine_UnableToSetArrayValue';
        case Code.ScriptEngine_UnableToSetObjectValue:
            return 'ScriptEngine_UnableToSetObjectValue';
        case Code.ScriptEngine_UnexpectedPromiseStatePending:
            return 'ScriptEngine_UnexpectedPromiseStatePending';
        case Code.ScriptEngine_UnhandledPromiseRejection:
            return 'ScriptEngine_UnhandledPromiseRejection';
        case Code.ScriptEngine_TimedOutWaitingForPromiseResult:
            return 'ScriptEngine_TimedOutWaitingForPromiseResult';
        case Code.Datastore_UnsavedChanges:
            return 'Datastore_UnsavedChanges';
        case Code.Datastore_TypeMismatch:
            return 'Datastore_TypeMismatch';
        case Code.Datastore_ObjectDeleted:
            return 'Datastore_ObjectDeleted';
        case Code.Datastore_WriteConflictTryAgain:
            return 'Datastore_WriteConflictTryAgain';
        case Code.Datastore_ObjectNotFound:
            return 'Datastore_ObjectNotFound';
        case Code.Datastore_Unknown:
            return 'Datastore_Unknown';
        case Code.Datastore_MustGetLatestObject:
            return 'Datastore_MustGetLatestObject';
        case Code.Datastore_DuplicateObject:
            return 'Datastore_DuplicateObject';
        case Code.Datastore_ObjectInstanceCorrupted:
            return 'Datastore_ObjectInstanceCorrupted';
        case Code.Datastore_ObjectPropertiesIndexCorrupted:
            return 'Datastore_ObjectPropertiesIndexCorrupted';
        case Code.Datastore_ClientHasVersionInvalid:
            return 'Datastore_ClientHasVersionInvalid';
        case Code.Datastore_UnableToOpen:
            return 'Datastore_UnableToOpen';
        case Code.Datastore_UnableToCreateDirectory:
            return 'Datastore_UnableToCreateDirectory';
        case Code.Datastore_UnknownSystemError:
            return 'Datastore_UnknownSystemError';
        case Code.Datastore_DeletedFlagExists:
            return 'Datastore_DeletedFlagExists';
        case Code.Datastore_DeletedFileExists:
            return 'Datastore_DeletedFileExists';
        case Code.Datastore_FailedToSetInitialServiceVersion:
            return 'Datastore_FailedToSetInitialServiceVersion';
        case Code.Datastore_ServiceIndexCorrupted:
            return 'Datastore_ServiceIndexCorrupted';
        case Code.Datastore_ServiceSourceCorrupted:
            return 'Datastore_ServiceSourceCorrupted';
        case Code.Datastore_ServiceIndexNotFound:
            return 'Datastore_ServiceIndexNotFound';
        case Code.Datastore_ServiceSourceNotFound:
            return 'Datastore_ServiceSourceNotFound';
        case Code.Validator_ClientMustUpgrade:
            return 'Validator_ClientMustUpgrade';
        case Code.Validator_InvalidFlatbuffer:
            return 'Validator_InvalidFlatbuffer';
        case Code.Validator_Forbidden:
            return 'Validator_Forbidden';
        case Code.Validator_PrimaryKeyTooLarge:
            return 'Validator_PrimaryKeyTooLarge';
        case Code.Validator_PrimaryKeyTooSmall:
            return 'Validator_PrimaryKeyTooSmall';
        case Code.Validator_InvalidRequest:
            return 'Validator_InvalidRequest';
        case Code.Innerspace_ConnectionFault:
            return 'Innerspace_ConnectionFault';
        case Code.Innerspace_RequestTooLarge:
            return 'Innerspace_RequestTooLarge';
        case Code.Innerspace_Shutdown:
            return 'Innerspace_Shutdown';
        case Code.Innerspace_UnableToResolveHostPort:
            return 'Innerspace_UnableToResolveHostPort';
        case Code.Innerspace_NoEndpoints:
            return 'Innerspace_NoEndpoints';
        case Code.Launcher_TimedOutWhileGettingService:
            return 'Launcher_TimedOutWhileGettingService';
        case Code.Launcher_FailedToSpawnService:
            return 'Launcher_FailedToSpawnService';
        case Code.Service_ServiceDeleted:
            return 'Service_ServiceDeleted';
        case Code.HttpCallFactory_InvalidHostPort:
            return 'HttpCallFactory_InvalidHostPort';
        case Code.HttpCall_UnableToSetClientHostname:
            return 'HttpCall_UnableToSetClientHostname';
        case Code.HttpCall_FailedToResolveHostname:
            return 'HttpCall_FailedToResolveHostname';
        case Code.HttpCall_UnableToConnect:
            return 'HttpCall_UnableToConnect';
        case Code.HttpCall_UnableToPerformSslHandshake:
            return 'HttpCall_UnableToPerformSslHandshake';
        case Code.HttpCall_FailedToWriteToServerStream:
            return 'HttpCall_FailedToWriteToServerStream';
        case Code.HttpCall_FailedToReadFromServerStream:
            return 'HttpCall_FailedToReadFromServerStream';
        case Code.Config_InvalidKey:
            return 'Config_InvalidKey';
        case Code.Config_ValueNotFound:
            return 'Config_ValueNotFound';
        default:
            return `InternalError(${code})`;
    }
}