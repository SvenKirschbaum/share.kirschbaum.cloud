import React, {useEffect, useState} from "react";
import {
    Card,
    CardContent,
    CardHeader,
    CircularProgress,
    IconButton,
    List,
    ListItem,
    ListItemIcon,
    ListItemSecondaryAction,
    ListItemText,
} from "@mui/material";
import makeStyles from '@mui/styles/makeStyles';
import {Link} from "react-router-dom";

import AddIcon from '@mui/icons-material/Add';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DeleteIcon from '@mui/icons-material/Delete';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import LinkIcon from '@mui/icons-material/Link';
import {useKeycloak} from "@react-keycloak/web";
import axios from "axios";

const useShareEntryStyles = makeStyles({
    root: {
        paddingRight: 104,
        '& .MuiListItemText-secondary': {
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            direction: 'rtl',
            cursor: 'pointer'
        },
        '& .MuiListItemText-primary': {
            wordBreak: 'break-all'
        }
    }
});

function ShareEntry(props) {
    const classes = useShareEntryStyles();

    const targetURL = window.location.protocol + '//' + window.location.host + '/d/' + props.id;

    const copyURL = () => {
        navigator.clipboard.writeText(targetURL).then();
    };

    return (
        <ListItem className={classes.root}>
            <ListItemIcon>
                {props.type === 'FILE' && <AttachFileIcon />}
                {props.type === 'LINK' && <LinkIcon />}
            </ListItemIcon>
            <ListItemText secondary={targetURL} onClick={() => window.location.href = targetURL}>{props.title}</ListItemText>
            <ListItemSecondaryAction>
                <IconButton onClick={copyURL} size="large">
                    <FileCopyIcon />
                </IconButton>
                <IconButton onClick={props.delete} size="large">
                    <DeleteIcon color={"error"} />
                </IconButton>
            </ListItemSecondaryAction>
        </ListItem>
    );
}

function ShareList() {
    const {keycloak} = useKeycloak();

    const [loading, setLoading] = useState(true);
    const [shares, setShares] = useState([]);

    useEffect(() => {
        axios.get('/api/list', {
            headers: {
                Authorization: keycloak.token
            },
        })
        .then(res => {
            setLoading(false);
            setShares(res.data.shares);
        })
    }, [keycloak]);

    const deleteShare = (id) => {
        setShares(shares.filter(value => value.id !== id));
        axios.delete('/api/share/'+id, {
            headers: {
                Authorization: keycloak.token
            }
        })
    };

    return (
        <Card>
            <CardHeader title={'Shares'} action={<IconButton to={'/add'} component={Link} size="large"><AddIcon /></IconButton>} />
            <CardContent style={{textAlign: 'center'}}>
                { loading ? <CircularProgress /> :
                    <List>
                        {shares.map(props => (
                            <ShareEntry key={props.id} delete={() => deleteShare(props.id)} {...props} />
                        ))}
                        {shares.length === 0 &&
                            <ListItem>
                                <ListItemText style={{textAlign: 'center'}}>Currently there are no active shares</ListItemText>
                            </ListItem>
                        }
                    </List>
                }
            </CardContent>
        </Card>
    );
}

export default ShareList;