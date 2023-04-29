import React, {useEffect, useMemo} from "react";
import {
    Alert,
    Card,
    CardContent,
    CardHeader,
    CircularProgress,
    IconButton, LinearProgress,
    List,
    ListItem,
    ListItemIcon,
    ListItemSecondaryAction,
    ListItemText, Typography,
} from '@mui/material';
import {Link} from "react-router-dom";

import AddIcon from '@mui/icons-material/Add';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DeleteIcon from '@mui/icons-material/Delete';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import CancelIcon from '@mui/icons-material/Cancel';
import LinkIcon from '@mui/icons-material/Link';
import RequestFileIcon from "../icons/RequestFileIcon";
import {DateTime} from "luxon";
import {useDispatch, useSelector} from "react-redux";
import {loadingState} from "../redux/util";
import {cancelUpload} from "../redux/upload/upload.slice";
import prettyBytes from "pretty-bytes";
import {deleteShare, fetchShares} from "../redux/share/share.action";
import {selectShareError, selectShares, selectShareState} from "../redux/share/share.selector";
import {isUpload, selectUploadProgress, selectUploadSpeed} from "../redux/upload/upload.select";

export function ShareUploadProgress(props) {
    const id = props.id;
    const progress = useSelector((s) => selectUploadProgress(s, id));
    const speed = useSelector((s) => selectUploadSpeed(s, id));

    return (
        <>
            <Typography
                component={"div"}
                variant={"caption"}
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    textAlign: "center",
                    gap: "0.5em"
                }}
            >
                <div>Upload in progress...</div>
                <div>{prettyBytes(speed)}/s</div>
            </Typography>
            <LinearProgress variant="determinate" value={progress*100} sx={{my:1}} />
        </>
    );
}

function ShareEntry(props) {
    const dispatch = useDispatch();

    const upload = useSelector((s) => isUpload(s,props.id));

    const targetURL = window.location.protocol + '//' + window.location.host + (props.type === 'FILE_REQUEST' ? '/r/' : '/d/') + props.id;
    const created = useMemo(() => DateTime.fromISO(props.created).toLocaleString(DateTime.DATETIME_SHORT), [props.created]);
    const expires = useMemo(() => DateTime.fromISO(props.expire).toLocaleString(DateTime.DATETIME_SHORT), [props.expire]);

    const copyURL = () => {
        navigator.clipboard.writeText(targetURL).then();
    };

    const abortUpload = () => {
        dispatch(cancelUpload(props.id))
    };

    let buttons;
    let center;
    if(upload) {
        buttons = <>
            <IconButton onClick={abortUpload} size="large">
                <CancelIcon color={"error"} />
            </IconButton>
        </>;
        center = <ShareUploadProgress id={props.id} />;
    } else if (props.uploadError) {
        buttons = <></>
        center = <Alert variant="filled" severity="error">An Error occurred while uploading</Alert>
    } else {
        buttons = <>
            <IconButton onClick={copyURL} size="large">
                <FileCopyIcon />
            </IconButton>
            <IconButton onClick={props.delete} size="large">
                <DeleteIcon color={"error"} />
            </IconButton>
        </>
        center = <>
            <div>{targetURL}</div>
            <Typography
                component={"div"}
                variant={"caption"}
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingRight: "1em",
                    textAlign: "center",
                    gap: "0.5em"
                }}
            >
                <div>
                    Created: {created}
                </div>
                <div>
                    Expires: {expires}
                </div>
            </Typography>
        </>
    }

    return (
        <ListItem sx={{paddingRight: '104px'}}>
            <ListItemIcon>
                {props.type === 'FILE' && <AttachFileIcon />}
                {props.type === 'LINK' && <LinkIcon />}
                {props.type === 'FILE_REQUEST' && <RequestFileIcon />}
            </ListItemIcon>
            <ListItemText
                secondaryTypographyProps={{component: 'div'}}
                secondary={center}
                onClick={!upload ? (() => window.location.href = targetURL) : undefined}
                sx={{
                    '& .MuiListItemText-secondary': {
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        cursor: !upload && 'pointer'
                    },
                    '& .MuiListItemText-primary': {
                        wordBreak: 'break-all'
                    }
                }}
            >
                {props.title}
            </ListItemText>
            <ListItemSecondaryAction>
                {buttons}
            </ListItemSecondaryAction>
        </ListItem>
    );
}

function ShareList() {
    const dispatch = useDispatch();
    const shares = useSelector(selectShares).filter(share => !share.deleting);
    const shareState = useSelector(selectShareState);
    const loading = (shareState === loadingState.pending);
    const error = (shareState === loadingState.failed);
    const errorMessage = useSelector(selectShareError);

    useEffect(() => {
        if(shareState === loadingState.idle) {
            dispatch(fetchShares());
        }
    }, [shareState, dispatch]);

    return (
        <Card>
            <CardHeader title={'Shares'} action={<IconButton to={'/add'} component={Link} size="large"><AddIcon /></IconButton>} />
            <CardContent style={{textAlign: 'center'}}>
                { loading ? <CircularProgress /> :
                    (error ? <span>{errorMessage}</span> :
                        <List>
                            {shares.map(props => (
                                <ShareEntry key={props.id}
                                            delete={() => dispatch(deleteShare(props.id))} {...props} />
                            ))}
                            {shares.length === 0 &&
                                <ListItem>
                                    <ListItemText style={{textAlign: 'center'}}>Currently there are no active
                                        shares</ListItemText>
                                </ListItem>
                            }
                        </List>
                    )
                }
            </CardContent>
        </Card>
    );
}

export default ShareList;
