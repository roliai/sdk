import {createContext, FunctionComponent, ReactNode, useContext} from "react";
import type {RoliClient} from "roli-client"

/**
 * Non-exported context so we can force how it's consumed and provided.
 */
const RoliContext = createContext<RoliClient | null>(null);

/**
 * Context provider with a required value.
 */
interface RoliProviderProps {
    client: RoliClient;
    children: ReactNode;
}

export const RoliProvider: FunctionComponent<RoliProviderProps> = ({
// @ts-ignore
                                                                         client,
// @ts-ignore
                                                                         children
                                                                     }) => {
// @ts-ignore
    return <RoliContext.Provider value={client} children={children} />;
};

/**
 * Context consumer where that value is non-nullable.
 */
interface RoliConsumerProps {
    children: (value: RoliClient) => ReactNode;
}

// @ts-ignore
export const RoliConsumer: FunctionComponent<RoliConsumerProps> = ({children}) => {
    return (
        <RoliContext.Consumer>
            {(client: RoliClient | null) => {
                if (client === null) {
                    throw new Error(
                        "<RoliConsumer /> used without a <RoliProvider /> in the tree."
                    );
                }

                return children(client);
            }}
        </RoliContext.Consumer>
    );
};

/**
 * Hook so you can get the Roli Client from the context without needing to do null checks.
 */
export const useRoliClient = (): RoliClient => {
    const client = useContext(RoliContext);
    if (client === null) {
        throw new Error(
            "useRoliClient() called without a <RoliProvider /> in the tree."
        );
    }
    return client;
};
