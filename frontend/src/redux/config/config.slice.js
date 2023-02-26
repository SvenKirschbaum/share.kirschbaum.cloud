import {createSlice} from "@reduxjs/toolkit";
import {loadingState} from "../util";
import {fetchConfig} from "./config.action";

const configSlice = createSlice({
    name: 'config',
    initialState: {
        state: loadingState.idle,
        error: null,
        config: {}
    },
    reducers: {},
    extraReducers(builder) {
        builder
            .addCase(fetchConfig.pending, (state, action) => {
                state.state = loadingState.pending
            })
            .addCase(fetchConfig.fulfilled, (state, action) => {
                state.state = loadingState.complete
                state.config = action.payload
            })
            .addCase(fetchConfig.rejected, (state, action) => {
                state.state = loadingState.failed
                state.error = action.error.message
            })
    }
});

export default configSlice.reducer;
