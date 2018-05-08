let keys = {};
let socket = io();
let canv = document.getElementById('canv');
let tpsread = document.getElementById('tps');
let leaderboard = document.getElementById('leaderboard');
let ctx = canv.getContext('2d');
let hue = Math.random();
let playing = false;
let package = null;
let players = {};
let cx = null;
let cy = null;

$('#name').keyup(function(e){
    if(e.keyCode === 13){
        enterGame();
    }
});


window.onkeydown = function(e){
    keys[e.keyCode] = true;
};
window.onkeyup = function(e){
    if(e.keyCode === 27){
        e.preventDefault();
        socket.emit('suicide');
    }
    delete keys[e.keyCode];
}
canv.width = window.innerWidth;
canv.height = window.innerHeight;
window.onresize = function(e){
    canv.width = window.innerWidth;
    canv.height = window.innerHeight;
}

window.onblur = function(){
    keys = {};
}
// let t0;
// let tps;
socket.on('package', function(p){
    package = p;

    // tpsread.innerHTML = "TPS: " + (1000/(performance.now()-t0)).toFixed(2);
    // t0 = performance.now();

    let lb = '<b>Leaderboard:</b><br>';
    for(let i = 0; i < package.leaderboard.length; i++){
        lb += (i+1) + '. ' + package.clients[package.leaderboard[i]].name.replace(/</g, '&lt;') + ' (' + package.clients[package.leaderboard[i]].score + ')<br>';
    }
    leaderboard.innerHTML = lb;
});

function tick(){
    
    if(package && package.clients[package.local]){
        socket.emit('keys', keys);


        let ids = [];
        for(let id in package.clients){
            ids.push(id);
            if(!players[id]){
                // create the client side player
                players[id] = package.clients[id];
                console.log('created player')
            } else {
                // update the client side player
                let playersnapshot = Object.assign(players[id], {});
                players[id] = package.clients[id];

                players[id].x = lerp(playersnapshot.x, package.clients[id].x, 1);
                players[id].y = lerp(playersnapshot.y, package.clients[id].y, 1);
                // console.log('updated player');
            }
        }
        for(let id in players){
            if(!ids.includes(id)){
                // remove the client side player
                delete players[id];
            }
        }
    }
    
}

function lerp(a,b,t){
    if(!a){ return b; }
    if(!b){ return a; }
    return a + (b-a) * t;
}
function render(){
    // window.requestAnimationFrame(render);
    
    

    if(package){

        ctx.clearRect(0, 0, canv.width, canv.height);

        if(players[package.local]){
            cx = lerp(cx, players[package.local].x, 0.05);
            cy = lerp(cy, players[package.local].y, 0.05);
        }

        ctx.save();
        ctx.translate(window.innerWidth/2-cx, window.innerHeight/2-cy);
        drawGrid();
        
        for(let id in players){
            let client = players[id];
            drawPlayer(client.x, client.y, Math.cos(client.angle / (180/Math.PI)), Math.sin(client.angle / (180/Math.PI)), client.name, client.cooldown == 0, client.hue);
        }
        for(let i = 0; i < package.projectiles.length; i++){
            let projectile = package.projectiles[i];
            drawProjectile(projectile.x, projectile.y, projectile.owner.hue);
        }
       
        ctx.restore();
        if(keys[77]){
        drawMap();
        }
    }
}

function drawGrid(){
    let gridColor = '#eee';
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 4;
    ctx.lineCap = 'square';
    ctx.beginPath();
    for(let i = 0; i <= 32; i++){
        ctx.moveTo(-1024, i*64-1024);
        ctx.lineTo(1024, i*64-1024);
    }
    for(let j = 0; j <= 32; j++){
        ctx.moveTo(j*64-1024, -1024);
        ctx.lineTo(j*64-1024, 1024);
    }
    ctx.stroke();
    ctx.closePath();
}

function drawProjectile(x, y, hue){
    hue *= 360;

    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.fillStyle = `hsl(${hue}, 75%, 60%)`;
    ctx.strokeStyle = `hsl(${hue}, 75%, 50%)`;
    ctx.moveTo(x+16, y);
    ctx.arc(x, y, 16, 0, 360);
    ctx.fill();
    ctx.stroke();
    ctx.closePath();
}

function drawMap(){
    let mapSize = 256;
    let worldSize = 2048;
    let mapLeft = window.innerWidth - mapSize;
    let mapTop = window.innerHeight - mapSize;
    ctx.fillStyle = '#eeeeee';
    ctx.fillRect(mapLeft, mapTop, mapSize, mapSize);
    for(let id in players){
        let client = players[id];
        let mapX = (mapSize/worldSize)*(client.x + 1024);
        let mapY = (mapSize/worldSize)*(client.y + 1024);
        if(mapX >= 0 && mapX < mapSize && mapY >= 0 && mapY < mapSize){
            ctx.beginPath()
            ctx.fillStyle = `hsl(${client.hue * 360}, 75%, 60%)`;
            ctx.arc(mapLeft + mapX, mapTop + mapY, 2, 0, 360);
            ctx.fill();
            ctx.closePath();
        }
    }   
    for(let i = 0; i < package.projectiles.length; i++){
        let projectile = package.projectiles[i];
        let mapX = (mapSize/worldSize)*(projectile.x + 1024);
        let mapY = (mapSize/worldSize)*(projectile.y + 1024);
        if(mapX >= 0 && mapX < mapSize && mapY >= 0 && mapY < mapSize){
            ctx.beginPath()
            ctx.fillStyle = `hsl(${projectile.owner.hue * 360}, 75%, 60%)`;
            ctx.arc(mapLeft + mapX, mapTop + mapY, 1, 0, 360);
            ctx.fill();
            ctx.closePath();
        }
    } 
}

function drawPlayer(x, y, dx, dy, name, projectile, hue){
    hue *= 360;
    // normalize direction vector
    let scl = 1/Math.hypot(dx, dy);
    dx *= scl;
    dy *= scl;

    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.fillStyle = `hsl(${hue}, 75%, 60%)`;
    ctx.strokeStyle = `hsl(${hue}, 75%, 50%)`;

    ctx.arc(x, y, 32, 0, 360);
    if(projectile){
        ctx.moveTo(x+dx*80+16, y+dy*80);
        ctx.arc(x+dx*80, y+dy*80, 16, 0, 360);
    }
    ctx.fill();

    ctx.moveTo(x+dx*32, y+dy*32);
    ctx.lineTo(x+dx*64, y+dy*64);
    ctx.stroke();
    ctx.closePath();

    // draw player name
    ctx.font = '18px Arial'
    ctx.miterLimit = 2;
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.strokeStyle = 'black';
    ctx.fillStyle = 'white';
    ctx.strokeText(name, x, y);
    ctx.fillText(name, x, y);
}


window.setInterval(function(){
    tick();
    render();
}, 1000/60);
function enterGame(){
    let name = document.getElementById('name').value;
    if(name.length > 0){
        socket.emit('enter-game', {name: name});
        $('.gameui').fadeIn();
        $('.modal').fadeOut();
    }
}

socket.on('death', function(){
    $('.modal').fadeIn();
    $('.gameui').fadeOut();
    $('#name').focus();
});