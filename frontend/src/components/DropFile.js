import {useEffect} from "react";

import {useNavigate} from "react-router";
import {useAuth} from "react-oidc-context";

function DropFile(props) {
    const navigate = useNavigate();
    const auth = useAuth()

    const enabled = auth.isAuthenticated && auth.user.profile.roles?.includes('member');

    const onDragOver = (e) => {
        if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            e.stopPropagation();
        }
    }

    const onDrop = (e) => {
        if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            e.stopPropagation();
            navigate('/add/file', {state: e.dataTransfer.files});
        }
    }

    useEffect(() => {
        if(enabled) {
            const controller = new AbortController();
            document.addEventListener("drop", onDrop, { signal: controller.signal })
            document.addEventListener("dragover", onDragOver, { signal: controller.signal })

            return () => controller.abort()
        }
    }, [enabled])

    return null;

    // if(isDropping) {
    //     return createPortal(
    //         <Backdrop open={isDropping} style={{zIndex: 100}} sx={{pointerEvents: 'none'}}>
    //             <Card>
    //                 <CardContent style={{textAlign: 'center'}}>
    //                     Drop File
    //                 </CardContent>
    //             </Card>
    //         </Backdrop>,
    //         document.body
    //     );
    // }
}

export default DropFile;
