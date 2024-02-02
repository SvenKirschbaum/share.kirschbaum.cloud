import {
    Alert,
    Button,
    Card,
    CardActions,
    CardContent,
    CardHeader, Checkbox,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle, Divider,
    Fab, FormControlLabel,
    FormGroup,
    Input,
    List, ListItem, ListItemButton, ListItemIcon, ListItemText, Paper,
    TextField, Typography,
} from "@mui/material";
import {Link} from "react-router-dom";
import React, {useCallback, useEffect, useRef, useState} from "react";

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddLinkIcon from '@mui/icons-material/AddLink';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import {useLocation, useNavigate} from "react-router";
import {DateTimePicker, renderTimeViewClock} from "@mui/x-date-pickers";
import RequestFileIcon from "../icons/RequestFileIcon";
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import {DateTime} from "luxon";
import {useDispatch, useSelector} from "react-redux";
import {resetAdd} from "../redux/share/share.slice";
import {loadingState} from "../redux/util";
import {selectProfile} from "../redux/authentication/authentication.selector";
import {selectConfig} from "../redux/config/config.selector";
import {addShare} from "../redux/share/share.action";
import {selectShareAddError, selectShareAddState} from "../redux/share/share.selector";

const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/g;

export function TypeSelection() {
    return (
        <Card>
            <CardHeader title={'Add Share'} />
            <CardContent>
                <List>
                    <TypeOption icon={AddLinkIcon} title={"Shorten Link"} to={"/add/link"} />
                    <TypeOption icon={FileUploadIcon} title={"Upload File"} to={"/add/file"} />
                    <TypeOption icon={RequestFileIcon} title={"Request File"} to={"/add/request"} />
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

export function TypeOption(props) {
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

export function AddLink() {

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
            getActionData={() => ({
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

export function AddFile() {

    const location = useLocation();

    const fileInput = useRef();

    const [rerender, setRerender] = useState(0);
    const [forceDownload, setForceDownload] = useState(false);
    const [suggestedTitle, setSuggestedTitle] = useState(undefined);

    //Set file from location state
    useEffect(() => {
        if(location.state && fileInput.current) {
            fileInput.current.files = location.state;
            setSuggestedTitle(fileInput.current?.files[0]?.name)
        }
    }, [location.state]);

    const onFileChange = () => {
        //Only required to hide the error message after change
        setRerender(rerender + 1);
        setSuggestedTitle(fileInput.current?.files[0]?.name)
    }

    return (
        <BaseAddDialog
            title={"Add File"}
            validate={() => fileInput.current.files[0] && fileInput.current.files[0].size > 0}
            disableTitle={fileInput.current?.files?.length > 1}
            getActionData={() => {
                if(fileInput.current.files.length > 1) {
                    const actionData = [];
                    for (const file of fileInput.current.files) {
                        actionData.push({
                            type: 'FILE',
                            title: file.name,
                            file: {
                                fileName: file.name,
                                fileSize: file.size,
                                fileType: (file.type || 'application/octet-stream')
                            },
                            rawFile: file,
                            forceDownload
                        });
                    }
                    return actionData;
                } else {
                    return {
                        type: 'FILE',
                        file: {
                            fileName: fileInput.current.files[0].name,
                            fileSize: fileInput.current.files[0].size,
                            fileType: (fileInput.current.files[0].type || 'application/octet-stream')
                        },
                        rawFile: fileInput.current.files[0],
                        forceDownload
                    }
                }
            }}
            suggestedTitle={suggestedTitle}
        >
            <FormGroup row>
                <FormControlLabel control={<Checkbox checked={forceDownload} onChange={(event) => setForceDownload(event.target.checked)} />} label="Force Download" />
            </FormGroup>
            <FormGroup row>
                <Input type="file" disableUnderline={true} inputRef={fileInput} sx={{margin: '10px auto'}} onChange={onFileChange} inputProps={{multiple: true}} />
            </FormGroup>
            {fileInput.current?.files[0] && fileInput.current?.files[0].size === 0 &&
                <FormGroup>
                    <Alert severity={"error"}>
                        Browser Bug Detected: The selected file has no size, likely due to its Path exceeding ~260 Characters. Please press the file input button, and reselect the file.
                    </Alert>
                </FormGroup>
            }
        </BaseAddDialog>
    );
}

export function AddRequest() {
    const config = useSelector(selectConfig);
    const profile = useSelector(selectProfile);

    const [shouldNotify, setShouldNotify] = useState(false);

    const canBeNotified = profile.email && profile.email_verified && !config.EMAIL_DISABLED;

    return (
        <BaseAddDialog
            title={"Add Request"}
            getActionData={() => ({
                type: 'FILE_REQUEST',
                notifyOnUpload: shouldNotify
            })}
        >
            <FormControlLabel disabled={!canBeNotified} checked={shouldNotify} onChange={() => setShouldNotify(!shouldNotify)} control={<Checkbox />} label={"Notify me once the request has been completed"} />
            <Divider sx={{
                my: 2
            }}/>
            <Typography>
                This page allows you to generate a special link, which can be used by anyone to upload a single file.
                The state of the request will be displayed in the list of your shares. After the upload has been completed you can download it from there.
            </Typography>
        </BaseAddDialog>
    );
}

function BaseAddDialog(props) {
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const [title, setTitle] = useState('');
    const [expire, setExpire] = useState(() => DateTime.now().plus({days: 7}));

    const loadState = useSelector(selectShareAddState);
    const errorMessage = useSelector(selectShareAddError);

    const prevSuggestedTitleRef = useRef();

    useEffect(() => {
        if((!title && props.suggestedTitle) || title === prevSuggestedTitleRef.current) setTitle(props.suggestedTitle)
        prevSuggestedTitleRef.current = props.suggestedTitle;
    }, [title, props.suggestedTitle])

    //Reset async adding state
    useEffect(() => () => {
        dispatch(resetAdd());
    }, [dispatch]);

    //Navigate to start page if a file has been added
    useEffect(() => {
        if(loadState === loadingState.complete) {
            navigate('/');
        }
    }, [navigate, loadState]);

    const onSave = () => {
        //Validate
        if(!title || !expire.isValid || (props.validate && !props.validate())) {
            //TODO: Feedback
            return;
        }

        const actionData = props.getActionData()

        if (Array.isArray(actionData)) {
            dispatch(addShare(actionData.map((d) => ({
                expires: expire.toISO(),
                ...d
            }))));
        } else {
            dispatch(addShare([{
                title,
                expires: expire.toISO(),
                ...props.getActionData()
            }]));
        }
    }

    return (
        <React.Fragment>
            <Card>
                <CardHeader title={props.title} />
                <CardContent>
                    <FormGroup row>
                        <TextField label={'Title'} fullWidth margin="normal" variant="filled" value={title} onChange={(event => setTitle(event.target.value))} disabled={props.disableTitle}/>
                    </FormGroup>
                    <FormGroup row>
                        <DateTimePicker
                            slotProps={{
                                textField: {
                                    label: "Expiration Date",
                                    fullWidth: true,
                                    margin: "normal",
                                    variant: "filled"
                                }
                            }}
                            viewRenderers={{
                                hours: renderTimeViewClock,
                                minutes: renderTimeViewClock,
                                seconds: renderTimeViewClock,
                            }}
                            format={"DD HH:mm"}
                            disablePast
                            value={expire}
                            onChange={setExpire}
                        />
                    </FormGroup>
                    {props.children}
                </CardContent>
                <CardActions sx={{
                    justifyContent: 'space-between'
                }}>
                    <Fab color="error" size={"small"} to={'/add'} component={Link}>
                        <ArrowBackIcon />
                    </Fab>
                    { loadState === loadingState.pending && <CircularProgress /> }
                    <Button variant={"contained"} color={'primary'} onClick={onSave}>Save</Button>
                </CardActions>
            </Card>
            <Dialog
                open={loadState === loadingState.failed}
                onClose={() => dispatch(resetAdd())}
                sx={{
                    textAlign: 'center'
                }}
            >
                <DialogTitle>Adding Share failed</DialogTitle>
                <DialogContent>
                    <DialogContentText>{errorMessage}</DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => dispatch(resetAdd())} color={"primary"} variant={"contained"}>Ok</Button>
                </DialogActions>
            </Dialog>
        </React.Fragment>
    );
}
