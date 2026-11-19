/* fx.js: Эффекты на фоне (сакура, снег…), звук и вибрация. */

let fxRaf=0,P=[],cv,cx,trail=[],au;

function setFx(k,v){FX()[k]=v;saveCustom();fxStart();}

function fxSync(){const f=FX();$('fxType').value=f.type;$('fxN').value=f.n;$('fxS').value=f.speed;$('fxTrail').checked=!!f.trail;$('fxSound').checked=!!f.sound;}

function mk(init){const W=cv.width,H=cv.height;return{x:Math.random()*W,y:init||['stars','fireflies'].includes(FX().type)?Math.random()*H:(FX().type==='hearts'?H+20:-20),r:2+Math.random()*4,v:.5+Math.random(),ph:Math.random()*6.28};}

function fxStart(){
  cancelAnimationFrame(fxRaf);cv=$('fxCanvas');cx=cv.getContext('2d');cv.width=innerWidth;cv.height=innerHeight;P=[];
  const f=FX();cx.clearRect(0,0,cv.width,cv.height);
  if(matchMedia('(prefers-reduced-motion:reduce)').matches||(f.type==='none'&&!f.trail))return;
  if(f.type!=='none')for(let i=0;i<f.n;i++)P.push(mk(true));
  (function loop(){
    fxRaf=requestAnimationFrame(loop);if(document.hidden)return;
    const W=cv.width,H=cv.height,s=FX().speed,t=FX().type;cx.clearRect(0,0,W,H);
    for(const p of P){
      p.ph+=.02*s;
      if(t==='snow'){p.y+=p.v*s;p.x+=Math.sin(p.ph)*.5;cx.fillStyle='rgba(255,255,255,.8)';cx.beginPath();cx.arc(p.x,p.y,p.r*.6,0,7);cx.fill();}
      else if(t==='sakura'){p.y+=p.v*s*.8;p.x+=Math.sin(p.ph)*1.2*s;cx.fillStyle='rgba(255,170,205,.8)';cx.beginPath();cx.ellipse(p.x,p.y,p.r*1.6,p.r*.8,p.ph,0,7);cx.fill();}
      else if(t==='hearts'){p.y-=p.v*s*.7;p.x+=Math.sin(p.ph)*.6;cx.fillStyle='rgba(255,105,160,.75)';cx.font=(p.r*4)+'px sans-serif';cx.fillText('♥',p.x,p.y);}
      else if(t==='stars'){cx.fillStyle=`rgba(255,255,255,${.25+.75*Math.abs(Math.sin(p.ph*2))})`;cx.beginPath();cx.arc(p.x,p.y,p.r*.5,0,7);cx.fill();}
      else if(t==='fireflies'){p.x+=Math.cos(p.ph)*.4*s;p.y+=Math.sin(p.ph*1.3)*.4*s;const g=cx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*4);const a=.3+.5*Math.abs(Math.sin(p.ph*2));g.addColorStop(0,`rgba(255,240,120,${a})`);g.addColorStop(1,'rgba(255,240,120,0)');cx.fillStyle=g;cx.fillRect(p.x-p.r*4,p.y-p.r*4,p.r*8,p.r*8);}
      if(p.y>H+30||p.y<-30||p.x<-30||p.x>W+30)Object.assign(p,mk(false));
    }
    if(FX().trail){trail=trail.filter(m=>(m.l-=.03)>0);trail.forEach(m=>{cx.fillStyle=`hsla(${m.h},90%,60%,${m.l})`;cx.beginPath();cx.arc(m.x,m.y,6*m.l,0,7);cx.fill();});}
  })();
}

addEventListener('pointermove',e=>{if(FX().trail){trail.push({x:e.clientX,y:e.clientY,l:1,h:Date.now()/8%360});if(trail.length>45)trail.shift();}});

addEventListener('resize',()=>{if(cv){cv.width=innerWidth;cv.height=innerHeight;}});

function playBeep(){if(!FX().sound)return;try{au=au||new AudioContext();const o=au.createOscillator(),g=au.createGain();o.frequency.value=660;g.gain.setValueAtTime(.08,au.currentTime);g.gain.exponentialRampToValueAtTime(.001,au.currentTime+.15);o.connect(g);g.connect(au.destination);o.start();o.stop(au.currentTime+.15);}catch(e){}}

function beep(){if(U().vib&&navigator.vibrate)navigator.vibrate(12);playBeep();}
