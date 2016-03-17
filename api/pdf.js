var express = require('express');
var fs = require('fs');
var multipart = require('connect-multiparty');
var path = require('path');
var multipartMiddleware = multipart();
var router = express.Router();
var crypto = require('crypto');
var app = require('../app.js');
var io = require('socket.io')(app);

var pdfRooms = [];
var passwords = [];


router.post('/pdf/:path', multipartMiddleware, function(req, res, next) {
    fs.readFile(req.files.file.path, function(err, data) {
        var nam = req.files.file.name.split('.');
        nam.pop();
        nam = nam.join('.');
        var password = makepassword();
        if (!fs.existsSync('pdfs/' + req.params.path)) {
            fs.mkdirSync('pdfs/' + req.params.path);
        }
        fs.writeFile('pdfs/' + req.params.path + '/' + encodeURIComponent(req.files.file.name), data, function(err) {
            passwords[req.params.path + encodeURIComponent(nam)] = password;
            res.send({ status: 'ok', path: 'pdf/' + req.params.path + '/' + encodeURIComponent(nam), password: password });
        });
    });
});

router.delete('/pdf/:path/:id', function(req, res, next) {
    if (req.params.password == passwords[req.params.path + encodeURIComponent(req.params.id)]) {
        deleteFile('pdfs/' + req.params.path + '/' + req.params.id + '.pdf', function(result) {
            res.send(result);
        });
    } else {
        res.send('not authorized');
    }
});

router.get('/list/pdf/:path', function(req, res, next) {
    if (fs.existsSync('pdfs/' + req.params.path)) {
        var response = { files: [] };
        fs.readdirSync('pdfs/' + req.params.path).forEach(function(file, index) {
            response.files.push({
                name: decodeURIComponent(file),
                link: encodeURIComponent('pdf/' + req.params.path + '/' + file)
            });
        });
        res.send(response);
    } else {
        res.send('not found');
    }
});

router.get('/pdf/:path/:id', function(req, res, next) {
    res.contentType("application/pdf");
    fs.createReadStream('pdfs/' + req.params.path + '/' + encodeURIComponent(req.params.id) + '.pdf').pipe(res);
});

router.get('/view/pdf/:path/:id/', function(req, res, next) {
    res.render('visor.jade', { pdf: req.params.path + '/' + encodeURIComponent(req.params.id) });
});

router.get('/view/pdf/:path/:id/:password', function(req, res, next) {
    if (req.params.password == passwords[req.params.path + encodeURIComponent(req.params.id)]) {
        res.render('visorAdmin.jade', { pdf: req.params.path + '/' + encodeURIComponent(req.params.id) });
    } else {
        res.send('not authorized');
    }
});

function generateHash() {
    var current_date = (new Date()).valueOf().toString();
    var random = Math.random().toString();
    return crypto.createHash('sha1').update(current_date + random).digest('hex');
}

function deleteFile(file, cb) {
    fs.unlink(file, function(err) {
        if (err) {
            console.log(err);
            if (cb) {
                cb('ko');
            }
        } else {
            if (cb) {
                cb('ok');
            }
        }
    });
}

function makepassword() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < 5; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

function deleteOldPdf(now) {
    fs.readdir('pdfs', function(err, folders) {
        if (err) {
            console.log(err);
        }
        folders.forEach(function(folder) {
            fs.readdir('pdfs/' + folder, function(err, files) {
                if (err) {
                    console.log(err);
                }
                files.forEach(function(filename) {
                    fs.stat('pdfs/' + folder + '/' + filename, function(err, stat) {
                        var endTime, now;
                        if (err) {
                            console.log(err);
                        }
                        now = new Date().getTime();
                        endTime = new Date(stat.ctime).getTime() + 7200000;
                        if (now > endTime || now) {
                            deleteFile('pdfs/' + folder + '/' + filename);
                        }
                    });
                });
            });
            setTimeout(function() {
                try {
                    fs.rmdirSync('pdfs/' + folder);
                } catch (e) {

                }
            }, 2000);
        });
    });
}
setTimeout(function() {
    deleteOldPdf();
}, 120000);
deleteOldPdf(true);



io.on('connection', function(socket) {
    socket.on('pdf:new', function(data) {
        if (pdfRooms[data.pdf]) {
            pdfRooms[data.pdf]['master'] = socket;
        } else {
            pdfRooms[data.pdf] = [];
            pdfRooms[data.pdf]['page'] = 1;
            pdfRooms[data.pdf]['master'] = socket;
        }
    });

    socket.on('pdf:change', function(data) {
        if (socket == pdfRooms[data.pdf]['master']) {
            pdfRooms[data.pdf]['page'] = data.page;
            pdfRooms[data.pdf].forEach(function(s) {
                try {
                    s.emit('pdf:page', { page: data.page });
                } catch (e) {
                    console.log(e);
                }
            });
        }
    });

    socket.on('pdf:listen', function(data) {
        if (pdfRooms[data.pdf]) {
            pdfRooms[data.pdf].push(socket);
            setTimeout(function() {
                socket.emit('pdf:page', { page: pdfRooms[data.pdf]['page'] });
            }, 1000);
        } else {
            pdfRooms[data.pdf] = [];
            pdfRooms[data.pdf]['page'] = 1;
            pdfRooms[data.pdf].push(socket);
            setTimeout(function() {
                socket.emit('pdf:page', { page: pdfRooms[data.pdf]['page'] });
            }, 1000);
        }
    });
});



module.exports = router;