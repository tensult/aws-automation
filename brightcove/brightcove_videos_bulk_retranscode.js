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
const FILE_PATH = process.env.FILE_PATH;
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

async function ingestVideo(brightcoveAccountId, ingestionProfile, brightcoveVideo) {
    const brightcoveVideoIngestApiUrl = [brightcoveIngestApiUrl,
        brightcoveAccountId,
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
            profile: ingestionProfile
        }).then(function (res) {
            return res.body;
        }).catch(function (err) {
            console.log('Error while ingesting video \n', err);
            throw err;
        });
};
// ingestVideo('multi-platform-standard-static-with-mp4-retranscode',
// {
//     "id": "6052498735001",
//     "account_id": "5498268425001",
//     "ad_keys": null,
//     "clip_source_video_id": null,
//     "complete": true,
//     "created_at": "2019-06-26T12:54:54.338Z",
//     "created_by": {
//         "type": "api_key",
//         "email": "brightcove_ml@asianetnews.in"
//     },
//     "cue_points": [],
//     "custom_fields": {
//         "video_thumb": "http://static.asianetnews.com/images/01de9xyfq74bdek3dkxe5t89n2/jayarajan-png.jpg"
//     },
//     "delivery_type": "static_origin",
//     "description": "james mathew mla against mv govindan in nri suicide",
//     "digital_master_id": "6052495640001",
//     "duration": 87722,
//     "economics": "AD_SUPPORTED",
//     "folder_id": null,
//     "geo": null,
//     "has_digital_master": true,
//     "images": {
//         "thumbnail": {
//             "asset_id": "6052498086001",
//             "remote": false,
//             "src": "http://brightcove.vo.llnwd.net/v1/unsecured/media/5498268425001/201906/744/5498268425001_6052498086001_6052498735001-th.jpg?pubId=5498268425001&videoId=6052498735001",
//             "sources": [
//                 {
//                     "src": "http://brightcove.vo.llnwd.net/v1/unsecured/media/5498268425001/201906/744/5498268425001_6052498086001_6052498735001-th.jpg?pubId=5498268425001&videoId=6052498735001",
//                     "height": 90,
//                     "width": 123
//                 },
//                 {
//                     "src": "https://brightcove.hs.llnwd.net/v2/unsecured/media/5498268425001/201906/744/5498268425001_6052498086001_6052498735001-th.jpg?pubId=5498268425001&videoId=6052498735001",
//                     "height": 90,
//                     "width": 123
//                 }
//             ]
//         },
//         "poster": {
//             "asset_id": "6052495266001",
//             "remote": false,
//             "src": "http://brightcove.vo.llnwd.net/v1/unsecured/media/5498268425001/201906/744/5498268425001_6052495266001_6052498735001-vs.jpg?pubId=5498268425001&videoId=6052498735001",
//             "sources": [
//                 {
//                     "src": "http://brightcove.vo.llnwd.net/v1/unsecured/media/5498268425001/201906/744/5498268425001_6052495266001_6052498735001-vs.jpg?pubId=5498268425001&videoId=6052498735001",
//                     "height": 576,
//                     "width": 786
//                 },
//                 {
//                     "src": "https://brightcove.hs.llnwd.net/v2/unsecured/media/5498268425001/201906/744/5498268425001_6052495266001_6052498735001-vs.jpg?pubId=5498268425001&videoId=6052498735001",
//                     "height": 576,
//                     "width": 786
//                 }
//             ]
//         }
//     },
//     "link": {
//         "url": "https://www.asianetnews.com/video/kerala-news/james-mathew-mla-against-mv-govindan-in-nri-suicide-ptpiu8"
//     },
//     "long_description": null,
//     "name": "james mathew mla against mv govindan in nri suicide",
//     "original_filename": "jayarajan.mov",
//     "projection": null,
//     "published_at": "2019-06-26T12:54:54.365Z",
//     "reference_id": "01de9xmge1hvb7g8vr7qgg8y10",
//     "schedule": null,
//     "sharing": null,
//     "state": "ACTIVE",
//     "tags": [],
//     "text_tracks": [],
//     "updated_at": "2019-06-26T13:01:23.202Z",
//     "updated_by": {
//         "type": "api_key",
//         "email": "brightcove_ml@asianetnews.in"
//     },
//     "views": 241,
//     "status": "notProcessed"}).then((res)=> {console.log('ingestedVideo\n', res)});

async function getIngestedJob(brightcoveAccountId, ingestionProfile, brightcoveVideo) {
    // try {
    //     const brightcoveVideoIngestJobStatusCheckApiUrl = [brightcoveIngestApiUrl,
    //         BRIGHTCOVE_ACCOUNT_ID,
    //         videosApiName,
    //         brightcoveVideo.id,
    //         brightcoveVideo.jobId,
    //     ].join(pathDelimiter);
    //     console.log('brightcove status check url', brightcoveVideoIngestJobStatusCheckApiUrl);
    //     return superagent.get(brightcoveVideoIngestJobStatusCheckApiUrl)
    //         .set({
    //             [authHeader]: await getAccessTokenAuthHeader()
    //         })
    //         .send({
    //             master: {
    //                 use_archived_master: true
    //             },
    //             profile: ingestionProfile
    //         }).then(function (res) {
    //             return res.body;
    //         }).catch(function (err) {
    //             console.log('error in status update while injesting', err);
    //             throw err;
    //         });
    // } catch (error) {
    //     throw error;
    // }
    try {
        const brightcoveVideoIngestJobStatusCheckApiUrl = [brightcoveAccountApiUrl,
            brightcoveAccountId,
            videosApiName,
            brightcoveVideo.id,
            'ingest_jobs',
            brightcoveVideo.jobId,
        ].join(pathDelimiter);
        console.log(brightcoveVideoIngestJobStatusCheckApiUrl);

        return superagent.get(brightcoveVideoIngestJobStatusCheckApiUrl)
            .set({
                [authHeader]: await getAccessTokenAuthHeader()
            })
            .send({
                master: {
                    use_archived_master: true
                },
                profile: ingestionProfile
            }).then(function (res) {
                return res.body;
            }).catch(function (error) {
                throw error;
            });
    } catch (error) {
        throw error;
    }

}
// getStatusOfVideoIngestedJob('5498268425001', 'multi-platform-standard-static-with-mp4-retranscode',
//     {
//         "id": "6052498735001",
//         "account_id": "5498268425001",
//         "ad_keys": null,
//         "clip_source_video_id": null,
//         "complete": true,
//         "created_at": "2019-06-26T12:54:54.338Z",
//         "created_by": {
//             "type": "api_key",
//             "email": "brightcove_ml@asianetnews.in"
//         },
//         "cue_points": [],
//         "custom_fields": {
//             "video_thumb": "http://static.asianetnews.com/images/01de9xyfq74bdek3dkxe5t89n2/jayarajan-png.jpg"
//         },
//         "delivery_type": "static_origin",
//         "description": "james mathew mla against mv govindan in nri suicide",
//         "digital_master_id": "6052495640001",
//         "duration": 87722,
//         "economics": "AD_SUPPORTED",
//         "folder_id": null,
//         "geo": null,
//         "has_digital_master": true,
//         "images": {
//             "thumbnail": {
//                 "asset_id": "6052498086001",
//                 "remote": false,
//                 "src": "http://brightcove.vo.llnwd.net/v1/unsecured/media/5498268425001/201906/744/5498268425001_6052498086001_6052498735001-th.jpg?pubId=5498268425001&videoId=6052498735001",
//                 "sources": [
//                     {
//                         "src": "http://brightcove.vo.llnwd.net/v1/unsecured/media/5498268425001/201906/744/5498268425001_6052498086001_6052498735001-th.jpg?pubId=5498268425001&videoId=6052498735001",
//                         "height": 90,
//                         "width": 123
//                     },
//                     {
//                         "src": "https://brightcove.hs.llnwd.net/v2/unsecured/media/5498268425001/201906/744/5498268425001_6052498086001_6052498735001-th.jpg?pubId=5498268425001&videoId=6052498735001",
//                         "height": 90,
//                         "width": 123
//                     }
//                 ]
//             },
//             "poster": {
//                 "asset_id": "6052495266001",
//                 "remote": false,
//                 "src": "http://brightcove.vo.llnwd.net/v1/unsecured/media/5498268425001/201906/744/5498268425001_6052495266001_6052498735001-vs.jpg?pubId=5498268425001&videoId=6052498735001",
//                 "sources": [
//                     {
//                         "src": "http://brightcove.vo.llnwd.net/v1/unsecured/media/5498268425001/201906/744/5498268425001_6052495266001_6052498735001-vs.jpg?pubId=5498268425001&videoId=6052498735001",
//                         "height": 576,
//                         "width": 786
//                     },
//                     {
//                         "src": "https://brightcove.hs.llnwd.net/v2/unsecured/media/5498268425001/201906/744/5498268425001_6052495266001_6052498735001-vs.jpg?pubId=5498268425001&videoId=6052498735001",
//                         "height": 576,
//                         "width": 786
//                     }
//                 ]
//             }
//         },
//         "link": {
//             "url": "https://www.asianetnews.com/video/kerala-news/james-mathew-mla-against-mv-govindan-in-nri-suicide-ptpiu8"
//         },
//         "long_description": null,
//         "name": "james mathew mla against mv govindan in nri suicide",
//         "original_filename": "jayarajan.mov",
//         "projection": null,
//         "published_at": "2019-06-26T12:54:54.365Z",
//         "reference_id": "01de9xmge1hvb7g8vr7qgg8y10",
//         "schedule": null,
//         "sharing": null,
//         "state": "ACTIVE",
//         "tags": [],
//         "text_tracks": [],
//         "updated_at": "2019-06-26T13:01:23.202Z",
//         "updated_by": {
//             "type": "api_key",
//             "email": "brightcove_ml@asianetnews.in"
//         },
//         "views": 241,
//         "status": "notProcessed"
//     }).then((res) => {
//         console.log('res\n', res);
//     });

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
            console.log("videoViews", videoViews);
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

async function retranscodeVideos() {
    try {
        const videos = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
        let finalStatus = "done";
        for (const video of videos) {
            console.log('Transcoding video\n', video.id);
            if (video.status === 'notProcessed' && video.views >= BRIGHTCOVE_VIDEO_MIN_VIEWS) {

                // Check video is ingested or not 

                const injestJobStatusResponse = await getIngestedJob(BRIGHTCOVE_ACCOUNT_ID, INGETION_PROFILE, video);
                console.log('Check before ingestion response\n', injestJobStatusResponse)
                if (injestJobStatusResponse[0] && injestJobStatusResponse[0].state === 'finished') {
                    console.log(`VideoId: ${injestJobStatusResponse[0].video_id} is already ingested`);
                    if (video.status !== 'transcoded') {
                        video.status = 'transcoded';
                    }
                    continue;
                }
                if (injestJobStatusResponse[0] &&
                    injestJobStatusResponse[0].state === 'processing' &&
                    injestJobStatusResponse[0].state === 'publishing' &&
                    injestJobStatusResponse[0].state === 'published') {
                    continue;
                }


                const ingestedVideo = await ingestVideo(BRIGHTCOVE_ACCOUNT_ID, INGETION_PROFILE, video);
                console.log('injestedVideoResponse\n', ingestedVideo);
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
        console.log('Transcoding requests completed and starting checking status........');
        for (const video of videos) {
            console.log('Video\n', video.id);
            if (video.status === "failed" || video.status === "transcoded") {
                continue;
            }
            while (true) {
                const ingestedJobResponse = await getIngestedJob(BRIGHTCOVE_ACCOUNT_ID, INGETION_PROFILE, video);
                if (ingestedJobResponse[0].state !== 'finished') {
                    await wait(30000);
                } else {
                    break;
                }
            }
            video.status === 'transcoded';
        }
        fs.writeFileSync(FILE_PATH + "." + finalStatus, JSON.stringify(videos, null, 2));
    } catch (error) {
        console.error(error);
    }
}

functions['storeBrightcoveVideoDataInJson'] = storeBrightcoveVideoDataInJson;
functions['retranscodeVideos'] = retranscodeVideos;

if (functions[FUNCTION_NAME]) {
    functions[FUNCTION_NAME]();
}
