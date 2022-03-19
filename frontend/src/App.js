import React, {useEffect, useState} from 'react';
import {ReactKeycloakProvider, useKeycloak} from "@react-keycloak/web";
import {
    Container,
    CssBaseline,
    Dialog,
    DialogContent,
    DialogContentText,
    DialogTitle, useMediaQuery,
} from "@mui/material";

import "@fontsource/roboto"
import './App.css';
import ShareList from "./components/ShareList";
import {BrowserRouter, Route, Switch} from "react-router-dom";
import AddShare from "./components/AddShare";
import DropFile from "./components/DropFile";
import {LocalizationProvider} from "@mui/lab";
import DateAdapter from '@mui/lab/AdapterMoment';
import {createTheme, ThemeProvider} from "@mui/material/styles";
import RequestShare from "./components/RequestShare";
import NotFound from "./components/NotFound";
import Keycloak from "keycloak-js";
import {ConfigurationContext} from "./util/config";

function AuthorizationBarrier(props) {
    const {keycloak} = useKeycloak();

    useEffect(() => {
        if(!keycloak.authenticated) keycloak.login();
    }, [keycloak.authenticated])

    const isAuthorized = keycloak.tokenParsed?.roles?.includes('member');

    if(isAuthorized) {
        return (
            props.children
        );
    }
    else {
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
}

function App() {
    const [config, setConfig] = useState(undefined);
    const [keycloak, setKeycloak] = useState(undefined);

    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

    useEffect(() => {
        fetch('/config.json')
            .then(res => res.json())
            .then(res => {
                setKeycloak(new Keycloak(res.KEYCLOAK))
                setConfig(res);
            })
    }, [])

    const theme = React.useMemo(
        () =>
            createTheme({
                palette: {
                    mode: prefersDarkMode ? 'dark' : 'light'
                }
            }
    ), [prefersDarkMode]);

    if(!config) return null;

    return (
        <ConfigurationContext.Provider value={config}>
          <ReactKeycloakProvider authClient={keycloak} LoadingComponent={<React.Fragment />} initOptions={{
            onLoad: '',
            promiseType: 'native',
            flow: 'standard',
            pkceMethod: 'S256',
            checkLoginIframe: false,
          }}>
              <ThemeProvider theme={theme}>
                  <LocalizationProvider dateAdapter={DateAdapter}>
                  <CssBaseline />
                    <BrowserRouter>
                        <Switch>
                            <Route path={"/r/:id"}>
                                <Container sx={{
                                    marginTop: '4em',
                                    marginBottom: '4em',
                                }} maxWidth={"sm"}>
                                    <RequestShare />
                                </Container>
                            </Route>
                            <Route>
                                <AuthorizationBarrier>
                                    <DropFile>
                                        <Container sx={{
                                            marginTop: '4em',
                                            marginBottom: '4em',
                                        }} maxWidth={"sm"}>
                                          <Switch>
                                            <Route path={'/'} exact>
                                              <ShareList />
                                            </Route>
                                            <Route path={'/add'}>
                                              <AddShare />
                                            </Route>
                                            <Route>
                                                <NotFound />
                                            </Route>
                                          </Switch>
                                        </Container>
                                    </DropFile>
                                </AuthorizationBarrier>
                            </Route>
                        </Switch>
                    </BrowserRouter>
                  </LocalizationProvider>
              </ThemeProvider>
          </ReactKeycloakProvider>
        </ConfigurationContext.Provider>
  );
}

export default App;
