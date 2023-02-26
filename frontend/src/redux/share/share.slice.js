import {createSlice} from "@reduxjs/toolkit";
import {loadingState} from "../util";
import {addShare, deleteShare, fetchShares} from "./share.action";

const shareSlice = createSlice({
    name: 'shares',
    initialState: {
        add: {
            id: null,
            state: loadingState.idle,
            error: null
        },
        state: loadingState.idle,
        error: null,
        shares: []
    },
    reducers: {
        resetAdd(state, action) {
            state.add.id = null;
            state.add.state = loadingState.idle;
            state.add.error = null;
        },
        uploadError(state, action) {
            state.shares = state.shares.map((share) => {
                if (share.id === action.payload) {
                    share.uploadError = true;
                }
                return share;
            });
        }
    },
    extraReducers(builder) {
        builder
            .addCase(fetchShares.pending, (state, action) => {
                state.state = loadingState.pending
            })
            .addCase(fetchShares.fulfilled, (state, action) => {
                state.state = loadingState.complete;
                //It can happen that a upload has been started, even if the share list has not been loaded
                //We therefore concat the loaded shares to the existing list
                state.shares = action.payload.concat(state.shares);
            })
            .addCase(fetchShares.rejected, (state, action) => {
                state.state = loadingState.failed
                state.error = action.error.message
            })
            .addCase(deleteShare.pending, (state, action) => {
                state.shares = state.shares.map((share) => {
                    if (share.id === action.meta.arg) {
                        share.deleting = true;
                    }
                    return share;
                });
            })
            .addCase(deleteShare.fulfilled, (state, action) => {
                state.shares = state.shares.filter(value => value.id !== action.payload);
            })
            .addCase(deleteShare.rejected, (state, action) => {
                state.shares = state.shares.map((share) => {
                    if (share.id === action.meta.arg) {
                        share.deleting = false;
                    }
                    return share;
                });
            })
            .addCase(addShare.pending, (state, action) => {
                state.add.state = loadingState.pending;
                state.add.error = null;
            })
            .addCase(addShare.fulfilled, (state, action) => {
                state.add.state = loadingState.complete;
                state.add.id = action.payload.id;
                state.shares.push({
                    id: action.payload.id,
                    title: action.meta.arg.title,
                    type: action.meta.arg.type,
                    created: action.payload.created,
                    expire: action.meta.arg.expires,
                    clicks: {}
                });
            })
            .addCase(addShare.rejected, (state, action) => {
                state.add.state = loadingState.failed;
                state.add.error = action.error.message;
            })
    }
});

export const {resetAdd, uploadError} = shareSlice.actions;

export default shareSlice.reducer;
