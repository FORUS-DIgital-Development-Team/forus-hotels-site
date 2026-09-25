(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const number = (value) => Number(value || 0);
  const zar = (value) => `R\u00a0${Math.round(value).toLocaleString('en-ZA')}`;
  const signedMoney = (value) => `${value >= 0 ? '+ ' : '\u2212 '}${zar(Math.abs(value))}`;

  const dateInput = (date) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };

  const formatDate = (value) => {
    if (!value) return 'To be selected';
    return new Intl.DateTimeFormat('en-ZA', {
      day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC'
    }).format(new Date(`${value}T00:00:00Z`));
  };

  const properties = {
    coast: {
      name: 'Coastal Retreat', location: 'North Coast, KwaZulu-Natal', region: 'Coastal',
      price: 1850, image: 'images/coast.webp', alt: 'Illustrative coastal accommodation',
      description: 'A small coastal lodge concept with sea views, quiet mornings and a relaxed pace.',
      details: ['Ocean outlook', 'Pool', 'Breakfast option', '2 guests per room']
    },
    midlands: {
      name: 'The Midlands Hideaway', location: 'Midlands, KwaZulu-Natal', region: 'Countryside',
      price: 1650, image: 'images/midlands.webp', alt: 'Illustrative countryside accommodation',
      description: 'A quiet countryside retreat concept shaped around open views, local food and unhurried weekends.',
      details: ['Country outlook', 'Garden', 'Breakfast option', '2 guests per room']
    },
    'cape-town': {
      name: 'Mountain Courtyard', location: 'City Bowl, Cape Town', region: 'City',
      price: 2100, image: 'images/cape-town.webp', alt: 'Illustrative city accommodation',
      description: 'A compact city stay concept close to neighbourhood restaurants, culture and the mountain.',
      details: ['Mountain outlook', 'Courtyard', 'Central location', '2 guests per room']
    }
  };

  const menuButton = $('#menu-button');
  const mobileNav = $('#mobile-nav');
  if (menuButton && mobileNav) {
    const closeMenu = () => {
      mobileNav.hidden = true;
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', 'Open menu');
    };
    menuButton.addEventListener('click', () => {
      const opening = mobileNav.hidden;
      mobileNav.hidden = !opening;
      menuButton.setAttribute('aria-expanded', String(opening));
      menuButton.setAttribute('aria-label', opening ? 'Close menu' : 'Open menu');
    });
    $$('a', mobileNav).forEach((link) => link.addEventListener('click', closeMenu));
  }

  const checkin = $('#checkin');
  const checkout = $('#checkout');
  if (checkin && checkout) {
    const now = new Date();
    const start = new Date(now); start.setDate(start.getDate() + 14);
    const end = new Date(now); end.setDate(end.getDate() + 16);
    checkin.min = dateInput(now);
    if (!checkin.value || new Date(`${checkin.value}T00:00:00`) < now) checkin.value = dateInput(start);
    checkout.min = dateInput(new Date(`${checkin.value}T00:00:00`));
    if (!checkout.value || checkout.value <= checkin.value) checkout.value = dateInput(end);
    checkin.addEventListener('change', () => {
      const minimum = new Date(`${checkin.value}T00:00:00`);
      minimum.setDate(minimum.getDate() + 1);
      checkout.min = dateInput(minimum);
      if (!checkout.value || checkout.value <= checkin.value) checkout.value = dateInput(minimum);
    });
  }

  const cards = $$('.listing-card');
  const count = $('#result-count');
  const applyFilter = (filter, destination = null) => {
    let shown = 0;
    cards.forEach((card) => {
      const category = $('.listing-topline span', card)?.textContent.trim() || '';
      const location = $('.listing-location', card)?.textContent || '';
      const visible = destination
        ? destination === 'all' || location.includes(destination)
        : filter === 'all' || category === filter;
      card.hidden = !visible;
      if (visible) shown += 1;
    });
    if (count) count.textContent = `${shown} sample stay${shown === 1 ? '' : 's'}`;
  };

  $$('.filter').forEach((button) => button.addEventListener('click', () => {
    $$('.filter').forEach((item) => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    applyFilter(button.dataset.filter || 'all');
  }));

  $('#search-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const destination = $('#destination')?.value || 'all';
    $$('.filter').forEach((item) => {
      const active = destination === 'all' && item.dataset.filter === 'all';
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    applyFilter('all', destination);
    $('#stays')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  const roomValue = $('#room-value');
  const otaRate = $('#ota-rate');
  const memberShare = $('#member-share');
  const updateSavings = () => {
    if (!roomValue || !otaRate || !memberShare) return;
    const room = number(roomValue.value);
    const rate = number(otaRate.value) / 100;
    const share = number(memberShare.value) / 100;
    const avoided = room * rate;
    const saving = avoided * share;
    $('#room-value-display').textContent = zar(room);
    $('#ota-rate-display').textContent = `${number(otaRate.value)}%`;
    $('#member-share-display').textContent = `${number(memberShare.value)}%`;
    $('#avoided-fee').textContent = zar(avoided);
    $('#member-saving').textContent = zar(saving);
    $('#hotel-gain').textContent = zar(avoided - saving);
    $('#member-total').textContent = zar(room - saving);
  };
  [roomValue, otaRate, memberShare].forEach((input) => input?.addEventListener('input', updateSavings));
  updateSavings();

  const econInputs = ['monthly-bookings', 'average-rate', 'marketplace-rate', 'guest-benefit', 'processing-rate', 'billing-term'];
  const updateEconomics = () => {
    const bookings = number($('#monthly-bookings')?.value);
    const average = number($('#average-rate')?.value);
    const marketplace = number($('#marketplace-rate')?.value) / 100;
    const guest = number($('#guest-benefit')?.value) / 100;
    const processing = number($('#processing-rate')?.value) / 100;
    const subscription = $('#billing-term')?.value === 'annual' ? 4990 / 12 : 499;
    const gross = bookings * average;
    const otaFee = gross * marketplace;
    const otaNet = gross - otaFee;
    const memberBenefit = otaFee * guest;
    const directSale = gross - memberBenefit;
    const processingFee = directSale * processing;
    const directNet = directSale - processingFee - subscription;
    const gain = directNet - otaNet;
    const values = {
      '#monthly-bookings-output': String(bookings), '#average-rate-output': zar(average),
      '#marketplace-rate-output': `${number($('#marketplace-rate')?.value)}%`,
      '#guest-benefit-output': `${number($('#guest-benefit')?.value)}%`,
      '#processing-rate-output': `${number($('#processing-rate')?.value)}%`,
      '#econ-gross': zar(gross), '#econ-ota-fee': `\u2212 ${zar(otaFee)}`, '#econ-ota-net': zar(otaNet),
      '#econ-member-benefit': `\u2212 ${zar(memberBenefit)}`, '#econ-processing': `\u2212 ${zar(processingFee)}`,
      '#econ-subscription': `\u2212 ${zar(subscription)}`, '#econ-direct-net': zar(directNet), '#econ-gain': signedMoney(gain)
    };
    Object.entries(values).forEach(([selector, value]) => { const el = $(selector); if (el) el.textContent = value; });
  };
  econInputs.forEach((id) => $(`#${id}`)?.addEventListener(id === 'billing-term' ? 'change' : 'input', updateEconomics));
  updateEconomics();

  const propertyDialog = $('#property-dialog');
  const bookingDialog = $('#booking-dialog');
  const closeDialog = (dialog) => { if (dialog?.open) dialog.close(); };
  $$('.dialog-close').forEach((button) => button.addEventListener('click', () => closeDialog(button.closest('dialog'))));
  [propertyDialog, bookingDialog].forEach((dialog) => dialog?.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog(dialog);
  }));

  const stayLength = () => {
    const start = new Date(`${checkin?.value || ''}T00:00:00`);
    const end = new Date(`${checkout?.value || ''}T00:00:00`);
    const nights = Math.round((end - start) / 86400000);
    return Number.isFinite(nights) && nights > 0 ? nights : 2;
  };

  const showProperty = (key) => {
    const item = properties[key];
    if (!item || !propertyDialog) return;
    $('#property-dialog-content').innerHTML = `
      <img class="dialog-img" src="${item.image}" alt="${item.alt}">
      <div class="dialog-content"><span class="eyebrow">SAMPLE PROPERTY · ${item.location.toUpperCase()}</span><h2>${item.name}</h2><p>${item.description}</p>
      <div class="dialog-details">${item.details.map((detail) => `<span>${detail}</span>`).join('')}</div>
      <p class="preview-footnote">This is a concept listing. Images, rates and amenities do not describe a bookable property.</p>
      <div class="dialog-bottom"><div><strong>${zar(item.price)}</strong> / indicative night</div><button class="primary-button" type="button" data-preview="${key}">Preview a booking →</button></div></div>`;
    propertyDialog.showModal();
    $('[data-preview]', propertyDialog)?.addEventListener('click', () => showBooking(key));
  };

  const quote = (key) => {
    const item = properties[key];
    const nights = stayLength();
    const guests = number($('#guests')?.value || 2);
    const gross = item.price * nights;
    const saving = gross * (number(otaRate?.value || 15) / 100) * (number(memberShare?.value || 50) / 100);
    return { item, nights, guests, gross, saving, total: gross - saving };
  };

  const showBooking = (key) => {
    closeDialog(propertyDialog);
    if (!bookingDialog) return;
    const q = quote(key);
    $('#booking-dialog-content').innerHTML = `
      <div class="dialog-content"><span class="eyebrow">BOOKING CONCEPT · NO PAYMENT TAKEN</span><h2>Your stay, explained.</h2><p>${q.item.name} · ${q.nights} night${q.nights === 1 ? '' : 's'} · ${q.guests} guest${q.guests === 1 ? '' : 's'}</p>
      <div class="booking-row"><span>Illustrative room price</span><strong>${zar(q.gross)}</strong></div>
      <div class="booking-row saving"><span>Example member saving</span><strong>− ${zar(q.saving)}</strong></div>
      <div class="booking-row booking-total"><span>Example stay price</span><strong>${zar(q.total)}</strong></div>
      <p class="preview-footnote">This uses the savings example's external commission and member share assumptions. A real hotel would set its direct rate and member benefit. Membership fee, taxes, mandatory charges and payment costs are excluded.</p>
      <div class="booking-notice"><strong>How the prepaid voucher will work</strong><br>At launch, an approved payment flow will confirm funds for the hotel. Once the reservation is confirmed, your voucher and check-in details will be issued. No voucher or reservation can be created here today.</div>
      <button class="primary-button" type="button" data-voucher>View sample voucher →</button><button class="secondary-button" type="button" data-close-booking>Back to exploring</button></div>`;
    bookingDialog.showModal();
    $('[data-voucher]', bookingDialog)?.addEventListener('click', () => showVoucher(key));
    $('[data-close-booking]', bookingDialog)?.addEventListener('click', () => closeDialog(bookingDialog));
  };

  const showVoucher = (key) => {
    const q = quote(key);
    $('#booking-dialog-content').innerHTML = `
      <div class="dialog-content voucher-view"><span class="eyebrow">THE FUTURE CHECK-IN EXPERIENCE</span><h2>Sample stay voucher.</h2>
      <div class="voucher-card"><div class="voucher-ribbon">SAMPLE · NOT VALID FOR CHECK-IN</div><div class="voucher-head"><span class="voucher-mark">hotels.coop</span><span>PREPAID STAY CONCEPT</span></div>
      <div class="voucher-property"><small>PROPERTY</small><strong>${q.item.name}</strong><span>${q.item.location}</span></div>
      <div class="voucher-grid"><div><small>CHECK IN</small><strong>${formatDate(checkin?.value)}</strong></div><div><small>CHECK OUT</small><strong>${formatDate(checkout?.value)}</strong></div><div><small>GUESTS</small><strong>${q.guests}</strong></div><div><small>LENGTH</small><strong>${q.nights} night${q.nights === 1 ? '' : 's'}</strong></div></div>
      <div class="voucher-total"><span>Illustrative stay price</span><strong>${zar(q.total)}</strong></div><p>Example reference: DEMO-0001<br>Payment status: No payment taken · no booking created</p></div>
      <p class="preview-footnote">A valid voucher would be issued only after secure payment and hotel confirmation. This specimen has no monetary value and cannot be redeemed.</p>
      <button class="primary-button" type="button" data-back-quote>Back to price breakdown</button><button class="secondary-button" type="button" data-close-booking>Close preview</button></div>`;
    $('[data-back-quote]', bookingDialog)?.addEventListener('click', () => showBooking(key));
    $('[data-close-booking]', bookingDialog)?.addEventListener('click', () => closeDialog(bookingDialog));
  };

  $$('[data-property]').forEach((button) => button.addEventListener('click', () => showProperty(button.dataset.property)));

  const tabs = $$('[data-desk-tab]');
  const selectDeskTab = (button) => {
    tabs.forEach((tab) => {
      const selected = tab === button;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      const panel = $(`#panel-${tab.dataset.deskTab}`);
      if (panel) panel.hidden = !selected;
    });
  };
  tabs.forEach((button, index) => {
    button.addEventListener('click', () => selectDeskTab(button));
    button.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      selectDeskTab(tabs[next]); tabs[next].focus();
    });
  });

  $('#simulate-sync')?.addEventListener('click', () => {
    const rooms = Math.max(0, Math.min(30, Math.round(number($('#desk-rooms')?.value))));
    if ($('#desk-rooms')) $('#desk-rooms').value = String(rooms);
    ['#desk-direct-count', '#desk-channel-a-count', '#desk-channel-b-count'].forEach((selector) => {
      const el = $(selector); if (el) el.textContent = `${rooms} room${rooms === 1 ? '' : 's'}`;
    });
    const message = $('#sync-message');
    if (message) message.textContent = `Demo updated: ${rooms} room${rooms === 1 ? '' : 's'} shown across all three sample sources. No external system was contacted.`;
  });
})();
