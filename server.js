const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
app.use(express.static('public'));
let salas = {};

function enviar(codigo){
  let s = salas[codigo];
  if(!s) return;
  io.to(codigo).emit('atualizar', { placar: s.placar, tempo: s.tempo, bola: s.bola, jogadores: Object.values(s.jogadores) });
}

io.on('connection', (socket)=>{
  socket.on('criar_sala', ()=>{
    let codigo = Math.floor(1000+Math.random()*9000).toString();
    salas[codigo]={jogadores:{},bola:{x:400,y:280,vx:0,vy:0},placar:{azul:0,vermelho:0},tempo:120,jogando:false,contador:0};
    socket.join(codigo);
    socket.emit('sala_criada',{codigo});
  });
  socket.on('entrar_sala', (d)=>{
    let s=salas[d.codigo];
    if(!s){ socket.emit('erro','Sala não encontrada'); return; }
    socket.join(d.codigo);
    s.jogadores[socket.id]={nome:d.nome, personagem:d.personagem||'🦊', time:d.time||'azul', x: d.time==='azul'?200:600, y:280+Math.random()*80 };
    enviar(d.codigo);
  });
  socket.on('mover', (d)=>{
    let s=salas[d.codigo];
    if(s && s.jogadores[socket.id]){ s.jogadores[socket.id].x=d.x; s.jogadores[socket.id].y=d.y; }
  });
  socket.on('iniciar_jogo', (d)=>{
    let codigo = typeof d === 'string' ? d : d.codigo;
    let s=salas[codigo];
    if(s){ s.jogando=true; s.tempo=120; s.contador=0; s.placar={azul:0,vermelho:0}; s.bola={x:400,y:280,vx:0,vy:0}; enviar(codigo); }
  });
  socket.on('disconnect', ()=>{
    for(let c in salas){ if(salas[c].jogadores[socket.id]){ delete salas[c].jogadores[socket.id]; enviar(c); } }
  });
});

setInterval(()=>{
  for(let codigo in salas){
    let s=salas[codigo];
    if(!s.jogando) continue;
    for(let id in s.jogadores){
      let j=s.jogadores[id];
      j.x=Math.max(20,Math.min(780,j.x));
      j.y=Math.max(20,Math.min(540,j.y));
      let dx=s.bola.x-j.x, dy=s.bola.y-j.y;
      let d=Math.sqrt(dx*dx+dy*dy);
      if(d<70 && d>0){ s.bola.vx+=dx/d*3; s.bola.vy+=dy/d*3; }
    }
    s.bola.x+=s.bola.vx; s.bola.y+=s.bola.vy;
    s.bola.vx*=0.97; s.bola.vy*=0.97;
    let noGol = s.bola.y>200 && s.bola.y<360;
    // GOL - atravessou a linha
    if(s.bola.x<15 && noGol){ s.placar.vermelho++; s.bola={x:400,y:280,vx:0,vy:0}; io.to(codigo).emit('gol','GOOOL DO VERMELHO! 🔴'); enviar(codigo); continue; }
    if(s.bola.x>785 && noGol){ s.placar.azul++; s.bola={x:400,y:280,vx:0,vy:0}; io.to(codigo).emit('gol','GOOOL DO AZUL! 🔵'); enviar(codigo); continue; }
    // PAREDES - rebate, nunca some
    if(s.bola.y<35){ s.bola.y=35; s.bola.vy=Math.abs(s.bola.vy)*0.7; }
    if(s.bola.y>525){ s.bola.y=525; s.bola.vy=-Math.abs(s.bola.vy)*0.7; }
    if(s.bola.x<35 && !noGol){ s.bola.x=35; s.bola.vx=Math.abs(s.bola.vx)*0.7; }
    if(s.bola.x>765 && !noGol){ s.bola.x=765; s.bola.vx=-Math.abs(s.bola.vx)*0.7; }
    // Segurança: se escapar, volta pro meio
    if(s.bola.x<-50||s.bola.x>850||s.bola.y<-50||s.bola.y>610){ s.bola={x:400,y:280,vx:0,vy:0}; }
    s.contador++;
    if(s.contador%30===0){ s.tempo--; }
    if(s.tempo<=0){ s.jogando=false; io.to(codigo).emit('fim',s.placar); }
    enviar(codigo);
  }
},1000/30);
http.listen(process.env.PORT||3000, ()=> console.log('Rodando'));
