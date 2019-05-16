const superagent = require("superagent");
const fs = require('fs');
const _ = require('lodash');

const brightcoveAuthApiUrl = "https://oauth.brightcove.com/v3/access_token";
const brightcoveAccountApiUrl = "https://cms.api.brightcove.com/v1/accounts";
const brightcoveIngestApiUrl = "https://ingest.api.brightcove.com/v1/accounts";
const brightcoveDimensionApiUrl = "https://analytics.api.brightcove.com/v1/data";

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const BRIGHTCOVE_ACCOUNT_ID = process.env.BRIGHTCOVE_ACCOUNT_ID;
const FILE_DIR_PATH = process.env.FILE_DIR_PATH;
const FILE_NAME = process.env.FILE_NAME;
const FUNCTION_NAME = process.env.FUNCTION_NAME;
const INGETION_PROFILE = process.env.INGETION_PROFILE;
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
                })
                .send()
                .then(function (res) {
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

async function ingestVideo(brightcoveVideo) {
    const brightcoveVideoIngestApiUrl = [brightcoveIngestApiUrl,
        BRIGHTCOVE_ACCOUNT_ID,
        videosApiName,
        brightcoveVideo.id,
        "ingest-requests"
    ].join(pathDelimiter);
    return superagent.post(brightcoveVideoIngestApiUrl)
        .set({
            [authHeader]: await getAccessTokenAuthHeader()
        })
        .send({
            master: {
                use_archived_master: true
            },
            profile: INGETION_PROFILE
        }).then(function (res) {
            return res.body;
        }).catch(function (err) {
            console.log('Error while ingesting video \n', err);
            // throw err;
        });
};

async function getStatusOfVideoIngestedJob(brightcoveVideo) {
    try {
        const brightcoveVideoIngestJobStatusCheckApiUrl = [brightcoveIngestApiUrl,
            BRIGHTCOVE_ACCOUNT_ID,
            videosApiName,
            brightcoveVideo.id,
            brightcoveVideo.jobId,
        ].join(pathDelimiter);
        return superagent.post(brightcoveVideoIngestJobStatusCheckApiUrl)
            .set({
                [authHeader]: await getAccessTokenAuthHeader()
            })
            .send({
                master: {
                    use_archived_master: true
                },
                profile: "multi-platform-custom-2audio-5video"
            }).then(function (res) {
                return res.body;
            }).catch(function (err) {
                console.log(err);
                throw err;
            });
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
        var numberOfPages = Math.ceil(brightcoveVideosCounts.count / limit);
        while (numberOfPages) {
            let videos = await getVideosFromBrightCove(offset, limit);
            let videoViews = await getVideosWithViewFromBrightCove(getVideoIds(videos));
            videos.forEach((video) => {
                video.views = videoViews[video.id] || 0;
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

async function retranscodeVideos() {
    try {
        const videos = JSON.parse(fs.readFileSync(FILE_NAME, 'utf8'));
        let finalStatus = "done";
        for (const video of videos) {
            if (video.status === 'notProcessed' && video.views >= BRIGHTCOVE_VIDEO_MIN_VIEWS) {
                console.log("Processing video:", video.id, video.status, video.views);
                const ingestedVideo = await ingestVideo(video);
                if (!ingestVideo) {
                    video.status = "failed"
                    finalStatus = "failed";
                    continue;
                }
                video.jobId = ingestedVideo.id;
            } else {
                console.log("Skipping video:", video.id, video.status, video.views);
            }
        }
        for (const video of videos) {
            if (video.status === "failed") {
                continue;
            }
            while (true) {
                const ingestedJob = await getStatusOfVideoIngestedJob(video);
                if (ingestedJob.id !== 'finished') {
                    await wait(30000);
                } else {
                    break;
                }
            }
            video.status === 'transcoded';
        }
        fs.writeFileSync(FILE_DIR_PATH + "." + finalStatus, JSON.stringify(videos, null, 2));
        console.log("Completed", FILE_DIR_PATH);
    } catch (error) {
        console.error(error);
    }
}

functions['storeBrightcoveVideoDataInJson'] = storeBrightcoveVideoDataInJson;
functions['retranscodeVideos'] = retranscodeVideos;

if (functions[FUNCTION_NAME]) {
    functions[FUNCTION_NAME]();
}
