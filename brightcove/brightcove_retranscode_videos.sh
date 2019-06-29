for filePath in $FILE_DIR_PATH/*.json; do
    FILE_PATH=$filePath node brightcove_videos_retranscode.js
    if [ $? -gt 0 ]; then
        exit 1
    fi
done
