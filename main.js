(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pad = n => String(n).padStart(2, '0');
  const tc = f => `${pad(Math.floor(f / 108000))}:${pad(Math.floor(f / 1800) % 60)}:${pad(Math.floor(f / 30) % 60)}:${pad(f % 30)}`;

  gsap.registerPlugin(ScrollTrigger);

  /* ---------- scroll suave ---------- */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const el = $(id);
    if (!el) return;
    e.preventDefault();
    lenis ? lenis.scrollTo(el, { offset: 0, duration: 1.6 }) : el.scrollIntoView({ behavior: 'smooth' });
  }));

  /* ---------- split de palavras ---------- */
  const split = el => {
    el.innerHTML = el.textContent.trim().split(/\s+/).map(w => `<span class="wd">${w}</span>`).join(' ');
    return $$('.wd', el);
  };

  /* ---------- loader ---------- */
  const loader = $('.loader');
  const ltc = $('.loader__tc');
  const lpct = $('.loader__pct');
  const lbar = $('.loader__bar i');
  const heroVideo = $('.hero__video');
  const ready = Promise.race([
    Promise.all([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      new Promise(r => heroVideo.readyState >= 3 ? r() : heroVideo.addEventListener('canplay', r, { once: true }))
    ]),
    new Promise(r => setTimeout(r, 3800))
  ]);
  const prog = { v: 0 };
  const fill = gsap.to(prog, {
    v: 0.86, duration: 1.8, ease: 'power2.out',
    onUpdate() {
      lbar.style.transform = `scaleX(${prog.v})`;
      lpct.textContent = Math.round(prog.v * 100) + '%';
      ltc.textContent = tc(Math.round(prog.v * 96));
    }
  });

  ready.then(() => {
    fill.kill();
    gsap.timeline({ onComplete: intro })
      .to(prog, {
        v: 1, duration: .5, ease: 'power1.out',
        onUpdate() {
          lbar.style.transform = `scaleX(${prog.v})`;
          lpct.textContent = Math.round(prog.v * 100) + '%';
          ltc.textContent = tc(Math.round(prog.v * 96));
        }
      })
      .to('.loader__frame', { scale: 1.08, opacity: 0, duration: .5, ease: 'power2.in' })
      .to('.shutter', { scaleY: 1, duration: .35, ease: 'power3.in' }, '-=.15')
      .set(loader, { background: 'transparent' })
      .to('.shutter', { scaleY: 0, duration: .8, ease: 'expo.out', transformOrigin: i => i ? 'bottom' : 'top' })
      .set(loader, { display: 'none' });
  });

  function intro() {
    document.body.classList.remove('is-loading');
    lenis && lenis.start();
    heroVideo.play().catch(() => {});
    $('.hud').classList.add('on');
    gsap.from('.hero__title .w', { yPercent: 110, duration: 1.3, ease: 'expo.out', stagger: .08 });
    gsap.from('.hero__dot', { scale: 0, duration: .9, ease: 'back.out(3)', delay: .7 });
    gsap.from('.hero__kicker span, .hero__foot > *', { y: 24, opacity: 0, duration: 1, ease: 'expo.out', stagger: .07, delay: .35 });
    gsap.from('.hero__video', { scale: 1.25, duration: 2.2, ease: 'expo.out' });
    gsap.from('.nav', { yPercent: -100, opacity: 0, duration: 1, ease: 'expo.out', delay: .4 });
    ScrollTrigger.refresh();
  }

  /* ---------- HUD: timecode do scroll + cena ---------- */
  const hudTc = $('.hud__tc');
  const hudScene = $('.hud__scene');
  const hudLabel = $('.hud__label');
  const hudBar = $('.hud__progress i');
  gsap.ticker.add(() => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? scrollY / max : 0;
    hudBar.style.transform = `scaleX(${p})`;
    hudTc.textContent = tc(Math.round(p * 5400));
  });
  $$('[data-scene]').forEach(sec => ScrollTrigger.create({
    trigger: sec, start: 'top 55%', end: 'bottom 55%',
    onToggle: s => {
      if (!s.isActive) return;
      hudScene.textContent = 'CENA ' + sec.dataset.scene;
      hudLabel.textContent = sec.dataset.label;
    }
  }));

  /* ---------- nav ---------- */
  const nav = $('.nav');
  let lastY = 0;
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: s => {
      const y = s.scroll();
      nav.classList.toggle('is-solid', y > 80);
      nav.classList.toggle('is-hidden', y > lastY && y > innerHeight * .6);
      lastY = y;
    }
  });

  /* ---------- cursor ---------- */
  const cursor = $('.cursor');
  if (matchMedia('(hover:hover)').matches) {
    const qx = gsap.quickTo(cursor, 'x', { duration: .35, ease: 'power3' });
    const qy = gsap.quickTo(cursor, 'y', { duration: .35, ease: 'power3' });
    addEventListener('pointermove', e => { qx(e.clientX); qy(e.clientY); });
    $$('.reel:not(.reel--end), .case__media').forEach(el => {
      el.addEventListener('pointerenter', () => cursor.classList.add('is-play'));
      el.addEventListener('pointerleave', () => cursor.classList.remove('is-play'));
    });
    $$('a, button, .chip').forEach(el => {
      el.addEventListener('pointerenter', () => gsap.to(cursor, { scale: 2.2, opacity: .6, duration: .3 }));
      el.addEventListener('pointerleave', () => gsap.to(cursor, { scale: 1, opacity: 1, duration: .3 }));
    });
  }

  /* ---------- vídeos: carrega perto, toca quando visível ---------- */
  const vids = $$('video[data-src]');
  const loadIO = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const v = e.target;
    v.src = v.dataset.src;
    v.removeAttribute('data-src');
    loadIO.unobserve(v);
  }), { rootMargin: '120% 120%' });
  const playIO = new IntersectionObserver(es => es.forEach(e => {
    const v = e.target;
    if (e.isIntersecting) { const p = v.play(); p && p.catch(() => {}); }
    else v.pause();
  }), { threshold: .15 });
  vids.forEach(v => { loadIO.observe(v); playIO.observe(v); });
  new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? heroVideo.play().catch(() => {}) : heroVideo.pause()))
    .observe(heroVideo);

  if (reduce) {
    $$('[data-count]').forEach(el => {
      const n = +el.dataset.count, d = +(el.dataset.dec || 0);
      el.textContent = (el.dataset.prefix || '') + n.toFixed(d).replace('.', ',') + (el.dataset.suffix || '');
    });
    return;
  }

  /* ---------- hero: o quadro vira janela ---------- */
  gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } })
    .to('.hero__media', { clipPath: 'inset(9% 7% 9% 7% round 18px)', ease: 'none' }, 0)
    .to('.hero__video', { scale: 1.12, ease: 'none' }, 0)
    .to('.hero__content', { yPercent: -18, opacity: 0, ease: 'none' }, 0)
    .to('.hero__title .line:first-child', { xPercent: -8, ease: 'none' }, 0)
    .to('.hero__title .line:last-child', { xPercent: 6, ease: 'none' }, 0);

  /* ---------- palavras acendendo ---------- */
  $$('.reveal-words').forEach(el => {
    const ws = split(el);
    gsap.to(ws, {
      opacity: 1, ease: 'none', stagger: .1,
      scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: true }
    });
  });

  /* ---------- rota RN → SP ---------- */
  const route = $('.route__line');
  const len = route.getTotalLength();
  gsap.set(route, { strokeDasharray: len, strokeDashoffset: len });
  const stops = $$('.stop');
  gsap.to(route, {
    strokeDashoffset: 0, ease: 'none',
    scrollTrigger: {
      trigger: '.route', start: 'top 85%', end: 'top 35%', scrub: true,
      onUpdate: s => stops.forEach((st, i) => st.classList.toggle('is-on', s.progress >= [0.02, 0.5, 0.97][i]))
    }
  });

  /* ---------- fotos com parallax ---------- */
  $$('.story__photo').forEach((f, i) => {
    gsap.fromTo(f, { y: 80 + i * 30 }, { y: -40 - i * 20, ease: 'none', scrollTrigger: { trigger: f, start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.to($('img', f), { scale: 1, ease: 'none', scrollTrigger: { trigger: f, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  gsap.from('.story__quote, .story__note', { y: 50, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: .15, scrollTrigger: { trigger: '.story__quote', start: 'top 80%' } });

  /* ---------- contadores ---------- */
  $$('[data-count]').forEach(el => {
    const n = +el.dataset.count, d = +(el.dataset.dec || 0);
    const o = { v: 0 };
    const fmt = () => el.textContent = (el.dataset.prefix || '') + o.v.toFixed(d).replace('.', ',') + (el.dataset.suffix || '');
    gsap.to(o, { v: n, duration: 2.2, ease: 'expo.out', onUpdate: fmt, scrollTrigger: { trigger: el, start: 'top 85%' } });
  });
  gsap.from('.num', { y: 40, opacity: 0, stagger: .1, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: '.numbers', start: 'top 80%' } });

  /* ---------- títulos ---------- */
  $$('.sec-title').forEach(t => gsap.from(t, { y: 70, opacity: 0, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: t, start: 'top 85%' } }));

  /* ---------- cases empilhados ---------- */
  const cases = $$('.case');
  const stacked = matchMedia('(min-width: 861px)').matches;
  cases.forEach((c, i) => {
    const next = cases[i + 1];
    if (!next || !stacked) return;
    gsap.to(c, {
      scale: .92, filter: 'brightness(.45)', ease: 'none',
      scrollTrigger: { trigger: next, start: 'top 65%', end: 'top 15%', scrub: true }
    });
  });
  cases.forEach(c => gsap.from($$('.case__body > *', c), {
    y: 40, opacity: 0, duration: 1, ease: 'expo.out', stagger: .07,
    scrollTrigger: { trigger: c, start: 'top 70%' }
  }));

  /* ---------- captações: trilho horizontal ---------- */
  const track = $('.reels__track');
  const dist = () => Math.max(0, track.scrollWidth - innerWidth);
  gsap.to(track, {
    x: () => -dist(), ease: 'none',
    scrollTrigger: {
      trigger: '.reels', pin: '.reels__pin', start: 'top top', end: () => '+=' + dist(),
      scrub: 1, invalidateOnRefresh: true, anticipatePin: 1
    }
  });

  /* ---------- voo: sequência de quadros no scroll ---------- */
  const canvas = $('.flight__canvas');
  const ctx = canvas.getContext('2d');
  const N = 88;
  const frames = new Array(N);
  let current = 0;
  const draw = i => {
    const img = frames[i];
    if (!img || !img.complete || !img.naturalWidth) return;
    const cw = canvas.clientWidth, ch = canvas.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
      canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    }
    const s = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  };
  const loadFrames = () => {
    let next = 0, active = 0;
    const pump = () => {
      while (active < 6 && next < N) {
        const i = next++;
        const img = new Image();
        active++;
        img.onload = img.onerror = () => { active--; if (i === current || i === 0) draw(current); pump(); };
        img.src = `img/seq/${String(i).padStart(3, '0')}.webp`;
        frames[i] = img;
      }
    };
    pump();
  };
  ScrollTrigger.create({ trigger: '.flight', start: 'top 300%', once: true, onEnter: loadFrames });
  const fmeta = $('.flight__frame');
  const seq = { f: 0 };
  gsap.to(seq, {
    f: N - 1, ease: 'none', snap: 'f',
    scrollTrigger: { trigger: '.flight', start: 'top top', end: 'bottom bottom', scrub: .4 },
    onUpdate: () => {
      current = Math.round(seq.f);
      draw(current);
      fmeta.textContent = `FRAME ${String(current + 1).padStart(3, '0')}/${N}`;
    }
  });
  addEventListener('resize', () => draw(current));
  gsap.timeline({ scrollTrigger: { trigger: '.flight', start: 'top top', end: 'bottom bottom', scrub: true } })
    .to('.flight__line--1', { opacity: 1, y: 0, duration: .15 }, .08)
    .to('.flight__line--2', { opacity: 1, y: 0, duration: .15 }, .45)
    .to('.flight__copy', { opacity: 0, duration: .1 }, .9);

  /* ---------- foto: janela que abre ---------- */
  gsap.timeline({ scrollTrigger: { trigger: '.photo__window', start: 'top 85%', end: 'center center', scrub: true } })
    .to('.photo__window', { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none' }, 0)
    .to('.photo__window img', { scale: 1, ease: 'none' }, 0);
  gsap.from('.kit li', { x: 40, opacity: 0, stagger: .08, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.kit', start: 'top 85%' } });
  gsap.from('.photo__grid figure', { y: 80, opacity: 0, stagger: .1, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.photo__grid', start: 'top 90%' } });

  /* ---------- parcerias ---------- */
  gsap.from('.partner', { y: 50, opacity: 0, stagger: .08, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: '.partners__grid', start: 'top 80%' } });

  /* ---------- marquees com velocidade do scroll ---------- */
  $$('.marquee__row').forEach((row, i) => {
    row.innerHTML += row.innerHTML;
    const dir = row.closest('.marquee--rev') ? 1 : -1;
    const tween = gsap.fromTo(row, { xPercent: dir < 0 ? 0 : -50 }, { xPercent: dir < 0 ? -50 : 0, duration: 38 + i * 6, ease: 'none', repeat: -1 });
    ScrollTrigger.create({
      trigger: row, start: 'top bottom', end: 'bottom top',
      onUpdate: s => {
        const v = Math.min(Math.abs(s.getVelocity()) / 400, 5);
        gsap.to(tween, { timeScale: 1 + v, duration: .2, overwrite: true });
        gsap.to(tween, { timeScale: 1, duration: 1.2, delay: .2 });
      }
    });
  });

  /* ---------- impulsione ---------- */
  gsap.from('.imp__left > *', { y: 40, opacity: 0, stagger: .08, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: '.imp', start: 'top 75%' } });
  gsap.from('.brief', { y: 80, opacity: 0, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: '.brief', start: 'top 85%' } });

  /* ---------- fé ---------- */
  gsap.from('.foot__big', { y: 60, opacity: 0, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: '.foot__main', start: 'top 85%' } });

  addEventListener('load', () => ScrollTrigger.refresh());
})();

/* ---------- funil: briefing → WhatsApp ---------- */
(() => {
  const form = document.querySelector('.brief');
  if (!form) return;
  const msgEl = form.querySelector('.brief__msg');
  const build = () => {
    const f = new FormData(form);
    const s = f.getAll('s');
    const seg = f.get('seg');
    const nome = (f.get('nome') || '').trim();
    const emp = (f.get('empresa') || '').trim();
    const cid = (f.get('cidade') || '').trim();
    let m = `Olá, Wendell! ${nome ? `Aqui é ${nome}` : 'Vim pelo seu site'}${emp ? `, da ${emp}` : ''}${cid ? ` (${cid})` : ''}.\nQuero ser posicionado no digital.`;
    if (seg) m += `\nSegmento: ${seg}.`;
    if (s.length) m += `\nTenho interesse em: ${s.join(', ')}.`;
    return m;
  };
  const update = () => { msgEl.textContent = build(); };
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!form.nome.value.trim()) { form.nome.focus(); return; }
    window.open(`https://wa.me/5584987653044?text=${encodeURIComponent(build())}`, '_blank', 'noopener');
  });
  update();
})();
