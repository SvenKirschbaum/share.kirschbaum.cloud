import React, {useContext} from "react";

export const ConfigurationContext = React.createContext(undefined);

export function useConfig(key=undefined) {
    const config = useContext(ConfigurationContext);

    if(key) return config[key]
    return config;
}