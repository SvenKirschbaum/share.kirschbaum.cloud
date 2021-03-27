import {
    Button,
    Card, CardActions,
    CardContent,
    CardHeader, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
    Fab,
    FormControlLabel,
    FormGroup, Input, LinearProgress,
    makeStyles,
    Switch,
    TextField
} from "@material-ui/core";
import {DateTimePicker} from '@material-ui/pickers';
import {Link, useHistory} from "react-router-dom";
import React, {useCallback, useRef, useState} from "react";

import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import moment from "moment";
import {useKeycloak} from "@react-keycloak/web";
import axios from "axios";
import {uploadService} from "../services/UploadService";

const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;

const useStyles = makeStyles({
    cardActions: {
        justifyContent: 'space-between'
    },
    dialog: {
        textAlign: 'center'
    }
});

function AddShare() {
    const classes = useStyles();

    const history = useHistory();
    const {keycloak} = useKeycloak();

    const fileInput = useRef();

    const [fileUpload, setFileUpload] = useState(false);
    const [title, setTitle] = useState('');
    const [url, setURL] = useState('');
    const [expire, setExpire] = useState(moment().add(7, 'days'));

    const [urlInputHelper, setUrlInputHelper] = useState('');
    const [urlInputError, setUrlInputError] = useState(false);

    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const [showError, setShowError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const [showUpload, setShowUpload] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const [addedId, setAddedId] = useState();

    const targetURL = window.location.protocol + '//' + window.location.host + '/d/' + addedId;

    const onUrlChange = useCallback(event => {
        const newUrl = event.target.value;

        setURL(newUrl);

        if(!newUrl.match(urlRegex) && newUrl) {
            setUrlInputError(true);
            setUrlInputHelper('The provided URL is invalid');
        }
        else {
            setUrlInputError(false);
            setUrlInputHelper('');
        }

    }, []);

    const onSave = () => {
        if(fileUpload) {
            if(!fileInput.current.files[0]) return;
        }
        else {
            if(urlInputError) return;
            if(!title) return;
            if(!url) return;
        }

        setLoading(true);

        axios.post('/api/add', {
                title: fileUpload ? fileInput.current.files[0].name : title,
                type: fileUpload ? 'FILE' : 'LINK',
                expires: expire.toISOString(),
                link: fileUpload ? undefined : url,
                fileSize: fileUpload ? fileInput.current.files[0].size : undefined,
                fileType: fileUpload ? (fileInput.current.files[0].type || 'application/octet-stream') : undefined
            },
            {
                headers: {
                    Authorization: keycloak.token
                }
            }
        )
        .then(res => {
            setAddedId(res.data.shareId);

            if(fileUpload) {
                setShowUpload(true);

                uploadService.uploadFile(res.data.shareId, fileInput.current.files[0], res.data.uploadUrls, setUploadProgress)
                    .then(res => {
                        setShowSuccess(true);
                    }).catch(error => {
                        setErrorMessage(error.message);
                        setShowError(true);
                    }).finally(() => {
                        setShowUpload(false);
                    })
                return;
            }

            setShowSuccess(true);
        })
        .catch(error => {
            setErrorMessage(error.response?.message || error.message);
            setShowError(true);
        }).finally(() => {
            setLoading(false);
        })
    }

    return (
        <React.Fragment>
            <Card>
                <CardHeader title={'Add Share'} action={<FormControlLabel labelPlacement="start" control={<Switch color="primary" checked={fileUpload} onChange={(event) => setFileUpload(event.target.checked)} />} label={'Upload File'} />} />
                <CardContent>
                    { !fileUpload &&
                        <React.Fragment>
                            <FormGroup row>
                                <TextField label={'Title'} fullWidth margin="normal" variant="filled" value={title} onChange={(event => setTitle(event.target.value))}/>
                            </FormGroup>
                            <FormGroup row>
                                <TextField label={'Target Link'} fullWidth margin="normal" variant="filled" type={'url'} value={url} onChange={onUrlChange} error={urlInputError} helperText={urlInputHelper}/>
                            </FormGroup>
                        </React.Fragment>
                    }
                    { fileUpload &&
                        <FormGroup row>
                            <Input type="file" disableUnderline={true} fullWidth inputRef={fileInput} />
                        </FormGroup>
                    }
                    <FormGroup row>
                        <DateTimePicker label={"Expiration Date"} format={"MMMM Do YYYY HH:mm"} disablePast fullWidth margin={"normal"} inputVariant={"filled"} ampm={false} value={expire} onChange={setExpire} />
                    </FormGroup>
                </CardContent>
                <CardActions className={classes.cardActions}>
                    <Fab color="secondary" size={"small"} to={'/'} component={Link}>
                        <ArrowBackIcon />
                    </Fab>
                    { loading && <CircularProgress /> }
                    <Button variant={"contained"} color={'primary'} onClick={onSave}>Save</Button>
                </CardActions>
            </Card>
            <Dialog
                open={showUpload}
                className={classes.dialog}
            >
                <DialogTitle>Uploading File</DialogTitle>
                <DialogContent>
                    <DialogContentText>Your Upload is in progress</DialogContentText>
                    <LinearProgress variant="determinate" value={uploadProgress*100} />
                </DialogContent>
            </Dialog>
            <Dialog
                open={showSuccess}
                onClose={event => history.push('/')}
                className={classes.dialog}
            >
                <DialogTitle>Share successfully added</DialogTitle>
                <DialogContent>
                    <DialogContentText>Your Share is accessible via the following Link: <a href={targetURL}>{targetURL}</a></DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={event => history.push('/')} color={"primary"} variant={"contained"}>Ok</Button>
                </DialogActions>
            </Dialog>
            <Dialog
                open={showError}
                onClose={() => setShowError(false)}
                className={classes.dialog}
            >
                <DialogTitle>Adding Share failed</DialogTitle>
                <DialogContent>
                    <DialogContentText>{errorMessage}</DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowError(false)} color={"primary"} variant={"contained"}>Ok</Button>
                </DialogActions>
            </Dialog>
        </React.Fragment>
    );
}

export default AddShare;