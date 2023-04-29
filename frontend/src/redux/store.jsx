import {configureStore} from "@reduxjs/toolkit";
import uploadReducer from "./upload/upload.slice";
import shareReducer from "./share/share.slice";
import configReducer from "./config/config.slice";
import requestReducer from "./request/request.slice";
import authenticationReducer from "./authentication/authentication.slice";
import createSagaMiddleware from 'redux-saga'
import { all } from 'redux-saga/effects'
import {uploadSaga} from "./upload/upload.saga";

const sagaMiddleware = createSagaMiddleware();

export default configureStore({
    reducer: {
        authentication: authenticationReducer,
        shares: shareReducer,
        uploads: uploadReducer,
        config: configReducer,
        request: requestReducer
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({
        serializableCheck: {
            //The file attribute is only included for saga behavior, and not used in reducers
            ignoredActionPaths: ['payload.file', /^meta\.arg\.\d+\.rawFile$/]
        }
    }).concat([sagaMiddleware])
})

sagaMiddleware.run(function* () {
    yield all([
        uploadSaga()
    ])
});
