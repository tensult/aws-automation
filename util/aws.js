exports.parseTagsKeyValueString = function (tagsString) {
    if (!tagsString) {
        return undefined;
    }
    const tagKeyValueArray = tagsString.trim().split(/\s*;\s*/);
    return tagKeyValueArray.map((tagKeyValueString) => {
        const tagKeyValuePair = tagKeyValueString.split(/\s*[=:]\s*/);
        if (!tagKeyValuePair || tagKeyValuePair.length != 2) {
            return undefined;
        }
        return {
            Key: tagKeyValuePair[0],
            Value: tagKeyValuePair[1]
        }
    }).filter((tag) => {
        return tag && tag.Key && tag.Value;
    });
}

exports.parseFiltersNameValuesString = function (filtersString) {
    if (!filtersString) {
        return undefined;
    }
    const filterStringList = filtersString.trim().split(/\s*;\s*/);
    return filterStringList.map((filterString) => {
        const filterNameValuePair = filterString.split(/\s*[=:]\s*/);
        if (!filterNameValuePair || filterNameValuePair.length != 2) {
            return undefined;
        }
        return {
            Name: filterNameValuePair[0],
            Values: filterNameValuePair[1].split(/\s*,\s*/)
        }
    }).filter((filter) => {
        return filter && filter.Name && filter.Values;
    });
}

exports.parseTagKeysString = function (tagsString) {
    const tagKeyArray = tagsString.trim().split(/\s*,\s*/);
    return tagKeyArray.map((tagKey) => {
        return {
            Key: tagKey
        }
    })
}

exports.mergeTags = function (tags1, tags2) {
    if (!tags1 || !tags2) {
        return tags1 || tags2;
    }
    const tagsMap = tags1.concat(tags2).reduce((tagsObj, tag) => {
        tagsObj[tag.Key] = tag.Value;
        return tagsObj;
    }, {});
    return Object.keys(tagsMap).map((tagKey) => {
        return {
            Key: tagKey,
            Value: tagsMap[tagKey]
        };
    });
}

exports.getStringArrayFromCommaSeperatedString = function (stringValue) {
    if (!stringValue) {
        return undefined;
    }
    return stringValue.split(',').map((s) => {
        return s.trim();
    })
}