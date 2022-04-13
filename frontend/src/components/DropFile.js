import {useEffect} from "react";

import {useNavigate} from "react-router";
import {useKeycloak} from "@react-keycloak/web";

function DropFile(props) {
    const navigate = useNavigate();
    const {keycloak} = useKeycloak();

    const enabled = keycloak.authenticated && keycloak.tokenParsed?.roles?.includes('member');

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