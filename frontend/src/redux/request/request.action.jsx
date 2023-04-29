import {createAsyncThunk} from "@reduxjs/toolkit";
import {selectApiUrl} from "../config/config.selector";
import axios from "axios";
import {selectAuthToken} from "../authentication/authentication.selector";
import {uploadFile} from "../upload/upload.slice";

export const fetchRequest = createAsyncThunk('request/fetchRequest', async (shareId, thunkAPI) => {
    const apiUrl = selectApiUrl(thunkAPI.getState());
    const response = await axios.get(`${apiUrl}/public/request/${shareId}`, {
        headers: {
            Authorization: selectAuthToken(thunkAPI.getState())
        },
    });

    return response.data
});
export const fullfillRequest = createAsyncThunk('request/fullfillRequest', async (payload, thunkAPI) => {
    const apiUrl = selectApiUrl(thunkAPI.getState());
    const {id, rawFile} = payload;

    const response = await axios.post(`${apiUrl}/public/request/${id}`, {
            fileName: rawFile.name,
            fileSize: rawFile.size,
            fileType: (rawFile.type || 'application/octet-stream')
        }
    )

    thunkAPI.dispatch(uploadFile({
        shareId: id,
        file: rawFile,
        size: rawFile.size,
        uploadUrls: response.data.uploadUrls,
        isRequest: true
    }))
});
