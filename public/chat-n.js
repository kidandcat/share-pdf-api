  var template = '<div id="chat">'+
        '<div id="area">'+
            '<template v-for="message in messages">'+
                '<div v-if="message.me" class="msg-block yo">'+
                    '<span class="user">'+
                        '{{ message.user }}'+
                    '</span>'+
                    '<span class="message">'+
                        '{{ message.text }}'+
                    '</span>'+
                '</div>'+
                '<div v-else class="msg-block">'+
                    '<span class="user">'+
                        '{{ message.user }}'+
                    '</span>'+
                    '<span class="message">'+
                        '{{ message.text }}'+
                    '</span>'+
                '</div>'+
            '</template>'+
        '</div>'+
        '<input v-model="newMsg" v-on:keyup.enter="myMsg">'+
        '<!--<button unselectable="on" v-on:click="myMsg">></button>-->'+
    '</div>';

document.querySelector('#chat').innerHTML = template;

var chat = new Vue({
    el: '#chat',
    data: {
        newMsg: '',
        sala: prompt('sala'),
        nick: prompt('nick'),
        messages: [

        ]
    },
    methods: {
        addMsg: function(msg, user, me) {
            this.messages.push({ text: msg, user: user, me: (me)?me:false });
            if(me){
                this.sendMsg(msg);
            }
            setTimeout(function(){document.querySelector('#chat #area').scrollTop = document.querySelector('#chat #area').scrollHeight}, 200);
        },
        sendMsg: function(msg) {
            chatSend(msg);
        },
        myMsg: function() {
            var msg = this.newMsg.trim();
            if (msg) {
                this.addMsg(msg, 'Yo', true);
            }
            this.newMsg = '';
        }
    }
});

var socket = io();


var loggg = setInterval(function(){
    if(chat.nick && chat.sala){
        socket.emit('chat:login', { nick: chat.nick, room: chat.sala });
        pdf.room = chat.sala;
        clearInterval(loggg);
    }
}, 3000);

function chatSend(msg){
    socket.emit('chat:msg', { msg: msg });
}

socket.on('chat:msg', function(data){
    chat.addMsg(data.msg, data.nick, false);
});


