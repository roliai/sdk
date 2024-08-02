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
    Datastore_ObjectInstanceIncorrectClassId = 35,
    Datastore_ObjectInstanceIncorrectPrimaryKey = 36,
    Datastore_ObjectPropertiesIndexCorrupted = 37,
    Datastore_FindSessionsIterationFailed = 38,
    Datastore_ClientHasVersionInvalid = 39,
    Datastore_UnableToOpen = 40,
    Datastore_UnableToCreateDirectory = 41,
    Datastore_UnknownSystemError = 42,
    Datastore_DeletedFlagExists = 43,
    Datastore_DeletedFileExists = 44,
    Datastore_FailedToSetInitialServiceVersion = 45,
    Datastore_ServiceIndexCorrupted = 46,
    Datastore_ServiceSourceCorrupted = 47,
    Datastore_ServiceIndexNotFound = 48,
    Datastore_ServiceSourceNotFound = 49,
    Datastore_ServiceAuthorizationCorrupted = 50,
    Validator_ClientMustUpgrade = 52,
    Validator_InvalidFlatbuffer = 53,
    Validator_Forbidden = 54,
    Validator_PrimaryKeyTooLarge = 55,
    Validator_PrimaryKeyTooSmall = 56,
    Validator_InvalidRequest = 57,
    Innerspace_ConnectionFault = 60,
    Innerspace_RequestTooLarge = 61,
    Innerspace_Shutdown = 62,
    Innerspace_UnableToResolveHostPort = 63,
    Innerspace_NoEndpoints = 64,
    Launcher_TimedOutWhileGettingService = 66,
    Launcher_FailedToSpawnService = 67,
    Service_ServiceDeleted = 69,
    HttpCallFactory_InvalidHostPort = 70,
    HttpCall_UnableToSetClientHostname = 71,
    HttpCall_FailedToResolveHostname = 72,
    HttpCall_UnableToConnect = 73,
    HttpCall_UnableToPerformSslHandshake = 74,
    HttpCall_FailedToWriteToServerStream = 75,
    HttpCall_FailedToReadFromServerStream = 76,
    Config_InvalidKey = 77,
    Config_ValueNotFound = 78,
    AccessDenied = 91,
    NotAuthorized = 92
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
        case Code.Datastore_ObjectInstanceIncorrectClassId:
            return 'Datastore_ObjectInstanceIncorrectClassId';
        case Code.Datastore_ObjectInstanceIncorrectPrimaryKey:
            return 'Datastore_ObjectInstanceIncorrectPrimaryKey';
        case Code.Datastore_ObjectPropertiesIndexCorrupted:
            return 'Datastore_ObjectPropertiesIndexCorrupted';
        case Code.Datastore_FindSessionsIterationFailed:
            return 'Datastore_FindSessionsIterationFailed';
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
        case Code.Datastore_ServiceAuthorizationCorrupted:
            return 'Datastore_ServiceAuthorizationCorrupted';
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
        case Code.AccessDenied:
            return 'AccessDenied';
        case Code.NotAuthorized:
            return 'NotAuthorized';
        default:
            return `InternalError(${code})`;
    }
}