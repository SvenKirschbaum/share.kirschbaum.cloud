import {Dialog, DialogContent, DialogContentText, DialogTitle, LinearProgress} from "@mui/material";
import prettyBytes from "pretty-bytes";
import React from "react";
import {useDelay} from "../../util/delay";

function UploadProgressDialog(props) {
    const {uploadProgress, uploadSpeedBPS, open, ...rProps} = {...props};

    const delayedOpen = useDelay(open);

    return (
        <Dialog
            {...rProps}
            open={delayedOpen}
            sx={{
                textAlign: 'center'
            }}
        >
            <DialogTitle>Uploading File</DialogTitle>
            <DialogContent>
                <DialogContentText>Your Upload is in progress</DialogContentText>
                <LinearProgress variant="determinate" value={uploadProgress*100} />
                <div>{prettyBytes(uploadSpeedBPS)}/s</div>
            </DialogContent>
        </Dialog>
    );
}

export default UploadProgressDialog;