import {createAsyncThunk} from "@reduxjs/toolkit";
import {selectApiUrl} from "../config/config.selector";
import axios from "axios";
import {selectAuthToken} from "../authentication/authentication.selector";
import {uploadFile} from "../upload/upload.slice";
import {DateTime} from "luxon";

export const fetchShares = createAsyncThunk('shares/fetchShares', async (_, thunkAPI) => {
    const apiUrl = selectApiUrl(thunkAPI.getState());
    const response = await axios.get(`${apiUrl}/list`, {
        headers: {
            Authorization: selectAuthToken(thunkAPI.getState())
        },
    });

    return response.data.shares;
});
export const deleteShare = createAsyncThunk('share/deleteShare', async (shareId, thunkAPI) => {
    const apiUrl = selectApiUrl(thunkAPI.getState());
    await axios.delete(`${apiUrl}/share/${shareId}`, {
        headers: {
            Authorization: selectAuthToken(thunkAPI.getState())
        }
    })

    return shareId;
});
export const addShare = createAsyncThunk('share/addShare', async (shareData, thunkAPI) => {
    const {rawFile, ...requestData} = shareData;
    const apiUrl = selectApiUrl(thunkAPI.getState());

    const response = await axios.post(`${apiUrl}/add`, requestData,
        {
            headers: {
                Authorization: selectAuthToken(thunkAPI.getState())
            }
        }
    );

    if (shareData.type === 'FILE') {
        thunkAPI.dispatch(uploadFile({
            shareId: response.data.shareId,
            file: rawFile,
            size: rawFile.size,
            uploadUrls: response.data.uploadUrls
        }))
    }

    //Add Share URL to clipboard
    const targetURL = window.location.protocol + '//' + window.location.host + (shareData.type === 'FILE_REQUEST' ? '/r/' : '/d/') + response.data.shareId;
    navigator.clipboard.writeText(targetURL).then();

    return {
        id: response.data.shareId,
        created: DateTime.now().toISO()
    }
});
