// Photo wall on the touchscreen: grid, one photo big, slideshow.
import { $, esc, call, toast } from './ui.js';

let ctx;
let list = [];
let showing = null;
let slideTimer = null;
let slideIndex = 0;

export const photos = () => list;

export function init(c) {
  ctx = c;
  $('photo-grid').addEventListener('click', (e) => {
    const t = e.target.closest('[data-photo]');
    if (t) openPhoto(t.dataset.photo);
  });
  $('photo-close').addEventListener('click', () => $('photo-box').classList.remove('open'));
  $('photo-delete').addEventListener('click', async () => {
    if (!showing) return;
    const pin = await ctx.getPin();
    if (pin == null) return;
    const res = await call(ctx.socket, 'photo:delete', { id: showing.id, pin });
    if (res?.ok) {
      $('photo-box').classList.remove('open');
      toast('Foto verwijderd');
    } else toast('Lukt niet');
  });
  $('slideshow-start').addEventListener('click', startSlideshow);
  $('slideshow').addEventListener('click', stopSlideshow);
}

export function setList(next) {
  list = next || [];
  const n = list.length;
  $('photos-line').textContent = n ? `${n} ${n === 1 ? 'foto' : "foto's"} · stuur er meer via je telefoon` : "Stuur foto's vanaf je telefoon";
  if (ctx?.view() === 'photos') render();
}

export function render() {
  const n = list.length;
  $('photos-count').textContent = n ? `${n} ${n === 1 ? 'foto' : "foto's"}` : '';
  $('slideshow-start').disabled = !n;
  if (!n) {
    $('photo-grid').innerHTML = `<div class="panel games-empty">
      <h3 class="display">Nog geen foto's</h3>
      <p>Scan de code, doe mee en kies op je telefoon de tab Foto's.</p>
      ${ctx.state.room?.qr ? `<img class="qr" src="${ctx.state.room.qr}" alt="QR-code om mee te doen">` : ''}
    </div>`;
    return;
  }
  $('photo-grid').innerHTML = list
    .map((p, i) => `<button class="photo-tile" data-photo="${esc(p.id)}" style="--r:${((i * 37) % 9) - 4}deg"><img src="/photos/${esc(p.id)}.jpg" alt="Foto van ${esc(p.by)}" loading="lazy"><span>${esc(p.by)}</span></button>`)
    .join('');
}

function openPhoto(id) {
  showing = list.find((p) => p.id === id);
  if (!showing) return;
  $('photo-big').src = `/photos/${showing.id}.jpg`;
  $('photo-by').textContent = showing.by ? `Van ${showing.by}` : '';
  $('photo-box').classList.add('open');
}

function startSlideshow() {
  if (!list.length) return;
  slideIndex = 0;
  $('slideshow').hidden = false;
  nextSlide();
  slideTimer = setInterval(nextSlide, 7000);
}

function nextSlide() {
  if (!list.length) return stopSlideshow();
  const p = list[slideIndex % list.length];
  slideIndex++;
  const img = $('slide-img');
  img.classList.remove('in');
  setTimeout(() => {
    img.src = `/photos/${p.id}.jpg`;
    $('slide-bg').style.backgroundImage = `url("/photos/${p.id}.jpg")`;
    $('slide-by').textContent = p.by ? `📸 ${p.by}` : '';
    img.onload = () => img.classList.add('in');
  }, 400);
}

export function stopSlideshow() {
  clearInterval(slideTimer);
  $('slideshow').hidden = true;
}

export const slideshowOn = () => !$('slideshow').hidden;

// a new photo arrived
export function announce({ by }) {
  toast(by ? `📸 Nieuwe foto van ${by}` : '📸 Nieuwe foto');
}
