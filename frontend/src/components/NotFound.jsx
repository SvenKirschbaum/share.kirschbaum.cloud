import {Dialog, DialogContent, DialogContentText, DialogTitle} from "@mui/material";
import React from "react";

function NotFound() {
    return (
        <Dialog open={true}>
            <DialogTitle>Not Found</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    The page you requested does not exist.
                </DialogContentText>
            </DialogContent>
        </Dialog>
    );
}

export default NotFound;