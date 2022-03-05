import {
    Button,
    Card,
    CardActions,
    CardContent,
    CardHeader,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Fab,
    FormGroup,
    Input,
    LinearProgress, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Paper,
    TextField,
} from "@mui/material";
import {Link, Route, Switch, useHistory} from "react-router-dom";
import React, {useCallback, useEffect, useRef, useState} from "react";

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddLinkIcon from '@mui/icons-material/AddLink';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import moment from "moment";
import {useKeycloak} from "@react-keycloak/web";
import axios from "axios";
import {uploadService} from "../services/UploadService";
import {useLocation} from "react-router";
import prettyBytes from "pretty-bytes";
import {DateTimePicker} from "@mui/lab";
import RequestFileIcon from "../icons/RequestFileIcon";
import NavigateNextIcon from '@mui/icons-material/NavigateNext';



const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/g;
const targetURLPrefix = window.location.protocol + '//' + window.location.host + '/d/';

function AddShare() {
    return (
        <Switch>
            <Route exact path="/add">
                <TypeSelection />
            </Route>
            <Route path="/add/link">
                <AddLink />
            </Route>
            <Route path="/add/file">
                <AddFile />
            </Route>
            {/*<Route path="/add/request">*/}
            {/*    <AddRequest />*/}
            {/*</Route>*/}
        </Switch>
    );
}

function TypeSelection() {
    return (
        <Card>
            <CardHeader title={'Add Share'} />
            <CardContent>
                <List>
                    <TypeOption icon={AddLinkIcon} title={"Shorten Link"} to={"/add/link"} />
                    <TypeOption icon={FileUploadIcon} title={"Upload File"} to={"/add/file"} />
                    <TypeOption icon={RequestFileIcon} title={"Request File"} to={"/add/request"} disabled />
                </List>
            </CardContent>
            <CardActions sx={{
                justifyContent: 'space-between'
            }}>
                <Fab color="error" size={"small"} to={'/'} component={Link}>
                    <ArrowBackIcon />
                </Fab>
            </CardActions>
        </Card>
    );
}

function TypeOption(props) {
    return (
        <ListItem>
            <Paper elevation={2} sx={{
                width: '100%'
            }}>
                <ListItemButton component={Link} to={props.to} disabled={props.disabled}>
                    <ListItemIcon>
                        <props.icon />
                    </ListItemIcon>
                    <ListItemText>{props.title}</ListItemText>
                    <NavigateNextIcon />
                </ListItemButton>
            </Paper>
        </ListItem>
    );
}

function AddLink() {

    const [url, setURL] = useState('');
    const [urlInputHelper, setUrlInputHelper] = useState('');
    const [urlInputError, setUrlInputError] = useState(false);

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

    return (
        <BaseAddDialog
            title={"Add Link"}
            validate={() => url && !urlInputError}
            getRequestData={() => ({
                type: 'LINK',
                link: url
            })}
        >
            <FormGroup row>
                <TextField label={'Target Link'} fullWidth margin="normal" variant="filled" type={'url'} value={url} onChange={onUrlChange} error={urlInputError} helperText={urlInputHelper}/>
            </FormGroup>
        </BaseAddDialog>
    );
}

function AddFile() {

    const location = useLocation();

    const fileInput = useRef();

    const [suggestedTitle, setSuggestedTitle] = useState(undefined);

    const [showUpload, setShowUpload] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadSpeedBPS, setUploadSpeedBPS] = useState(0);

    //Set file from location state
    useEffect(() => {
        if(location.state && fileInput.current) {
            fileInput.current.files = location.state;
            setSuggestedTitle(fileInput.current?.files[0]?.name)
        }
    }, [location.state]);

    const onFileChange = () => {
        setSuggestedTitle(fileInput.current?.files[0]?.name)
    }

    return (
        <React.Fragment>
            <BaseAddDialog
                title={"Add File"}
                validate={() => fileInput.current.files[0]}
                getRequestData={() => ({
                    type: 'FILE',
                    fileName: fileInput.current.files[0].name,
                    fileSize: fileInput.current.files[0].size,
                    fileType: (fileInput.current.files[0].type || 'application/octet-stream')
                })}
                onResponse={(res) => {
                    setShowUpload(true);
                    return uploadService.uploadFile(res.data.shareId, fileInput.current.files[0], res.data.uploadUrls, setUploadProgress, setUploadSpeedBPS)
                        .finally(() => {
                            setShowUpload(false);
                        })
                }}
                suggestedTitle={suggestedTitle}
            >
                <FormGroup row>
                    <Input type="file" disableUnderline={true} fullWidth inputRef={fileInput} onChange={onFileChange} />
                </FormGroup>
            </BaseAddDialog>
            <Dialog
                open={showUpload}
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
        </React.Fragment>
    );
}

function AddRequest() {
    return (
        <BaseAddDialog
            title={"Add Request"}
        >
        </BaseAddDialog>
    );
}

function BaseAddDialog(props) {
    const {keycloak} = useKeycloak();
    const history = useHistory();

    const [title, setTitle] = useState('');
    const [expire, setExpire] = useState(moment().add(7, 'days'));

    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const [showError, setShowError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const [addedId, setAddedId] = useState();

    useEffect(() => {
        if(!title && props.suggestedTitle) setTitle(props.suggestedTitle)
    }, [props.suggestedTitle])

    const onSave = () => {
        //Validate
        if(!title || !expire.isValid() || (props.validate && !props.validate())) {
            //TODO: Feedback
            return;
        }

        setLoading(true);

        axios.post('/api/add', {
                title,
                expires: expire.toISOString(),
                ...props.getRequestData()
            },
            {
                headers: {
                    Authorization: keycloak.token
                }
            }
        )
        .finally(() => {
            setLoading(false);
        })
        .then(async res => {
            setAddedId(res.data.shareId);

            if (props.onResponse) {
                await props.onResponse(res)
            }

            navigator.clipboard.writeText(targetURLPrefix + res.data.shareId).then();
            setShowSuccess(true);
        })
        .catch(error => {
            setErrorMessage(error.response?.message || error.message);
            setShowError(true);
        })
    }

    return (
        <React.Fragment>
            <Card>
                <CardHeader title={props.title} />
                <CardContent>
                    <FormGroup row>
                        <TextField label={'Title'} fullWidth margin="normal" variant="filled" value={title} onChange={(event => setTitle(event.target.value))}/>
                    </FormGroup>
                    <FormGroup row>
                        <DateTimePicker renderInput={props => <TextField {...props} label={"Expiration Date"} fullWidth margin={"normal"} variant={"filled"} />} inputFormat={"MMMM Do YYYY HH:mm"} disablePast ampm={false} value={expire} onChange={setExpire} />
                    </FormGroup>
                    {props.children}
                </CardContent>
                <CardActions sx={{
                    justifyContent: 'space-between'
                }}>
                    <Fab color="error" size={"small"} to={'/add'} component={Link}>
                        <ArrowBackIcon />
                    </Fab>
                    { loading && <CircularProgress /> }
                    <Button variant={"contained"} color={'primary'} onClick={onSave}>Save</Button>
                </CardActions>
            </Card>
            <Dialog
                open={showSuccess}
                onClose={event => history.push('/')}
                sx={{
                    textAlign: 'center'
                }}
            >
                <DialogTitle>Share successfully added</DialogTitle>
                <DialogContent>
                    <DialogContentText>Your Share is accessible via the following Link: <a href={targetURLPrefix + addedId}>{targetURLPrefix + addedId}</a></DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={event => history.push('/')} color={"primary"} variant={"contained"}>Ok</Button>
                </DialogActions>
            </Dialog>
            <Dialog
                open={showError}
                onClose={() => setShowError(false)}
                sx={{
                    textAlign: 'center'
                }}
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