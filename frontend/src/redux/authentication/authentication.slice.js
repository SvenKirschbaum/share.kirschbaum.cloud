import {createSlice} from "@reduxjs/toolkit";


const authenticationSlice = createSlice({
    name: 'authentication',
    initialState: {
        access_token: null,
        profile: null
    },
    reducers: {
        authUpdate(state, action) {
            state.access_token = action.payload.access_token;
            state.profile = action.payload.profile;
        }
    }
});

export const {authUpdate} = authenticationSlice.actions;

export default authenticationSlice.reducer;
