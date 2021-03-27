import React, {useEffect, useState} from "react";
import {
    Card,
    CardContent,
    CardHeader, CircularProgress, IconButton,
    List,
    ListItem, ListItemIcon, ListItemSecondaryAction,
    ListItemText, makeStyles,
} from "@material-ui/core";
import {Link} from "react-router-dom";

import AddIcon from '@material-ui/icons/Add';
import AttachFileIcon from '@material-ui/icons/AttachFile';
import DeleteIcon from '@material-ui/icons/Delete';
import FileCopyIcon from '@material-ui/icons/FileCopy';
import LinkIcon from '@material-ui/icons/Link';
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
                <IconButton onClick={copyURL}>
                    <FileCopyIcon />
                </IconButton>
                <IconButton onClick={props.delete}>
                    <DeleteIcon color={"secondary"} />
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
            <CardHeader title={'Shares'} action={<IconButton to={'/add'} component={Link}><AddIcon /></IconButton>} />
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