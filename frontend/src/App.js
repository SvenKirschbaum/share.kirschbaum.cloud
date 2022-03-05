import React from 'react';
import {ReactKeycloakProvider, useKeycloak} from "@react-keycloak/web";
import {
    Container,
    CssBaseline,
    Dialog,
    DialogContent,
    DialogContentText,
    DialogTitle, useMediaQuery,
} from "@mui/material";

import keycloak from "./keycloak";
import "@fontsource/roboto"
import './App.css';
import ShareList from "./components/ShareList";
import {BrowserRouter, Route, Switch} from "react-router-dom";
import AddShare from "./components/AddShare";
import DropFile from "./components/DropFile";
import {LocalizationProvider} from "@mui/lab";
import DateAdapter from '@mui/lab/AdapterMoment';
import {createTheme, ThemeProvider} from "@mui/material/styles";

function AuthorizationBarrier(props) {
    const {keycloak} = useKeycloak();

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
    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

    const theme = React.useMemo(
        () =>
            createTheme({
                palette: {
                    mode: prefersDarkMode ? 'dark' : 'light'
                }
            }
    ), [prefersDarkMode]);

    return (
      <ReactKeycloakProvider authClient={keycloak} LoadingComponent={<React.Fragment />} initOptions={{
        onLoad: 'login-required',
        promiseType: 'native',
        flow: 'standard',
        pkceMethod: 'S256',
        checkLoginIframe: false,
      }}>
          <ThemeProvider theme={theme}>
              <LocalizationProvider dateAdapter={DateAdapter}>
              <CssBaseline />
                <AuthorizationBarrier>
                    <BrowserRouter>
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
                              </Switch>
                            </Container>
                        </DropFile>
                    </BrowserRouter>
                </AuthorizationBarrier>
              </LocalizationProvider>
          </ThemeProvider>
      </ReactKeycloakProvider>
  );
}

export default App;
