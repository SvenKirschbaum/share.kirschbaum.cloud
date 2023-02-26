import {channel, eventChannel, END} from 'redux-saga';
import {call, fork, take, put, all, takeEvery, select, throttle, delay} from 'redux-saga/effects';
import _axios, {CanceledError} from "axios";
import {
    completedPart, partProgress,
    updateProgress,
} from "./upload.slice";
import {uploadError} from "../share/share.slice";
import {completeUpload} from "./upload.action";
import {selectUpload} from "./upload.select";

const axios = _axios.create();
delete axios.defaults.headers.put['Content-Type'];

const PROGRESS_FPS = 3;
const PROGRESS_HISTORY_COUNT = 15;
const PARALLEL_UPLOADS = 3;

const abortControllerMap = new Map();

export function* uploadSaga() {
    //Check after each completed part, if the whole upload has been finished
    yield takeEvery('uploads/completedPart', onPartCompleted);

    //Handle abort requests
    yield takeEvery('uploads/cancelUpload', onCancelUpload);

    //Channel used to push upload parts to workers
    const chan = yield call(channel);

    //Start PARALLEL_UPLOADS workers
    for (let i = 0; i< PARALLEL_UPLOADS; i++) {
        yield fork(uploadWorker, chan);
    }

    //Start Progress Watcher
    yield fork(watchProgress);

    while(true) {
        //Watch for uploads
        const {payload} = yield take('uploads/uploadFile');

        const fileSize = payload.file.size;
        const partSize = Math.ceil(fileSize / payload.uploadUrls.length);

        const abortController = new AbortController();
        abortControllerMap.set(payload.shareId, abortController);

        //Calculate part data, and push to workers
        yield all(payload.uploadUrls.map(
            (partUrl, index) =>
                put(chan, {
                    shareId: payload.shareId,
                    partNumber: index+1,
                    partUrl,
                    file: payload.file,
                    start: index * partSize,
                    end: Math.min((index+1) * partSize, fileSize+1)
                })
        ));
    }
}

function* watchProgress() {
    let history = {};

    while(true) {
        yield delay(1000/PROGRESS_FPS);
        const uploads = yield select((s) => s.uploads.uploads);

        const now = new Date();

        yield all(
            Object.entries(uploads).map(([shareId, upload]) => {
                if(history[shareId] === undefined) {
                    history[shareId] = Array(PROGRESS_HISTORY_COUNT).fill({
                        date: new Date(),
                        progress: 0
                    })
                }

                const progress = upload.progressParts.reduce((prev, curr) => prev + curr, 0);
                history[shareId].push({
                    date: now,
                    progress
                });

                const first = history[shareId].shift();
                const progressDiff = progress - first.progress;
                // In Milliseconds
                const dateDiff = now - first.date;
                let avSpeed = progressDiff / dateDiff * 1000;
                if(!isFinite(avSpeed)) avSpeed = 0;

                return put(updateProgress({
                    shareId,
                    progress: progress/upload.size,
                    speed: avSpeed,
                }));
            })
        );

        //Remove completed history
        for (let key in history) {
            if(uploads[key] === undefined) delete history[key];
        }
    }
}

// Helper saga which checks if an entire file upload is complete, to call the finish api
function* onPartCompleted(action) {
    const upload = yield select(selectUpload, action.payload.shareId);
    const numCompleted = upload.results.filter((e) => e !== undefined).length;

    if (numCompleted === upload.parts) {
        abortControllerMap.delete(action.payload.shareId);
        yield put(completeUpload(action.payload.shareId));
    }
}

// eslint-disable-next-line require-yield
function* onCancelUpload(action) {
    const abortController = abortControllerMap.get(action.payload)

    abortController.abort();

    abortControllerMap.delete(action.payload);

    yield put({
        type: 'share/deleteShare/fulfilled',
        payload: action.payload
    });
}

function* uploadWorker(chan) {
    while(true) {
        //Take one part from channel
        const {shareId, partNumber, partUrl, file, start, end} = yield take(chan);

        //Event Channel for the Uploadprogress Events
        let emitProgress;
        const progressChan = eventChannel(emitter => {
            emitProgress = emitter;
            return () => {};
        });

        //Emit a Action at max every 200ms
        yield throttle(200, progressChan, onUploadProgress, shareId);

        try {
            const abortController = abortControllerMap.get(shareId);

            //This upload has been cancelled
            if(!abortController) continue;

            //Upload part
            const response = yield call(axios.put, partUrl, file.slice(start, end), {
                signal: abortController.signal,
                onUploadProgress: progressEvent => {
                    emitProgress({partNumber, loaded: progressEvent.loaded})
                }
            });

            //Put result back into state
            yield put(completedPart({
                shareId,
                ETag: response.headers.etag,
                PartNumber: partNumber,
            }))
        } catch (e) {
            if (e instanceof CanceledError) {
                //We aborted the request intentionally, continue with next part
                continue
            }

            //Abort further parts
            const abortController = abortControllerMap.get(shareId)
            abortController.abort();
            abortControllerMap.delete(shareId);

            //Mark the upload as failed
            yield put(uploadError(shareId))

            //Remove upload struct
            yield put({
                type: 'upload/complete/fulfilled',
                meta: {
                    arg: shareId
                }
            });
        } finally {
            emitProgress(END);
        }
    }
}

function* onUploadProgress(shareId, action) {
    yield put(partProgress({shareId, partNumber: action.partNumber, loaded: action.loaded}))
}
