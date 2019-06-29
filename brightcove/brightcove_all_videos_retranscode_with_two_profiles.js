const superagent = require("superagent");
const fs = require('fs');
const _ = require('lodash');
const pageNumber = process.env.PAGENUMBER;


const brightcoveAuthApiUrl = "https://oauth.brightcove.com/v3/access_token";
const brightcoveAccountApiUrl = "https://cms.api.brightcove.com/v1/accounts";
const brightcoveIngestApiUrl = "https://ingest.api.brightcove.com/v1/accounts";
const brightcoveDimensionApiUrl = "https://analytics.api.brightcove.com/v1/data";

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const BRIGHTCOVE_ACCOUNT_ID = process.env.BRIGHTCOVE_ACCOUNT_ID;
const FILE_DIR_PATH = process.env.FILE_DIR_PATH;
const FILE_PATH = process.env.FILE_PATH;
const FUNCTION_NAME = process.env.FUNCTION_NAME;
const INGETION_PROFILE_MORE_VIEWS = process.env.INGETION_PROFILE_FOR_MORE_VIEWS;
const INGETION_PROFILE_LESS_VIEWS = process.env.INGETION_PROFILE_FOR_LESS_VIEWS;
const BRIGHTCOVE_VIDEO_MIN_VIEWS = process.env.BRIGHTCOVE_VIDEO_MIN_VIEWS ?
    parseInt(process.env.BRIGHTCOVE_VIDEO_MIN_VIEWS) : 0;


const videosApiName = "videos";
const dimensions = "video";
const formRequestType = "form";
const authHeader = "Authorization";
const pathDelimiter = "/";
const brightcoveVideosDataDir = FILE_DIR_PATH
const cache = {};
const functions = {};

function divideArrayInSubArrays(arr, subArrayLength) {
    return _.chunk(arr, subArrayLength);
}

function createDirectory() {
    if (!fs.existsSync(brightcoveVideosDataDir)) {
        fs.mkdirSync(brightcoveVideosDataDir);
    }
}

function wait(ms) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve(ms)
        }, ms)
    })
}

function getClientSecretAuthHeader() {
    const clientId = CLIENT_ID;
    const clientSecret = CLIENT_SECRET;
    const clientSecretToken = Buffer.from(clientId + ':' + clientSecret).toString('base64');
    return "Basic " + clientSecretToken;
};

function getAccessTokenAuthHeader() {
    if (cache.accessTokenAuthHeader && cache.accessTokenAuthHeader.time > Date.now() - 60 * 1000) {
        return cache.accessTokenAuthHeader.key;
    }
    return superagent.post(brightcoveAuthApiUrl)
        .type(formRequestType)
        .set({
            [authHeader]: getClientSecretAuthHeader()
        })
        .send({
            grant_type: "client_credentials"
        }).then(function (response) {
            cache.accessTokenAuthHeader = {};
            cache.accessTokenAuthHeader.key = response.body.token_type + " " + response.body.access_token;
            cache.accessTokenAuthHeader.time = Date.now();
            return cache.accessTokenAuthHeader.key;
        });
};

async function getVideosFromBrightCove(offset = 0, limit = 1) {
    const brightcoveVideoApiUrl = [brightcoveAccountApiUrl,
        BRIGHTCOVE_ACCOUNT_ID,
        videosApiName
    ].join(pathDelimiter);
    return await superagent.get(brightcoveVideoApiUrl + `?offset=${offset}&limit=${limit}`)
        .set({
            [authHeader]: await getAccessTokenAuthHeader()
        })
        .send()
        .then(function (res) {
            return res.body;
        });
}

async function getVideosWithViewFromBrightCove(_videoIds) {
    try {
        let videoData = [];
        const dividedVideoIds = divideArrayInSubArrays(_videoIds, 5);
        for (const videoIds of dividedVideoIds) {
            const brightcoveVideosWithViewApiUrl = brightcoveDimensionApiUrl + `?accounts=${BRIGHTCOVE_ACCOUNT_ID}&dimensions=${dimensions}&where=video==${videoIds.join(",")}`;
            const retrieveVideos = await superagent.get(brightcoveVideosWithViewApiUrl).set({
                [authHeader]: await getAccessTokenAuthHeader()
            }).send().then(function (res) {
                return res.body.items;
            });
            videoData = videoData.concat(retrieveVideos);
        }
        return videoData.reduce((videosMap, video) => {
            videosMap[video.video] = video.video_view;
            return videosMap;
        }, {});
    } catch (error) {
        console.log('get', error)
    }
}

async function ingestVideo(brightcoveAccountId, ingestionProfile, brightcoveVideo) {
    try {
        const brightcoveVideoIngestApiUrl = [brightcoveIngestApiUrl,
            brightcoveAccountId,
            videosApiName,
            brightcoveVideo.id,
            "ingest-requests"
        ].join(pathDelimiter);
        console.log("brightcoveVideoIngestApiUrl", brightcoveVideoIngestApiUrl);
        const response = await superagent.post(brightcoveVideoIngestApiUrl)
            .set({
                [authHeader]: await getAccessTokenAuthHeader()
            })
            .send({
                master: {
                    use_archived_master: true
                },
                profile: ingestionProfile
            })
        return response.body;
    } catch (error) {
        return undefined;
    }
};


async function getIngestedJob(brightcoveAccountId, ingestionProfile, brightcoveVideo) {
    if (!brightcoveVideo || !brightcoveVideo.jobId) {
        return;
    }
    try {
        const brightcoveVideoIngestJobStatusCheckApiUrl = [brightcoveAccountApiUrl,
            brightcoveAccountId,
            videosApiName,
            brightcoveVideo.id,
            'ingest_jobs',
            brightcoveVideo.jobId,
        ].join(pathDelimiter);
        const response = await superagent.get(brightcoveVideoIngestJobStatusCheckApiUrl)
            .set({
                [authHeader]: await getAccessTokenAuthHeader()
            })
            .send({
                master: {
                    use_archived_master: true
                },
                profile: ingestionProfile
            });

        console.log('video status response', response.body);
        return response.body;
    } catch (error) {
        throw error;
    }

}

async function getBrightcoveVideosCounts() {
    const brightcoveVideoApiUrl = [brightcoveAccountApiUrl,
        BRIGHTCOVE_ACCOUNT_ID,
        'counts',
        videosApiName
    ].join(pathDelimiter);
    return await superagent.get(brightcoveVideoApiUrl)
        .set({
            [authHeader]: await getAccessTokenAuthHeader()
        })
        .send()
        .then(function (res) {
            return res.body;
        });
}

function getVideoIds(videos) {
    return videos.map((video) => video.id);
}

async function storeBrightcoveVideoDataInJson() {
    try {
        createDirectory();
        let offset = 0;
        const limit = 20;
        const brightcoveVideosCounts = await getBrightcoveVideosCounts();
        var numberOfPages = pageNumber || Math.ceil(brightcoveVideosCounts.count / limit);
        while (numberOfPages) {
            let videos = await getVideosFromBrightCove(offset, limit);
            let videoViews = await getVideosWithViewFromBrightCove(getVideoIds(videos));
            // console.log("videoViews", videoViews);
            videos.forEach((video) => {
                video.views = (videoViews && videoViews[video.id]) || 0;
                video.status = 'notProcessed';
                return video;
            });
            const json = JSON.stringify(videos, null, 2);
            fs.writeFileSync(`${brightcoveVideosDataDir}/${numberOfPages}.json`, json);
            offset += videos.length;
            console.log(`${numberOfPages} page data stored`);
            numberOfPages--;
        }
    } catch (error) {
        console.error(error);
    }
}

async function retranscodeVideosInLoop(videos, ingetion_profile) {
    try {
        for (const video of videos) {
            console.log('Transcoding video\n', video.id);
            if (video.status !== "notProcessed") {
                continue;
            }
            console.log("profile at ingestvideo", ingetion_profile);
            const ingestedVideo = await ingestVideo(BRIGHTCOVE_ACCOUNT_ID, ingetion_profile, video);
            console.log(video.id, 'injestedVideoResponse\n', ingestedVideo);
            if (!ingestedVideo) {
                video.status = "failed"
                continue;
            } else {
                video.jobId = ingestedVideo.id;
                video.status = "processing";
            }
        }
    } catch (error) {
        console.log('error while ingesting', error);
        throw error;
    }
}

async function waitForRetranscodeToComplete(videos, ingetion_profile) {
    try {
        while (videos.length) {
            let newPendingVideos = [];
            for (const video of videos) {
                console.log('Video ', video.id);
                if (video.status === "failed" || video.status === "transcoded") {
                    continue;
                }
                const ingestedJobResponse = await getIngestedJob(BRIGHTCOVE_ACCOUNT_ID, ingetion_profile, video);
                console.log('ingested job response', ingestedJobResponse);
                if (ingestedJobResponse &&
                    ingestedJobResponse.state === 'finished') {
                    console.log("Processed video status", ingestedJobResponse.state);
                    video.status = 'transcoded';
                } else {
                    newPendingVideos.push(video);
                }
            }
            if (pendingVideos.length) {
                console.log('under pending videos')
                await wait(10000);
            } else {
                return;
            }
        }
    } catch (error) {
        console.log('error while gettingStatus', error);
        throw error;
    }

}
async function retranscodeVideos() {
    try {
        let finalStatus = "done";
        const videos = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
        const filteredVideosForMoreViews = [];
        const filteredVideosForLessViews = [];
        videos.forEach((video) => {
            if (video.views >= BRIGHTCOVE_VIDEO_MIN_VIEWS && video.status === 'notProcessed') {
                filteredVideosForMoreViews.push(video);
            } else if (video.views < BRIGHTCOVE_VIDEO_MIN_VIEWS && video.status === 'notProcessed') {
                filteredVideosForLessViews.push(video);
            } else {
                console.log('Skipping video:', video.id, video.name);
            }
        });
        await retranscodeVideosInLoop(filteredVideosForMoreViews, INGETION_PROFILE_MORE_VIEWS);
        console.log('Transcoding requests completed and starting checking status........');
        await waitForRetranscodeToComplete(filteredVideosForMoreViews, INGETION_PROFILE_MORE_VIEWS);
        console.log('get response of retranscoded videos.........');

        await retranscodeVideosInLoop(filteredVideosForLessViews, INGETION_PROFILE_LESS_VIEWS);
        console.log('Transcoding requests completed and starting checking status........');
        await waitForRetranscodeToComplete(filteredVideosForLessViews, INGETION_PROFILE_LESS_VIEWS);
        console.log('get response of retranscoded videos.........');
        fs.writeFileSync(FILE_PATH, JSON.stringify(videos, null, 2));
        fs.renameSync(FILE_PATH, FILE_PATH + "." + finalStatus);
    } catch (error) {
        console.error('error while retranscoding videos', error);
    }
}

functions['storeBrightcoveVideoDataInJson'] = storeBrightcoveVideoDataInJson;
functions['retranscodeVideos'] = retranscodeVideos;

if (functions[FUNCTION_NAME]) {
    functions[FUNCTION_NAME]();
}