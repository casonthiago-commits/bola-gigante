const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(path.join(__dirname, 'public')));

let salas = {};

function criarEstado(){
  return {
    bola: { x: 400, y: 300, vx: 0, vy: 0 },
    placar: { azul: 0, vermelho: 0 },
    tempo: 120, // 2 minutos
    jogando: false,
    jogadores: []
  };
}

io.on('connection', (socket) => {
  socket.on('criar_sala', ({ nome }) => {
    const codigo = Math.floor(1000 + Math.random() * 9000).toString();
    salas[codigo] = criarEstado();
    salas[codigo].professor = socket.id;
    socket.join(codigo);
    socket.emit('sala_criada', { codigo });
  });

  socket.on('entrar_sala', ({ nome, codigo, personagem, time }) => {
    if (!salas[codigo]) return socket.emit('erro', 'Sala não encontrada!');
    socket.join(codigo);
    socket.data.codigo = codigo;
    salas[codigo].jogadores.push({ id: socket.id, nome, personagem, time, x: time==='azul'?100:700, y: 200+Math.random()*200 });
    io.to(codigo).emit('atualizar', salas[codigo]);
  });

  socket.on('mover', ({ codigo, x, y }) => {
    const sala = salas[codigo]; if(!sala) return;
    const j = sala.jogadores.find(p=>p.id===socket.id); if(!j) return;
    j.x=x; j.y=y;
    // EMPURRAR A BOLA
    const dx = sala.bola.x - j.x, dy = sala.bola.y - j.y;
    const dist = Math.sqrt(dx*dx+dy*dy);
    if(dist < 70){
      sala.bola.vx += (dx/dist)*3;
      sala.bola.vy += (dy/dist)*3;
    }
  });

  socket.on('iniciar_jogo', ({ codigo }) => {
    const sala = salas[codigo]; if(!sala) return;
    sala.jogando = true; sala.tempo = 120; sala.placar={azul:0,vermelho:0};
    sala.bola={x:400,y:300,vx:0,vy:0};
    io.to(codigo).emit('atualizar', sala);
  });

  socket.on('disconnect', ()=>{
    const codigo = socket.data.codigo; if(!codigo || !salas[codigo]) return;
    salas[codigo].jogadores = salas[codigo].jogadores.filter(p=>p.id!==socket.id);
    io.to(codigo).emit('atualizar', salas[codigo]);
  });
});

// LOOP DO JOGO - física da bola, gol e tempo
setInterval(()=>{
  setInterval(()=>{
  for(let codigo in salas){
    let s=salas[codigo];
    if(!s.jogando) continue;

    // JOGADORES - trava dentro do campo
    for(let id in s.jogadores){
      let j=s.jogadores[id];
      if(j.x<20) j.x=20;
      if(j.x>780) j.x=780;
      if(j.y<20) j.y=20;
      if(j.y>540) j.y=540;
    }

    // BOLA - empurrão dos jogadores
    for(let id in s.jogadores){
      let j=s.jogadores[id];
      let dx=s.bola.x-j.x, dy=s.bola.y-j.y;
      let d=Math.sqrt(dx*dx+dy*dy);
      if(d<60 && d>0){
        s.bola.vx += dx/d*2.2;
        s.bola.vy += dy/d*2.2;
      }
    }
    s.bola.x+=s.bola.vx;
    s.bola.y+=s.bola.vy;
    s.bola.vx*=0.98; s.bola.vy*=0.98;

    // GOL - só entra se estiver no meio, entre 200 e 360
    let noGol = s.bola.y > 200 && s.bola.y < 360;
    if(s.bola.x < 0 && noGol){ s.placar.vermelho++; s.bola={x:400,y:280,vx:0,vy:0}; }
    if(s.bola.x > 800 && noGol){ s.placar.azul++; s.bola={x:400,y:280,vx:0,vy:0}; }

    // PAREDES - bola bate e volta, menos na boca do gol
    let r=35;
    if(s.bola.y < r){ s.bola.y=r; s.bola.vy=Math.abs(s.bola.vy)*0.6; }
    if(s.bola.y > 560-r){ s.bola.y=560-r; s.bola.vy=-Math.abs(s.bola.vy)*0.6; }
    if(s.bola.x < r && !noGol){ s.bola.x=r; s.bola.vx=Math.abs(s.bola.vx)*0.6; }
    if(s.bola.x > 800-r && !noGol){ s.bola.x=800-r; s.bola.vx=-Math.abs(s.bola.vx)*0.6; }

    // TEMPO
    if(!s.contador) s.contador=0;
    s.contador++;
    if(s.contador % 30 === 0){ s.tempo--; }
    if(s.tempo<=0){
      s.jogando=false;
      io.to(codigo).emit('fim',s.placar);
    }
    io.to(codigo).emit('estado',s);
  }
},1000/30);

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>console.log('Rodando '+PORT));
