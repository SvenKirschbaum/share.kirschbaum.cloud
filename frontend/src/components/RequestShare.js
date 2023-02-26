import {
    Button,
    Card,
    CardActions,
    CardContent,
    CardHeader,
    CircularProgress,
    Divider,
    FormGroup,
    Input,
    Typography
} from "@mui/material";
import React, {useEffect, useRef, useState} from "react";
import {useParams} from "react-router";
import {useDispatch, useSelector} from "react-redux";
import {loadingState} from "../redux/util";
import {ShareUploadProgress} from "./ShareList";
import {fetchRequest, fullfillRequest} from "../redux/request/request.action";
import {
    selectRequest,
    selectRequestError, selectRequestId,
    selectRequestLoadingState,
    selectRequestUploadState
} from "../redux/request/request.selector";
import {selectUpload} from "../redux/upload/upload.select";


function RequestShare() {
    const {id} = useParams();
    const dispatch = useDispatch();

    const loading = useSelector(selectRequestLoadingState);
    const request = useSelector(selectRequest);
    const requestId = useSelector(selectRequestId);
    const uploadState = useSelector(selectRequestUploadState);
    const upload = useSelector((s) => selectUpload(s, id))
    const error = useSelector(selectRequestError);

    const showSuccess = !upload && uploadState === loadingState.complete;
    const isInvalid = error?.code === "ERR_BAD_REQUEST";
    const isError = !!error;


    const fileInput = useRef();

    useEffect(() => {
        if(loading !== loadingState.pending && requestId !== id) {
            dispatch(fetchRequest(id));
        }
    }, [dispatch, loading, id, requestId]);

    const onSave = () => {
        if(!fileInput.current.files[0]) return;
        const file = fileInput.current.files[0]

        dispatch(fullfillRequest({
            id,
            rawFile: file
        }));
    }

    return (
        <React.Fragment>
            <Card>
                <CardHeader title={'Upload File'} subheader={request.title} sx={{
                    '& .MuiCardHeader-subheader': {
                        wordBreak: 'break-all'
                    }
                }} />
                <CardContent style={{textAlign: 'center'}}>
                    {loading===loadingState.pending || uploadState===loadingState.pending ? <CircularProgress/> :
                        showSuccess ? "Your file has been successfully uploaded." :
                        isInvalid ? "The link you used to access this page is invalid." :
                        isError ? "An Error occurred while processing your request." :
                        uploadState === loadingState.complete && upload ? <>
                                <ShareUploadProgress id={id}></ShareUploadProgress>
                        </> :
                        <React.Fragment>
                            <Typography>
                                You have been requested to provide a file. Please select the file below and afterwards press the save button.
                            </Typography>
                            <Divider sx={{my:2}} />
                            <FormGroup row>
                                <Input type="file" disableUnderline={true} inputRef={fileInput} sx={{margin: '0 auto'}} />
                            </FormGroup>
                        </React.Fragment>
                    }
                </CardContent>
                <CardActions sx={{
                    justifyContent: 'end'
                }}>
                    {(loading === loadingState.complete && uploadState === loadingState.idle ) && <Button variant={"contained"} color={'primary'} onClick={onSave}>Save</Button> }
                </CardActions>
            </Card>
        </React.Fragment>
    );
}

export default RequestShare;
