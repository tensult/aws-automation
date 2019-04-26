tsc
for f in brightcoveVideosData/*.json
do

    FILE_NAME=$f node brightcove_videos_bulk_migrate.js
    if [ $? -gt 0 ]
    then
        exit 1
    fi
done