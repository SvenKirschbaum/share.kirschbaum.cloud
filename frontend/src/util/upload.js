import {useKeycloak} from "@react-keycloak/web";
import {useCallback, useState} from "react";
import {useConfig} from "./config";
import _axios from "axios";

const fps = 3;
const axios = _axios.create();
delete axios.defaults.headers.put['Content-Type'];

//This monster should be heavily refactored
export function useUpload(isRequest = false) {
    const {keycloak} = useKeycloak();
    const apiUrl = useConfig('API_URL');

    const [progress, setProgress] = useState(0);
    const [speed, setSpeed] = useState(0);

    const startUpload = useCallback((shareId, file, partUrls) => {
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

            setSpeed(avSpeed);
            setProgress(currentProgress/file.size);
        }, 1000 / fps);

        const work = partUrls.map((url, index) => {
            return {
                partNumber: index+1,
                start: index * partSize,
                end: Math.min((index+1) * partSize, file.size+1),
                url
            };
        });

        const uploadPart = async (partInfo) => {
            await axios.put(partInfo.url, file.slice(partInfo.start, partInfo.end), {
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
                if(next) await uploadPart(next);
            })
        }

        const completeUpload = async () => {
            const url = `${apiUrl}${isRequest ? '/public/completeUpload/' : `/completeUpload/`}`;

            await axios.post(url+shareId, {
                    parts: results
                },
            {
                headers: {
                    Authorization: keycloak.token
                }
            })
        }

        return Promise.all(
            work.splice(0,5)
                .map((workPiece) => {
                    return uploadPart(workPiece)
                })
        ).then(async () => {
            clearInterval(progressUpdateTimer);
            await completeUpload();
        })
    }, []);

    return [
        {
            progress,
            speed,
        },
        startUpload
    ]
}