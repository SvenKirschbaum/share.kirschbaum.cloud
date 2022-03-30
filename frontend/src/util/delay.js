import {useEffect, useState} from "react";

export function useDelay(sourceState, delay = 4000) {
    const [state, setState] = useState(sourceState);

    useEffect(() => {
        const timer = setTimeout(() => {
            setState(sourceState);
        }, delay);
        return () => clearTimeout(timer);
    }, [sourceState, delay]);

    return state;
}