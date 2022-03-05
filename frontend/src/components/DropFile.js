import React, {useState} from "react";

import './DropFile.css';
import {Backdrop, Card, CardContent} from "@mui/material";
import {useHistory} from "react-router-dom";

function DropFile(props) {
    const history = useHistory();

    const [isDropping, setIsDropping] = useState(false);
    const [lastEnter, setLastEnter] = useState(undefined);

    const onDragEnter = (e) => {
        if (e.dataTransfer.types.includes("Files")) {
            setLastEnter(e.target);
            setIsDropping(true);
            e.preventDefault();
            e.stopPropagation();
        }
    }

    const onDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (lastEnter === e.target) {
            setIsDropping(false);
            setLastEnter(undefined);
        }
    }

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

            setIsDropping(false);
            history.push({
                pathname: '/add',
                state: e.dataTransfer.files
            });
        }
    }

    return (
        <div className="dropzone" onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDragOver={onDragOver} onDrop={onDrop}>
            <Backdrop open={isDropping} style={{zIndex: 100}}>
                <Card>
                    <CardContent style={{textAlign: 'center'}}>
                        Drop File
                    </CardContent>
                </Card>
            </Backdrop>
            {props.children}
        </div>
    );
}

export default DropFile;