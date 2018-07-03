module.exports = function(timeInMills) {
    return new Promise((resolve) => {
        setTimeout(resolve, timeInMills);
    });
}
