const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
app.use(express.static('public'));
let salas = {};
io.on('connection', (socket)=>{
  socket.on('criar', (d)=>{
    let codigo = Math.floor(1000+Math.random()*9000).toString();
    salas[codigo]={jogadores:{},bola:{x:400,y:280,vx:0,vy:0},placar:{azul:0,vermelho:0},tempo:120,jogando:false,contador:0};
    socket.join(codigo);
    salas[codigo].jogadores[socket.id]={...d,x:200+Math.random()*400,y:200+Math.random()*150};
    socket.emit('salaCriada',codigo);
    io.to(codigo).emit('estado',salas[codigo]);
  });
  socket.on('entrar', (d)=>{
    let s=salas[d.codigo];
    if(!s){ socket.emit('erro','Sala não encontrada'); return; }
    socket.join(d.codigo);
    s.jogadores[socket.id]={...d,x:200+Math.random()*400,y:200+Math.random()*150};
    socket.emit('entrou',d.codigo);
    io.to(d.codigo).emit('estado',s);
  });
  socket.on('mover', (d)=>{
    let s=salas[d.codigo];
    if(s && s.jogadores[socket.id]){ s.jogadores[socket.id].x=d.x; s.jogadores[socket.id].y=d.y; }
  });
  socket.on('iniciar', (codigo)=>{
    let s=salas[codigo];
    if(s){ s.jogando=true; s.tempo=120; s.contador=0; s.placar={azul:0,vermelho:0}; s.bola={x:400,y:280,vx:0,vy:0}; }
  });
  socket.on('disconnect', ()=>{
    for(let c in salas){ delete salas[c].jogadores[socket.id]; }
  });
});
setInterval(()=>{
  for(let codigo in salas){
    let s=salas[codigo];
    if(!s.jogando) continue;
    for(let id in s.jogadores){
      let j=s.jogadores[id];
      if(j.x<20) j.x=20;
      if(j.x>780) j.x=780;
      if(j.y<20) j.y=20;
      if(j.y>540) j.y=540;
    }
    for(let id in s.jogadores){
      let j=s.jogadores[id];
      let dx=s.bola.x-j.x, dy=s.bola.y-j.y;
      let d=Math.sqrt(dx*dx+dy*dy);
      if(d<60 && d>0){ s.bola.vx+=dx/d*2.2; s.bola.vy+=dy/d*2.2; }
    }
    s.bola.x+=s.bola.vx;
    s.bola.y+=s.bola.vy;
    s.bola.vx*=0.98; s.bola.vy*=0.98;
    let noGol = s.bola.y>200 && s.bola.y<360;
    if(s.bola.x<0 && noGol){ s.placar.vermelho++; s.bola={x:400,y:280,vx:0,vy:0}; }
    if(s.bola.x>800 && noGol){ s.placar.azul++; s.bola={x:400,y:280,vx:0,vy:0}; }
    let r=35;
    if(s.bola.y<r){ s.bola.y=r; s.bola.vy=Math.abs(s.bola.vy)*0.6; }
    if(s.bola.y>560-r){ s.bola.y=560-r; s.bola.vy=-Math.abs(s.bola.vy)*0.6; }
    if(s.bola.x<r && !noGol){ s.bola.x=r; s.bola.vx=Math.abs(s.bola.vx)*0.6; }
    if(s.bola.x>800-r && !noGol){ s.bola.x=800-r; s.bola.vx=-Math.abs(s.bola.vx)*0.6; }
    s.contador++;
    if(s.contador%30===0){ s.tempo--; }
    if(s.tempo<=0){ s.jogando=false; io.to(codigo).emit('fim',s.placar); }
    io.to(codigo).emit('estado',s);
  }
},1000/30);
http.listen(process.env.PORT||3000);
