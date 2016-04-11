var express = require('express');
var fs = require('fs');
var multipart = require('connect-multiparty');
var path = require('path');
var multipartMiddleware = multipart();
var router = express.Router();
var http = require('http');
var https = require('https')
var request = require('request');
var crypto = require('crypto');
var app = require('../app.js');
var io = require('socket.io')(app);

var pdfRooms = [];
var passwords = [];



router.get('/pdf/vdrive/:user/:pass', function(req, res, next) {
    //res.sendFile(path.join(process.cwd(), 'public', 'vdrive.html'));
    res.render('vdrive.jade', { user: req.params.user, pass: atob(req.params.pass) });
});

router.get('/pdf/vdrive/list/:user/:pass', pdf_vdrive_list_user_pass__dir);

router.get('/pdf/vdrive/list/:user/:pass/:dir', pdf_vdrive_list_user_pass__dir);

//folder1*folder2*filename
function pdf_vdrive_list_user_pass__dir(req, res, next) {
    var wfs = require("webdav-fs")(
        'https://vdrive.netelip.com/remote.php/webdav/',
        req.params.user,
        req.params.pass
    );


    if (req.params.dir) {
        req.params.dir = req.params.dir.split('*').join('/');
    }


    wfs.readdir('/' + (req.params.dir || ''), function(err, contents) {
        if (!err) {
            var items = [];
            contents.forEach(function(f) {
                var obj = {};
                obj.name = f;
                obj.link = '/pdf/import/:path/' + encodeURIComponent('https://vdrive.netelip.com/remote.php/webdav/' + f) + '/' + req.params.user + '/' + req.params.pass;
                items.push(obj);
            });
            res.send(items);
        } else {
            res.send(err.message);
        }
    });
}

//folder1*folder2*filename
router.get('/pdf/vdrive/stat/:user/:pass/:path', function(req, res, next) {
    var wfs = require("webdav-fs")(
        'https://vdrive.netelip.com/remote.php/webdav/',
        req.params.user,
        req.params.pass
    );
    req.params.path = req.params.path.split('*');
    req.params.path.forEach(function(el) {
        req.params.path[req.params.path.indexOf(el)] = encodeURIComponent(el);
    });
    req.params.path = req.params.path.join('/');
    wfs.stat('/' + req.params.path, function(error, fileStat) {
        if (!error) {
            res.send({
                isFile: fileStat.isFile(),
                isDir: fileStat.isDirectory(),
                time: fileStat.mtime
            });
        } else {
            console.log(error);
        }
    });
});

router.get('/pdf/import/:path/:url/:user/:pass', function(req, res, next) {
    console.log('sala1');
    var url = req.params.url;
    var user = req.params.user;
    var pass = req.params.pass;
    var name = url.split('/');
    var password = makepassword();
    var filename = name[name.length - 1];

    if (!fs.existsSync('pdfs/' + req.params.path)) {
        fs.mkdirSync('pdfs/' + req.params.path);
    }
    request.get(url).auth(user, pass, false).pipe(fs.createWriteStream('pdfs/' + req.params.path + '/' + encodeURIComponent(filename)));
    passwords[req.params.path + encodeURIComponent(filename)] = password;
    res.send({ status: 'ok', path: 'pdf/' + req.params.path + '/' + encodeURIComponent(filename), password: password });
});

router.get('/pdf/import/:path/:url/', function(req, res, next) {
    console.log('sala1');
    var url = req.params.url;
    var user = req.params.user;
    var pass = req.params.pass;
    var name = url.split('/');
    var password = makepassword();
    var filename = name[name.length - 1];

    if (!fs.existsSync('pdfs/' + req.params.path)) {
        fs.mkdirSync('pdfs/' + req.params.path);
    }
    if (!user && !pass) {
        request.get(url).pipe(fs.createWriteStream('pdfs/' + req.params.path + '/' + encodeURIComponent(filename)));
        passwords[req.params.path + encodeURIComponent(filename)] = password;
        res.send({ status: 'ok', path: 'pdf/' + req.params.path + '/' + encodeURIComponent(filename), password: password });
    }
});

router.post('/pdf/:path', multipartMiddleware, function(req, res, next) {
    fs.readFile(req.files.file.path, function(err, data) {
        var password = makepassword();
        if (!fs.existsSync('pdfs/' + req.params.path)) {
            fs.mkdirSync('pdfs/' + req.params.path);
        }
        fs.writeFile('pdfs/' + req.params.path + '/' + encodeURIComponent(req.files.file.name), data, function(err) {
            passwords[req.params.path + encodeURIComponent(req.files.file.name)] = password;
            res.send({ status: 'ok', path: 'pdf/' + req.params.path + '/' + encodeURIComponent(req.files.file.name), password: password });
        });
    });
});

router.delete('/pdf/:path/:id/:password', function(req, res, next) {
    if (req.params.password == passwords[req.params.path + encodeURIComponent(req.params.id)]) {
        deleteFile('pdfs/' + req.params.path + '/' + encodeURIComponent(req.params.id), function(result) {
            res.send(result);
        });
    } else {
        res.send('not authorized');
    }
});

router.get('/pdf/list/:path', function(req, res, next) {
    if (fs.existsSync('pdfs/' + req.params.path)) {
        var response = { files: [] };
        fs.readdirSync('pdfs/' + req.params.path).forEach(function(file, index) {
            response.files.push({
                name: decodeURIComponent(file),
                link: 'pdf/' + req.params.path + '/' + file
            });
        });
        res.send(response);
    } else {
        res.send('not found');
    }
});

router.get('/pdf/:path/:id', function(req, res, next) {
    fs.createReadStream('pdfs/' + req.params.path + '/' + encodeURIComponent(req.params.id)).pipe(res);
});

router.get('/pdf/view/:path/:id/', function(req, res, next) {
    res.render('visor.jade', { pdf: req.params.path + '/' + encodeURIComponent(req.params.id) });
});

router.get('/pdf/view/:path/:id/:password', function(req, res, next) {
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

function deleteOldPdf() {
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
                        if (err) {
                            console.log(err);
                        }
                        deleteFile('pdfs/' + folder + '/' + filename);
                    });
                });
            });
            setTimeout(function() {
                try {
                    fs.rmdirSync('pdfs/' + folder);
                } catch (e) {
                    //folder not empty
                }
            }, 2000);
        });
    });
}
deleteOldPdf();



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

    socket.on('pdf:open', function(data) {
        socket.broadcast.to(socket.room).emit('pdf:open', data);
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

    socket.on('pdf:scroll', function(data) {
        if (socket == pdfRooms[data.pdf]['master']) {
            pdfRooms[data.pdf].forEach(function(s) {
                try {
                    s.emit('pdf:scroll', { percentaje: data.percentaje });
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
            }, 3000);
        } else {
            pdfRooms[data.pdf] = [];
            pdfRooms[data.pdf]['page'] = 1;
            pdfRooms[data.pdf].push(socket);
            setTimeout(function() {
                socket.emit('pdf:page', { page: pdfRooms[data.pdf]['page'] });
            }, 3000);
        }
    });

    socket.on('chat:login', function(data) {
        console.log(data);
        socket.nick = data.nick;
        socket.join(data.room);
        socket.room = data.room;
    })

    socket.on('chat:msg', function(data) {
        console.log(data);
        data.nick = socket.nick;
        socket.broadcast.to(socket.room).emit('chat:msg', data);
    })

    socket.on('disconnect', function() {
        if (typeof io.sockets.adapter.rooms[socket.room] == 'undefined') {
            deleteOldPdf();
        }
    });
});



module.exports = router;