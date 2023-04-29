import {Dialog, DialogContent, DialogContentText, DialogTitle} from "@mui/material";
import React from "react";

function Unauthorized() {
    return (
        <Dialog open={true}>
            <DialogTitle>Unauthorized</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    You dont have the permission to use this service.
                </DialogContentText>
            </DialogContent>
        </Dialog>
    );
}

export default Unauthorized;