import React, {useEffect, useState} from 'react';
import {ReactKeycloakProvider, useKeycloak} from "@react-keycloak/web";
import {
    Container,
    CssBaseline,
    useMediaQuery,
} from "@mui/material";

import "@fontsource/roboto"
import './App.css';
import ShareList from "./components/ShareList";
import {BrowserRouter, Route, Routes} from "react-router-dom";
import {AddFile, AddRequest, AddLink, TypeSelection} from "./components/AddShare";
import {LocalizationProvider} from "@mui/lab";
import DateAdapter from '@mui/lab/AdapterMoment';
import {createTheme, ThemeProvider} from "@mui/material/styles";
import RequestShare from "./components/RequestShare";
import NotFound from "./components/NotFound";
import Keycloak from "keycloak-js";
import {ConfigurationContext} from "./util/config";
import Unauthorized from "./components/Unauthorized";
import DropFile from "./components/DropFile";

function AuthRequired({children}) {
    const {keycloak} = useKeycloak();

    if (!keycloak.authenticated) {
        keycloak.login();
        return null;
    }

    const isAuthorized = keycloak.tokenParsed?.roles?.includes('member');

    return isAuthorized ? children : <Unauthorized/>;
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

    if (!config) return null;

    return (
        <ConfigurationContext.Provider value={config}>
            <ReactKeycloakProvider authClient={keycloak} LoadingComponent={<React.Fragment/>} initOptions={{
                onLoad: '',
                promiseType: 'native',
                flow: 'standard',
                pkceMethod: 'S256',
                checkLoginIframe: false,
            }}>
                <ThemeProvider theme={theme}>
                    <LocalizationProvider dateAdapter={DateAdapter}>
                        <CssBaseline/>
                        <BrowserRouter>
                            <DropFile/>
                            <Container sx={{
                                marginTop: '4em',
                                marginBottom: '4em',
                            }} maxWidth={"sm"}>
                                <Routes>
                                    <Route path={'/'} exact element={<AuthRequired><ShareList/></AuthRequired>}/>
                                    <Route path={'/add'}>
                                        <Route exact path="" element={
                                            <AuthRequired>
                                                <TypeSelection/>
                                            </AuthRequired>
                                        }/>
                                        <Route path="link" element={
                                            <AuthRequired>
                                                <AddLink/>
                                            </AuthRequired>
                                        }/>
                                        <Route path="file" element={
                                            <AuthRequired>
                                                <AddFile/>
                                            </AuthRequired>
                                        }/>
                                        <Route path="request" element={
                                            <AuthRequired>
                                                <AddRequest/>
                                            </AuthRequired>
                                        }/>
                                        <Route path="*" element={
                                            <AuthRequired>
                                                <NotFound/>
                                            </AuthRequired>
                                        }/>
                                    </Route>
                                    <Route path={"/r/:id"} element={<RequestShare/>}/>
                                    <Route path={'*'} element={<NotFound/>}/>
                                </Routes>
                            </Container>
                        </BrowserRouter>
                    </LocalizationProvider>
                </ThemeProvider>
            </ReactKeycloakProvider>
        </ConfigurationContext.Provider>
    );
}

export default App;
