import Axios from "axios";
import axios from "axios";
import keycloak from "../keycloak";

class UploadService {

    constructor() {
        this.axios = Axios.create();
        delete this.axios.defaults.headers.put['Content-Type'];
    }


    async _uploadPart(file, partInfo, work, results, progress) {
        await this.axios.put(partInfo.url, file.slice(partInfo.start, partInfo.end), {
            onUploadProgress: progressEvent => {
                progress[partInfo.partNumber-1] = progressEvent.loaded;
            }
        })
            .then(value => {
                results[partInfo.partNumber - 1] = {
                    ETag: value.headers.etag,
                    PartNumber: partInfo.partNumber
                };
            })
            .then(async () => {
                const next = work.shift();

                if(next) await this._uploadPart(file, next, work, results, progress);
            })
    }

    async _completeUpload(shareId, results) {
        await axios.post('/api/completeUpload/'+shareId, {
            parts: results
        },
    {
            headers: {
                Authorization: keycloak.token
            }
        })
    }

    uploadFile(shareId, file, partUrls, onProgress, onSpeedChange) {

        const fps = 3;
        const numParts = partUrls.length;
        const partSize = Math.ceil(file.size / numParts);

        const results = [];
        const progress = Array(numParts).fill(0);

        const previousCount = 15;
        const previous = Array(previousCount).fill({
            date: new Date(),
            progress: 0
        });

        let i = 0;
        const progressUpdateTimer = setInterval(() => {
            const currentProgress = progress.reduce((prev, curr) => prev + curr);
            const currentDate = new Date();

            previous[i] = {
                date: currentDate,
                progress: currentProgress
            };

            i = (i+1) % previousCount;

            const progressDiff = currentProgress - previous[i].progress;
            // In Milliseconds
            const dateDiff = currentDate - previous[i].date;
            const avSpeed = progressDiff / dateDiff * 1000;

            onSpeedChange(avSpeed);
            onProgress(currentProgress/file.size);
        }, 1000 / fps);

        const work = partUrls.map((url, index) => {
            return {
                partNumber: index+1,
                start: index * partSize,
                end: Math.min((index+1) * partSize, file.size+1),
                url
            };
        });

        return Promise.all(
            work.splice(0,5)
                .map((workPiece) => {
                    return this._uploadPart(file, workPiece, work, results, progress)
                })
        ).then(async () => {
            clearInterval(progressUpdateTimer);
            await this._completeUpload(shareId, results);
        })
    }
}

export const uploadService = new UploadService();