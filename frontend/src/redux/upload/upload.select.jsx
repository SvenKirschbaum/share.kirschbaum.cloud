export const selectUpload = (state, shareId) => state.uploads.uploads[shareId];
export const isUpload = (state, shareId) => state.uploads.uploads[shareId] !== undefined;
export const selectUploadProgress = (state, shareId) => state.uploads.uploads[shareId].progress;
export const selectUploadSpeed = (state, shareId) => state.uploads.uploads[shareId].speed;
