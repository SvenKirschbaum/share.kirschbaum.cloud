import {useCallback, useEffect, useReducer} from "react";

import {useNavigate} from "react-router";
import {useAuth} from "react-oidc-context";
import {createPortal} from "react-dom";
import {Backdrop, Card, CardContent} from "@mui/material";

function DropFile(props) {
    const navigate = useNavigate();
    const auth = useAuth()

    const enabled = auth.isAuthenticated && auth.user.profile.roles?.includes('member');

    const [state, dispatch] = useReducer((state, action) => {
        if(action === 'enter') {
            return state+1;
        } else if(action === 'leave') {
            return state-1;
        } else if(action === 'reset') {
            return 0;
        }
        return state;
    }, 0);

    const onDragEnter = useCallback((e) => {
        if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            e.stopPropagation();
            dispatch('enter')
        }
    }, []);

    const onDragLeave = useCallback((e) => {
        if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            e.stopPropagation();
            dispatch('leave')
        }
    }, []);

    const onDrop = useCallback((e) => {
        if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            e.stopPropagation();
            dispatch('reset')
            navigate('/add/file', {state: e.dataTransfer.files});
        }
    }, [navigate]);

    useEffect(() => {
        if(enabled) {
            const controller = new AbortController();
            document.addEventListener("drop", onDrop, { signal: controller.signal })
            document.addEventListener("dragover", (e) => e.preventDefault(), { signal: controller.signal })
            document.addEventListener("dragenter", onDragEnter, { signal: controller.signal })
            document.addEventListener("dragleave", onDragLeave, { signal: controller.signal })

            return () => controller.abort()
        }
    }, [enabled, onDrop, onDragEnter, onDragLeave])

    if(state > 0) {
        return createPortal(
            <Backdrop open={true} style={{zIndex: 100}} sx={{pointerEvents: 'none'}}>
                <Card>
                    <CardContent sx={{textAlign: 'center', p: '16px!important'}}>
                        Drop File
                    </CardContent>
                </Card>
            </Backdrop>,
            document.body
        );
    }

    return null;
}

export default DropFile;
