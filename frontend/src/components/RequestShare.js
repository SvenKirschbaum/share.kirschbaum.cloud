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
import axios from "axios";
import {useParams} from "react-router";
import UploadProgressDialog from "./dialogs/UploadProgressDialog";
import {useConfig} from "../util/config";
import {useUpload} from "../util/upload";


function RequestShare() {
    const {id} = useParams();
    const apiUrl = useConfig('API_URL');

    const [loading, setLoading] = useState(true);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showError, setShowError] = useState(false);
    const [isInvalid, setIsInvalid] = useState(false);
    const [title, setTitle] = useState(undefined);

    const [showUpload, setShowUpload] = useState(false);
    const [uploadState, startUpload] = useUpload(true);


    const fileInput = useRef();

    useEffect(() => {
        axios.get(`${apiUrl}/public/request/${id}`)
            .then(res => {
                setTitle(res.data.title)
            })
            .catch(res => {
                setIsInvalid(true)
            })
            .finally(res => {
                setLoading(false);
            })
    }, [id]);

    const onSave = () => {
        if(!fileInput.current.files[0]) return;

        const file = fileInput.current.files[0]

        setLoading(true);

        axios.post(`${apiUrl}/public/request/${id}`, {
                fileName: file.name,
                fileSize: file.size,
                fileType: (file.type || 'application/octet-stream')
            }
        )
        .then(res => {
            setShowUpload(true);
            return startUpload(id, file, res.data.uploadUrls);
        })
        .then(() => {
            setShowSuccess(true)
        })
        .finally(() => {
            setLoading(false)
            setShowUpload(false)
        })
        .catch(error => {
            console.error(error)
            setShowError(true)
        })
    }

    return (
        <React.Fragment>
            <Card>
                <CardHeader title={'Upload File'} subheader={title} sx={{
                    '& .MuiCardHeader-subheader': {
                        wordBreak: 'break-all'
                    }
                }} />
                <CardContent style={{textAlign: 'center'}}>
                    {loading ? <CircularProgress/> :
                        showSuccess ? "Your file has been sucessfully uploaded." :
                        showError ? "An Error occured while processing your request." :
                        isInvalid ? "The link you used to access this page is invalid." :
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
                    {(!loading && !isInvalid && !showSuccess && !showError) && <Button variant={"contained"} color={'primary'} onClick={onSave}>Save</Button> }
                </CardActions>
            </Card>
            <UploadProgressDialog
                open={showUpload}
                uploadProgress={uploadState.progress}
                uploadSpeedBPS={uploadState.speed}
            />
        </React.Fragment>
    );
}

export default RequestShare;