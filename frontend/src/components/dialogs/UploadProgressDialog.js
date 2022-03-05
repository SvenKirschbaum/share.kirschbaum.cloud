import {Dialog, DialogContent, DialogContentText, DialogTitle, LinearProgress} from "@mui/material";
import prettyBytes from "pretty-bytes";
import React from "react";

function UploadProgressDialog(props) {
    const {uploadProgress, uploadSpeedBPS, ...rProps} = {...props};

    return (
        <Dialog
            {...rProps}
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