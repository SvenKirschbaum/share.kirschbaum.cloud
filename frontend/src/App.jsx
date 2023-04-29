import React, {useCallback, useEffect, useMemo} from 'react';
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
import {LocalizationProvider} from "@mui/x-date-pickers";
import {createTheme, ThemeProvider} from "@mui/material/styles";
import RequestShare from "./components/RequestShare";
import NotFound from "./components/NotFound";
import Unauthorized from "./components/Unauthorized";
import DropFile from "./components/DropFile";
import {AdapterLuxon} from "@mui/x-date-pickers/AdapterLuxon";
import {DateTime} from "luxon";
import {loadingState} from "./redux/util";
import {useDispatch, useSelector} from "react-redux";
import {AuthProvider, useAuth} from "react-oidc-context";
import {authUpdate} from "./redux/authentication/authentication.slice";
import {selectProfile} from "./redux/authentication/authentication.selector";
import {selectConfig, selectConfigState} from "./redux/config/config.selector";
import {fetchConfig} from "./redux/config/config.action";

function ReduxAuthAdapter({children}) {
    const auth = useAuth();
    const dispatch = useDispatch();

    React.useEffect(() => {
        dispatch(authUpdate({
            access_token: auth.user?.access_token,
            profile: auth.user?.profile
        }))
    }, [dispatch, auth.user?.access_token, auth.user?.profile]);

    return children;
}

function AuthRequired({children}) {
    const auth = useAuth();
    const profile = useSelector(selectProfile)

    useEffect(() => {
        if (!auth.isLoading && !auth.isAuthenticated) {
            auth.signinRedirect();
        }
    }, [auth.isLoading, auth.isAuthenticated, auth]);

    if(auth.isLoading) return "Loading...";

    const isAuthorized = auth.isAuthenticated && profile?.roles?.includes('member');

    return isAuthorized ? children : <Unauthorized/>;
}

function App() {
    const dispatch = useDispatch();
    const config = useSelector(selectConfig)
    const configState = useSelector(selectConfigState);

    useEffect(() => {
        if(configState === loadingState.idle) {
            dispatch(fetchConfig());
        }
    }, [configState, dispatch]);

    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
    const theme = React.useMemo(() =>
        createTheme({
            palette: {
                mode: prefersDarkMode ? 'dark' : 'light'
            }
        }
    ), [prefersDarkMode]);

    const locale = useMemo(() => DateTime.now().resolvedLocaleOptions().locale, []);

    const onSigninCallback = useCallback(() => {
        window.history.replaceState({}, document.title, window.location.pathname);
    }, []);

    if (configState === loadingState.failed) return "Error loading configuration";
    if (configState === loadingState.pending || configState === loadingState.idle) return "Loading...";

    return (
        <AuthProvider
            authority={`${config.KEYCLOAK.url}/realms/${config.KEYCLOAK.realm}`}
            client_id={config.KEYCLOAK.clientId}
            redirect_uri={window.location.origin.toString()}
            automaticSilentRenew={true}
            onSigninCallback={onSigninCallback}
        >
            <ReduxAuthAdapter>
                <ThemeProvider theme={theme}>
                    <LocalizationProvider dateAdapter={AdapterLuxon} adapterLocale={locale}>
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
            </ReduxAuthAdapter>
        </AuthProvider>
    );
}

export default App;
