var config      = require('../config'),
    debug       = require('debug')('gu-filesfolders'),
    request     = require('request'),
    Promise     = require('bluebird'),
    fs          = require('fs');

Promise.promisifyAll(request);
Promise.promisifyAll(fs);

var filesfolders = {
    mkDir: function (dir) {
        return this.mk(dir, true);
    },

    mkFile: function (file) {
        return this.mk(file, false);
    },

    rmDir: function (dir) {
        return this.rm(dir, true);
    },

    rmFile: function (file) {
        return this.rm(file, false);
    },

    mk: function (target, isDir) {
        target = (isDir) ? target + '/' : target;

        return request.putAsync(config.website + '/api/vfs/' + target, {
            'auth': config.auth(),
        }).then(function(response) {
            return response;
        }).catch(console.log);
    },

    rm: function (target, isDir) {
        target = (isDir) ? target + '/?recursive=true' : target;

        return request.delAsync(config.website + '/api/vfs/' + target, {
            'auth': config.auth()
        }).then(function(response) {
            debug('Delete: ', response);
            return response;
        }).catch(console.log);    
    },

    list: function (target) {
        return new Promise(function (resolve, reject) {
            var targetUrl = config.website + '/api/vfs/' + target + '/',
                errorCheck;

            debug('Listing dir for ' + targetUrl);
            request.getAsync(targetUrl, {'auth': config.auth()})
            .then(function (response) {
                errorCheck = filesfolders.checkForError(response);
                if (errorCheck) {
                    return reject(errorCheck);
                } 

                resolve(response);
            }).catch(function (error) {
                debug('List: Request failed', error);
                reject(error);
            });
        });
    },

    upload: function (source, target) {
        return new Promise(function (resolve, reject) {
            var targetUrl = config.website + '/api/vfs/' + target,
                sourceStream, errorCheck;

            if (!fs.existsSync(source)) {
                return reject('The file ' + source + ' does not exist or cannot be read.');
            }

            sourceStream = fs.createReadStream(source);

            debug('Uploading ' + source + ' to ' + target);

            sourceStream.pipe(request.put(targetUrl, {'auth': config.auth()}, 
                function(error, result) {
                    if (error) {
                        debug('Upload Error: ', error);
                        return reject(error);
                    }
                    return resolve(result);
                })
            );
        });
    },

    uploadWebjob: function (source, name) {
        return new Promise(function (resolve, reject) {
            var targetUrl = config.website + '/api/triggeredwebjobs/' + name,
                sourceStream = fs.createReadStream(source),
                errorCheck;

            debug('Uploading Webjob ' + source + ' as ' + name);

            request.delAsync(targetUrl, {'auth': config.auth()})
            .then(function () {
                sourceStream.pipe(request.put(targetUrl, {
                    'auth': config.auth(),
                    'headers': {
                        'Content-Disposition': 'attachement; filename=' + name
                    }
                }, 
                    function(error, response, body) {
                        if (error) {
                            debug('Upload Webjob Error: ', error);
                            reject(error);
                        }

                        debug('Upload Webjob Response: ', response);
                        debug('Upload Webjob Body: ', body);

                        errorCheck = filesfolders.checkForError(response);
                        if (errorCheck) {
                            return reject(errorCheck);
                        } 

                        resolve(response);
                    })
                );
            }).catch(function (error) {
                reject(error);
            });
        });
    },

    getWebjobInfo: function (name) {
        return new Promise(function (resolve, reject) {
            var targetUrl = config.website + '/api/triggeredwebjobs/' + name,
            errorCheck;

            request.get(targetUrl, {'auth': config.auth()},
                function (error, response, body) {
                    if (error) {
                        debug('Get Webjob Info Error: ', error);
                        reject(error);
                    }

                    debug('Get Webjob Info Response: ', response);
                    debug('Get Webjob Info Body: ', body);

                    errorCheck = filesfolders.checkForError(response);
                    if (errorCheck) {
                        return reject(errorCheck);
                    } 
                    
                    resolve(response);
                }
            );
        });
    },

    getWebjobLog: function (targetUrl) {
        return new Promise(function (resolve, reject) {
            var errorCheck;

            request.get(targetUrl, {'auth': config.auth()},
                function (error, response, body) {
                    if (error) {
                        debug('Get Webjob Log Error: ', error);
                        reject(error);
                    }

                    debug('Get Webjob Log Response: ', response);
                    debug('Get Webjob Log Body: ', body);

                    errorCheck = filesfolders.checkForError(response);
                    if (errorCheck) {
                        return reject(errorCheck);
                    } 

                    resolve(body);
                }
            );
        });
    }, 

    triggerWebjob: function (name) {
        return new Promise(function (resolve, reject) {
            var targetUrl = config.website + '/api/triggeredwebjobs/' + name + '/run',
                errorCheck;

            debug('Triggering Webjob ' + name);

            request.post(targetUrl, {'auth': config.auth()}, 
                function (error, response, body) {
                    if (error) {
                        debug('Trigger Error: ', error);
                        reject(error);
                    }

                    debug('Trigger Response: ', response);
                    debug('Trigger Body: ', body);

                    errorCheck = filesfolders.checkForError(response);
                    if (errorCheck) {
                        return reject(errorCheck);
                    }

                    resolve(response);
                }
            );
        });
    },

    checkForError: function (response) {
        // Azure shouldn't return HTML, so something is up
        response = (response[0] && response[0].headers) ? response[0] : response;

        if (response.headers && response.headers['content-type'] && response.headers['content-type'] === 'text/html') {
            debug('Azure returned text/html, checking for errors');

            if (response.body && response.body.indexOf('401 - Unauthorized') > -1) {
                return 'Invalid Credentials: The Azure Website rejected the given username or password.';
            }
        }

        return false;
    }
};

module.exports = filesfolders;