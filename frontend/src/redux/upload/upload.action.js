import {createAsyncThunk} from "@reduxjs/toolkit";
import {selectApiUrl} from "../config/config.selector";
import axios from "axios";
import {selectAuthToken} from "../authentication/authentication.selector";
import {selectUpload} from "./upload.select";

export const completeUpload = createAsyncThunk('upload/complete', async (shareId, thunkAPI) => {
    const apiUrl = selectApiUrl(thunkAPI.getState());
    const upload = selectUpload(thunkAPI.getState(), shareId);
    const url = `${apiUrl}${upload.isRequest ? '/public/completeUpload/' : `/completeUpload/`}`;

    await axios.post(url + shareId, {
            parts: upload.results
        },
        {
            headers: {
                Authorization: selectAuthToken(thunkAPI.getState())
            }
        })
})
