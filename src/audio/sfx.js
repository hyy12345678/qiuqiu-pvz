// Web Audio 实时合成：无音频文件。旋律/贝斯是数据，音色由 tone/mnote 的合成参数决定。

import { rand } from '../core/util.js';

const NOTE = { A2:110, C3:130.81, D3:146.83, E3:164.81, F3:174.61, G3:196,
  E4:329.63, G4:392, A4:440, B4:493.88, C5:523.25, D5:587.33, E5:659.25, G5:783.99 };
const MUSIC_BEAT = 0.4, MUSIC_LOOP = 24 * MUSIC_BEAT;
const MELODY = [
  [0,'A4',1],[1,'C5',1],[2,'E5',1],[3,'D5',1.5],[4.5,'C5',.5],[5,'B4',1],
  [6,'C5',1],[7,'A4',1],[8,'G4',2],[10,'E4',1],[11,'G4',1],
  [12,'A4',1],[13,'C5',1],[14,'E5',1],[15,'G5',1.5],[16.5,'E5',.5],[17,'D5',1],
  [18,'C5',1],[19,'B4',1],[20,'A4',2],[22,'E4',1],[23,'G4',1]];
const BASS = ['A2','F3','C3','G3','A2','F3','D3','E3'];

export const SFX = {
  ctx:null, master:null, musicGain:null, musicTimer:null, loopStart:0,
  musicOn:true, lastBeat:-1,
  ensure(){
    if(this.ctx) return true;
    try{
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.6;
      this.musicGain.connect(this.master);
      this.loopStart = this.ctx.currentTime + 0.1;
      this.musicTimer = setInterval(()=>this.tickMusic(), 100);
    }catch(e){ return false; }
    return true;
  },
  resume(){ if(this.ctx && this.ctx.state==='suspended') this.ctx.resume(); },
  tone(f0,f1,dur,type,vol,delay){
    if(!this.ctx) return;
    const t0 = this.ctx.currentTime + (delay||0);
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type||'sine';
    o.frequency.setValueAtTime(Math.max(f0,20), t0);
    if(f1 && f1!==f0) o.frequency.exponentialRampToValueAtTime(Math.max(f1,20), t0+dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0+0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0+dur+0.05);
  },
  noise(dur,vol,freq,delay){
    if(!this.ctx) return;
    const t0 = this.ctx.currentTime + (delay||0);
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<n;i++) d[i] = (Math.random()*2-1) * (1-i/n);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value = freq||800;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0+dur+0.02);
  },
  mnote(f,dur,type,vol,when){
    if(!this.ctx) return;
    const t0 = this.ctx.currentTime + (when||0);
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
    o.connect(g); g.connect(this.musicGain);
    o.start(t0); o.stop(t0+dur+0.05);
  },
  tickMusic(){
    if(!this.ctx || !this.musicOn) return;
    const now = this.ctx.currentTime;
    const pos = ((now - this.loopStart) % MUSIC_LOOP + MUSIC_LOOP) % MUSIC_LOOP;
    const curBeat = pos / MUSIC_BEAT;
    const ahead = curBeat + 0.7;
    if(ahead < this.lastBeat - 0.5) this.lastBeat = -1;
    for(const m of MELODY){
      if(m[0] > this.lastBeat && m[0] <= ahead){
        const when = Math.max(0, (m[0]-curBeat)*MUSIC_BEAT);
        this.mnote(NOTE[m[1]], m[2]*MUSIC_BEAT*1.9, 'triangle', 0.045, when);
        this.mnote(NOTE[m[1]]*2, m[2]*MUSIC_BEAT*1.2, 'sine', 0.011, when);
      }
    }
    for(let bar=0; bar<8; bar++){
      const b = bar*3;
      if(b > this.lastBeat && b <= ahead){
        this.mnote(NOTE[BASS[bar]], MUSIC_BEAT*2.8, 'sine', 0.06, Math.max(0,(b-curBeat)*MUSIC_BEAT));
      }
    }
    this.lastBeat = ahead;
  },
  shoot(){ this.tone(760, 320, 0.09, 'square', 0.08); },
  throwBall(){ this.tone(480, 940, 0.08, 'triangle', 0.1); this.noise(0.04, 0.03, 3500); },
  gatling(){ this.tone(240, 120, 0.06, 'square', 0.07); this.noise(0.05, 0.06, 2200); },
  missile(){ this.tone(300, 900, 0.25, 'sawtooth', 0.08); this.noise(0.25, 0.05, 900); },
  bulletHit(){ this.noise(0.05, 0.08, 1600); this.tone(150, 90, 0.05, 'square', 0.04); },
  snowShoot(){ this.tone(980, 420, 0.1, 'sine', 0.09); this.noise(0.06, 0.03, 4000); },
  splat(){ this.noise(0.07, 0.13, 900); this.tone(190, 90, 0.07, 'sine', 0.1); },
  groan(){
    const f = rand(75, 120);
    this.tone(f, f*0.72, rand(0.6,0.95), 'sawtooth', 0.05);
    this.tone(f*1.5, f*1.1, rand(0.5,0.8), 'triangle', 0.028);
  },
  chomp(){ this.noise(0.09, 0.15, 500); this.tone(150, 80, 0.08, 'square', 0.05); },
  plant(){ this.tone(170, 95, 0.13, 'sine', 0.16); this.noise(0.06, 0.05, 600); },
  dig(){ this.noise(0.12, 0.13, 1600); this.tone(320, 150, 0.09, 'triangle', 0.07); },
  sun(){ this.tone(1046, 1046, 0.08, 'sine', 0.09); this.tone(1568, 1568, 0.1, 'sine', 0.07, 0.06); },
  boom(){ this.noise(0.6, 0.5, 320); this.tone(120, 32, 0.5, 'sine', 0.4); },
  mower(){ this.tone(60, 210, 0.9, 'sawtooth', 0.13); this.noise(0.9, 0.09, 700); },
  hop(){ this.tone(280, 620, 0.22, 'triangle', 0.1); },
  horn(){ this.tone(98, 98, 0.7, 'sawtooth', 0.11); this.tone(147, 147, 0.7, 'sawtooth', 0.07, 0.02); },
  error(){ this.tone(150, 110, 0.14, 'square', 0.08); },
  paperTear(){ this.noise(0.18, 0.16, 5200); this.tone(1400, 420, 0.16, 'sawtooth', 0.05); },
  angry(){ this.tone(150, 62, 0.4, 'sawtooth', 0.14); this.noise(0.32, 0.09, 620, 0.04); },
  click(){ this.tone(620, 620, 0.05, 'sine', 0.08); },
  select(){ this.tone(880, 1100, 0.07, 'sine', 0.07); },
  win(){ const seq=[523.25,659.25,783.99,1046.5]; seq.forEach((f,i)=>this.tone(f,f,0.22,'triangle',0.11,i*0.14)); },
  lose(){ const seq=[392,329.63,261.63,196]; seq.forEach((f,i)=>this.tone(f,f*0.94,0.4,'sawtooth',0.06,i*0.3)); },
};
