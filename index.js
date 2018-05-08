const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);


// routes
app.get('/', function(req, res){
    res.sendFile(__dirname + '/public/index.html');
});
app.use(express.static(__dirname + '/public'));

// socket stuff
let sockets = {};
let projectiles = [];

io.on('connection', function(socket){
    socket.dead = true;
    socket.on('enter-game', function(data){
        if(!socket.dead){
            return;
        }
        // create the socket
        let id = socket.id;
        socket.dead = false;

        // position
        socket.x = Math.floor(Math.random()*2000)-1000;
        socket.y = Math.floor(Math.random()*2000)-1000;

        // rotation
        socket.angle = 0;
        socket.angularVelocity = 1;

        // display
        socket.name = data.name;
        socket.hue = Math.random();
        socket.score = 0;

        // projectiles
        socket.projectileRespawnTime = 2 * 60;
        socket.projectileCooldown = 0;

        socket.keys = {}
        sockets[id] = socket;

        console.log(`${data.name} joined`);

        socket.on('keys', function(k){
            socket.keys = k;
        });
        socket.on('suicide', function(){
            socket.dead = true;
            socket.emit('death', {killer: 'self'});
        });
        socket.on('disconnect', function(data){
            // remove the socket
            console.log(`${socket.name} left`);
            delete sockets[id];
        });

    });

});

// tick function
function tick(){
    // update each socket
    for(let id in sockets){
        let socket = sockets[id];
        if(socket.dead){
            continue;
        }

        if(socket.projectileCooldown > 0){
            sockets[id].projectileCooldown--;
        }

        let vx = 0;
        let vy = 0;

        // movement
        if(socket.keys[87]){
            vy -= 1;
        }
        if(socket.keys[83]){
            vy += 1;
        }
        if(socket.keys[65]){
            vx -= 1;
        }
        if(socket.keys[68]){
            vx += 1;
        }

        let dist = Math.hypot(vx, vy);
        if(dist > 0){
            let scl = 5/dist;
            vx *= scl;
            vy *= scl;
            if(Math.abs(socket.x + vx) <= 1024){
                sockets[id].x += vx;
            }
            if(Math.abs(socket.y + vy) <= 1024){
                sockets[id].y += vy;
            }
        }
        

        // rotation
        let delta = 6 * socket.angularVelocity;
        sockets[id].angle += delta;
        sockets[id].angle %= 360;

        // firing
        if(socket.keys[32] && socket.projectileCooldown == 0){
            sockets[id].projectileCooldown = socket.projectileRespawnTime;
            let a = socket.angle + 90;
            let v = 8.37 * socket.angularVelocity;
            a %= 360;
            let projectile = {
                x: socket.x + 80 * Math.cos(socket.angle / (180/Math.PI)),
                y: socket.y + 80 * Math.sin(socket.angle / (180/Math.PI)),
                vx: v * Math.cos(a / (180/Math.PI)) + vx,
                vy: v * Math.sin(a / (180/Math.PI)) + vy,
                owner: {
                    id: id,
                    name: socket.name,
                    hue: socket.hue
                }
            }
            projectiles.push(projectile);
        }
    }

    // update projectiles
    for(let i = 0; i < projectiles.length; i++){
        let projectile = projectiles[i];

        if(Math.hypot(projectiles[i].x, projectiles[i].y) > 4096){
            projectiles[i].despawn = true;
            continue;
        }

        projectiles[i].x += projectile.vx;
        projectiles[i].y += projectile.vy;
        
        for(let id in sockets){
            socket = sockets[id];

            if(Math.hypot(socket.x-projectile.x, socket.y-projectile.y) <= 48 && id !== projectile.owner.id && !socket.dead){
                // projectile hit socket
                console.log(`${projectile.owner.name} -> ${socket.name}`);
                if(sockets[projectile.owner.id]){
                    let ownersocket = sockets[projectile.owner.id];
                    sockets[projectile.owner.id].score++;
                    ownersocket.emit('kill', {victim: socket.name});
                }
                socket.emit('death', {killer: projectile.owner.name});
                socket.dead = true;
                projectile.despawn = true;
            }

        }

    }

    // remove projectiles
    for(let i = projectiles.length-1; i >= 0; i--){
        if(projectiles[i].despawn){
            projectiles.splice(i,1);
            console.log('Removed projectile');
        }
    }

    // calculate leaderboard
    let ids = Object.keys(sockets);
    ids.sort(function(a, b){
        return sockets[b].score-sockets[a].score;
    });
    for(let i = 0; i < ids.length; i++){
        if(sockets[ids[i]].dead){
            ids.splice(i,1);
        }
    }
    let leaderboard = ids.slice(0,10);


    // send data package to clients
    let package = {
        clients: {},
        projectiles: projectiles,
        leaderboard: leaderboard
    };
    for(let id in sockets){
        let socket = sockets[id];
        if(socket.dead){
            continue;
        }
        package.clients[id] = {
            x: socket.x,
            y: socket.y,
            angle: socket.angle,
            angularVelocity: socket.angularVelocity,
            name: socket.name,
            hue: socket.hue,
            score: socket.score,
            cooldown: socket.projectileCooldown,
        }
    }
    for(let id in sockets){
        package.local = id;
        sockets[id].emit('package', package);
    }
}

// start server
server.listen(process.argv[2], function(){
    console.log('Started server');
    setInterval(tick, 1000/60);
});