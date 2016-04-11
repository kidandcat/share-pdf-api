var form = new Vue({
    el: '#form',
    data: {
        user: document.querySelector('#data').getAttribute('data-user'),
        password: document.querySelector('#data').getAttribute('data-pass'),
        actualFolder: '',
        list: false,
        defList: []
    },
    methods: {
        getList: function(folder) {
            this.load(true);
            var self = this;
            var back = false;
            // /pdf/vdrive/list/username/password/folder1:folder2||nothing for root
            if (this.user != '' && this.password != '') {
                if(folder == '..'){
                    var x = self.actualFolder.split('*');
                    x.pop()
                    self.actualFolder = x.join('*');
                    folder = x[x.length-1];
                    back = true;
                }
                Vue.http.get('/pdf/vdrive/list/' + 
                this.user + '/' + 
                this.password + '/' + 
                (this.actualFolder != '' && !back?this.actualFolder + '*':'') + 
                (folder || '')).then(function(res) {
                    self.actualFolder += (folder && !back)?'*' + folder:'';
                    self.list = res.data;
                    self.load(false);
                    self.defList = [];
                    self.defList.push({
                        name: '..',
                        isDir: true
                    });
                    self.list.forEach(function(f){
                        self.stat((self.actualFolder != ''?self.actualFolder + '*':'') + f.name, f);
                    });
                }, function(err) {
                    console.log(err);
                });
            }
        },
        stat: function(file, f){
            var self = this;
            Vue.http.get('/pdf/vdrive/stat/' + this.user + '/' + this.password + '/' + encodeURIComponent(file)).then(function(res) {
                f.isFile = res.data.isFile;
                f.isDir = res.data.isDir;
                f.time = res.data.time;
                self.defList.push({
                    link: f.link,
                    name: f.name,
                    isFile: f.isFile,
                    isDir: f.isDir,
                    time: f.time
                });
            }, function(err) {
                console.log(err);
            });
        },
        import: function(link) {
            var ln = link.split(':path').join(document.querySelector('#room').value);
            Vue.http.get(ln).then(function(res) {
                window.opener.postMessage(JSON.stringify(res), '*');
                window.close();
            }, function(err) {
                console.log(err);
            });
        },
        load: function(yes) {
            if (yes) {
                var load = document.getElementById('loader');
                var spin = document.getElementById('spinner');
                load.classList.remove('hide');
                spin.classList.remove('hide');
                spin.classList.add('loader');
                load.classList.add('black');
            } else {
                var load = document.getElementById('loader');
                var spin = document.getElementById('spinner');
                load.classList.add('hide');
                spin.classList.add('hide');
                spin.classList.remove('loader');
                load.classList.remove('black');
            }
        }
    }
});

form.getList();