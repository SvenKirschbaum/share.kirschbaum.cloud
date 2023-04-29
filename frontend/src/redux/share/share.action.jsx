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
    const apiUrl = selectApiUrl(thunkAPI.getState());

    const responses = await Promise.all(
        shareData.map(async (share) => {
            const {rawFile, ...requestData} = share;

            const response = await axios.post(`${apiUrl}/add`, requestData,
                {
                    headers: {
                        Authorization: selectAuthToken(thunkAPI.getState())
                    }
                }
            );

            if (share.type === 'FILE') {
                thunkAPI.dispatch(uploadFile({
                    shareId: response.data.shareId,
                    file: rawFile,
                    size: rawFile.size,
                    uploadUrls: response.data.uploadUrls
                }))
            }

            return response;
        })
    )

    //If we added only a single share, add its url to the clipboard
    if(shareData.length === 1) {
        const targetURL = window.location.protocol + '//' + window.location.host + (shareData[0].type === 'FILE_REQUEST' ? '/r/' : '/d/') + responses[0].data.shareId;
        navigator.clipboard.writeText(targetURL).then();
    }

    return responses.map((r,i) => ({
        id: r.data.shareId,
        created: DateTime.now().toISO(),
        title: shareData[i].title,
        type: shareData[i].type,
        expires: shareData[i].expires
    }));
});
