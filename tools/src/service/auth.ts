import {getApp, initializeApp, FirebaseApp} from "@firebase/app";
import {
    getAuth, User, Auth as FirebaseAuth, onAuthStateChanged, signInAnonymously
} from "@firebase/auth";
import {UserImpl} from "@firebase/auth/internal";

import { logLocalError, logVerbose, logWarning} from "../util/logging";
import { FIREBASE_CONFIG } from "../config";
import { LoginFile } from "../model/login-file";
import { getIsEnterprise } from "../model/connection-info-file";

class AuthSession {
    private _user: User | null;
    private readonly _app: FirebaseApp;
    private readonly _auth: FirebaseAuth;

    constructor() {
        initializeApp(FIREBASE_CONFIG);
        this._app = getApp();
        this._auth = getAuth(this._app);
        this._user = null;
        onAuthStateChanged(this._auth, (user) => {
            this._user = user;
            if(user) {
                logVerbose(`Logged in ${user.isAnonymous ? "anonymously" : ""}`);
            } else {
                logVerbose("Logged out");
            }
        });
    }

    get app(): FirebaseApp {
        return this._app;
    }
    get auth(): FirebaseAuth {
        return this._auth;
    }
    get user() : User | null {
        return this._user;
    }
}
let authSession : AuthSession | null;

export function authEnabled() {
    return getIsEnterprise();
}

function ensureAuthEnabled() {
    if(!authEnabled())
        throw new Error(logLocalError('Attempted to access auth when it was disabled'));
}

export async function getIdToken(): Promise<string> {
    ensureAuthEnabled();

    if(!authSession)
        throw new Error(logLocalError("Attempted to get an id token when not logged in"));

    const idToken = await authSession.user?.getIdToken(false);
    if (!idToken)
        throw new Error(logLocalError("Unable to get an id token"));

    return idToken;
}

function persistLoginFromUser(user: User) {
    const userJson = JSON.stringify(<string><unknown>user.toJSON());
    const token = Buffer.from(userJson).toString('base64');
    const loginFile = new LoginFile(token);
    loginFile.write();
}

function getUserFromLogin(session: AuthSession, loginFile: LoginFile) : User {
    // see https://github.com/firebase/firebase-js-sdk/issues/1874
    const u = JSON.parse(Buffer.from(loginFile.token, 'base64').toString());
    return UserImpl._fromJSON(session.auth as any, u);
}

async function innerLoginUser(session: AuthSession, user: User) : Promise<void> {
    try {
        await session.auth.updateCurrentUser(user);
    } catch (e: any) {
        throw new Error(`Unable to login: ${e.message}`);
    }

    if(!session.user) {
        throw new Error(`Unable to login because the user didn't exist when expected`);
    }
}
async function innerLogin(loginFile: LoginFile) : Promise<void> {
    let session = new AuthSession();
    const user = getUserFromLogin(session, loginFile);
    await innerLoginUser(session, user);
    authSession = session;
}
export async function overrwriteLogin(file: string) : Promise<boolean> {
    ensureAuthEnabled();
    
    if(authSession) {
        throw new Error("Cannot overwrite existing auth session");
    }

    const loginFile = LoginFile.tryFromFile(file);
    if(!loginFile) {
        return false; //already logged
    }

    await innerLogin(loginFile);
    return true;
}
export async function loginWithStoredCredentials(): Promise<boolean> {
    ensureAuthEnabled();
    
    if(authSession)
        return true;

    if(!LoginFile.exists()) {
        logWarning("This command requires you to be logged in. Run roli login and run the command again.");
        return false;
    }

    const loginFile = LoginFile.tryOpen();
    if(!loginFile) {
        return false; //already logged
    }

    await innerLogin(loginFile);
    return true;
}
export async function logout(): Promise<void> {
    ensureAuthEnabled();
    
    if(LoginFile.exists()) {
        LoginFile.delete();
        logVerbose("Login file deleted");
    }
    if(authSession) {
        await authSession.auth.signOut();
    }
    authSession = null;
}

export function getIsLoggedInUserAnonymous() : boolean {
    ensureAuthEnabled();

    if(!authSession)
        throw new Error("Not logged in");
    
    if(!authSession.user)
        throw new Error("User does not exist in the session");
    
    return authSession.user.isAnonymous;
}

export async function loginWithUserJson(userJsonObj: any): Promise<void> {
    ensureAuthEnabled();

    if(authSession) {
        throw new Error("Already logged in");
    }

    const session = new AuthSession();    
    const user = UserImpl._fromJSON(session.auth as any, userJsonObj);    
    await innerLoginUser(session, user);

    authSession = session;
    
    persistLoginFromUser(user);
}

export async function loginAnonymously() : Promise<void> {
    ensureAuthEnabled();

    if(authSession) {
        throw new Error("Already logged in");
    }

    const session = new AuthSession();

    try {
        await signInAnonymously(session.auth)
    } catch (e: any) {
        throw new Error(`Unable to login anonymously: ${e.message}`);
    }

    if(!session.user) {
        throw new Error(`Unable to login because the user didn't exist when expected`);
    }

    authSession = session;

    persistLoginFromUser(session.user);
}