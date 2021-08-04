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

    uploadFile(shareId, file, partUrls, onProgress, currSpeed) {
        const numParts = partUrls.length;
        const partSize = Math.ceil(file.size / numParts);

        const results = [];
        const progress = Array(numParts).fill(0);

        const prevSpeedsSize = 10
        let prevSpeeds = Array(prevSpeedsSize).fill(0);
        let previous = 0;

        let first = true;
        let i = 0;
        const progressUpdateTimer = setInterval(() => {

            const current = progress.reduce((prev, curr) => prev + curr);
            prevSpeeds[i] = current - previous;
            previous = current;

            const avSpeed = first
                ? prevSpeeds.slice(0,i+1).reduce((prev, curr) => prev + curr) / (i+1)
                : prevSpeeds.reduce((prev, curr) => prev + curr) / prevSpeedsSize;

            currSpeed(avSpeed * 5);
            onProgress(current/file.size);

            if (++i === prevSpeedsSize){
                first = false;
                i = 0;
            }
        }, 200);

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