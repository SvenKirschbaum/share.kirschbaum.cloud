import {createSlice} from "@reduxjs/toolkit";
import {loadingState} from "../util";
import {fetchRequest, fullfillRequest} from "./request.action";

const requestSlice = createSlice({
    name: 'request',
    initialState: {
        state: loadingState.idle,
        uploadState: loadingState.idle,
        error: undefined,
        uploading: false,
        id: null,
        request: {}
    },
    reducers: {

    },
    extraReducers(builder) {
        builder
            .addCase(fetchRequest.pending, (state, action) => {
                state.id = action.meta.arg
                state.error = undefined;
                state.state = loadingState.pending
            })
            .addCase(fetchRequest.fulfilled, (state, action) => {
                state.state = loadingState.complete
                state.request = action.payload
            })
            .addCase(fetchRequest.rejected, (state, action) => {
                state.state = loadingState.failed
                state.error = action.error
            })
            .addCase(fullfillRequest.pending, (state, action) => {
                state.error = undefined;
                state.uploadState = loadingState.pending;
            })
            .addCase(fullfillRequest.rejected, (state, action) => {
                state.error = action.error;
                state.uploadState = loadingState.failed;
            })
            .addCase(fullfillRequest.fulfilled, (state, action) => {
                state.uploading = true;
                state.uploadState = loadingState.complete;
            })
    }
})

export default requestSlice.reducer
