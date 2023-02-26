import {createSlice} from "@reduxjs/toolkit";
import {completeUpload} from "./upload.action";

const uploadSlice = createSlice({
    name: 'uploads',
    initialState: {
        uploads: {}
    },
    reducers: {
        uploadFile(state, action) {
            const {shareId, isRequest, uploadUrls, size} = action.payload;

            //Add File to upload list
            state.uploads[shareId] = {
                parts: uploadUrls.length,
                size,
                speed: 0,
                progress: 0,
                progressParts: [],
                results: [],
                isRequest,
            };
        },
        completedPart(state, action) {
            state.uploads[action.payload.shareId].results[action.payload.PartNumber-1] = {
                ETag: action.payload.ETag,
                PartNumber: action.payload.PartNumber
            }
        },
        partProgress(state, action) {
            const {shareId, partNumber, loaded} = action.payload;
            state.uploads[shareId].progressParts[partNumber-1] = loaded;
        },
        updateProgress(state, action) {
            state.uploads[action.payload.shareId].progress = action.payload.progress;
            state.uploads[action.payload.shareId].speed = action.payload.speed;
        },
        cancelUpload(state, action) {
            delete state.uploads[action.payload];
        }
    },
    extraReducers(builder) {
        builder
            .addCase(completeUpload.fulfilled, (state, action) => {
                delete state.uploads[action.meta.arg];
            })
    }
});

export const {uploadFile, completedPart, partProgress, updateProgress, cancelUpload} = uploadSlice.actions;

export default uploadSlice.reducer;
