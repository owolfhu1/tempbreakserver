const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const port = process.env.PORT || 4003;
const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const Game = require('./game');

const lobby = {};
const users = {};
const games = {};
const gamePlayers = {};

const shuffle = a => {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

const login = (name, id) => {
    if (!users[name]) {
        lobby[name] = id;
        users[name] = 'lobby';
        io.to(id).emit('page','lobby');
        return true;
    }
    return false;
};

const sendLobby = () => {
    console.log(lobby);
    for (let user in lobby)
        io.to(lobby[user]).emit('lobby', lobby);
};

const chat = (name, msg) => {
    for (let i in lobby)
        io.to(lobby[i]).emit('chat', name + ': ' + msg);
};

const logout = name => {
        if (!name)
            return;
        switch (users[name]) {
            case 'lobby' :
                delete lobby[name];
                sendLobby();
                break;
            case 'game' :
                games[gamePlayers[name]].removePlayer(name);
                if (games[gamePlayers[name]].playersLeft() === 0) {
                    delete games[gamePlayers[name]];
                    clearInterval(gamePlayers[name]);
                }
                delete gamePlayers[name];
                break;
        }
        delete users[name];
};


const makeGame = (player1, player2) => {
    let id1 = lobby[player1];
    delete lobby[player1];
    let id2 = lobby[player2];
    delete lobby[player2];
    users[player1] = 'game';
    users[player2] = 'game';
    sendLobby();
    let game = new Game();
    let gameId = setInterval(() => {
        let data = game.getNextFrame();
        for (let player in data.players)
            io.to(gamePlayers[player].id).emit('new_frame', data);
        //todo: check for game ending conditions, and end game here
    }, 20);
    games[gameId] = game;
    gamePlayers[player1] = {gameId,id:id1};
    gamePlayers[player2] = {gameId,id:id2};
    io.to(id1).emit('page','game');
    io.to(id2).emit('page','game');
    game.addPlayer(player1);
    game.addPlayer(player2);
};

io.on('connection', socket => {
    const id = socket.id;
    let name;

    console.log(`connected: ${id}`);

    socket.on('console',console.log);

    socket.on('login',username => {
        if(login(username,id)) {
            name = username;
            sendLobby();
        }
    });

    socket.on('get_name', () => socket.emit('get_name', name));

    socket.on('chat', msg => {
        chat(name,msg);
    });

    socket.on('request', username => io.to(lobby[username]).emit('request', name));

    socket.on('accept', username => {
       if (username in lobby) {
           makeGame(name,username)
       } //else todo
    });

    socket.on('stop_start', () => games[gamePlayers[name]].startStop(name));

    socket.on('move', dir => games[gamePlayers[name]].move(name,dir));

    socket.on('jump', () => games[gamePlayers[name]].jump(name));

    socket.on('stay', dir => games[gamePlayers[name]].stay(name,dir));

    socket.on('disconnect', () => logout(name));

});



server.listen(port, () => console.log`listening on ${port}`);
