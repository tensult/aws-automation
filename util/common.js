exports.toArray = function (obj) {
    if (Array.isArray(obj)) {
        return obj;
    }
    return [obj];
}