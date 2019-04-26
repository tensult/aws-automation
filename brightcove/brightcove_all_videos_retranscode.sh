for fileName in $1/*.json; do

    FILE_NAME=$fileName node brightcove_videos_bulk_retranscode.js
    if [ $? -gt 0 ]; then
        exit 1
    fi
done
