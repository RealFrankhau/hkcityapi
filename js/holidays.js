/* ============================================================
   holidays.js — 公眾假期 Public Holidays
   香港城市數據通 v4
   ============================================================ */

'use strict';

const Holidays = (function() {

  const API_URL = 'https://www.1823.gov.hk/common/ical/tc.json';
  const CLOUDFLARE_WORKER_URL = 'https://hkcityapi.frankhau.workers.dev/';
  const API_PROXY_URL = `${CLOUDFLARE_WORKER_URL}?url=${encodeURIComponent(API_URL)}`;

  const DAYS_ZH = ['日', '一', '二', '三', '四', '五', '六'];
  const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS_ZH = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

  let _allHolidays = []; // [{date: Date, name: string, dateStr: string}]
  let _activeYear = new Date().getFullYear();
  let _solarTerms = [];
  let _solarTermActiveYear = new Date().getFullYear();

  /* ── Parse dtstart value ──────────────────────────────────── */
  function parseDtstart(dtstart) {
    // dtstart can be: "20260101" or ["20260101", {value:"DATE"}]
    if (!dtstart) return null;
    let raw = dtstart;
    if (Array.isArray(dtstart)) {
      raw = dtstart[0];
    } else if (typeof dtstart === 'object' && dtstart.val) {
      raw = dtstart.val;
    }
    raw = String(raw).replace(/[^0-9]/g, '').slice(0, 8);
    if (raw.length !== 8) return null;
    const y = parseInt(raw.slice(0, 4));
    const m = parseInt(raw.slice(4, 6)) - 1;
    const d = parseInt(raw.slice(6, 8));
    return new Date(y, m, d);
  }

  /* ── Parse summary (holiday name) ────────────────────────── */
  function parseSummary(summary) {
    if (!summary) return '假期';
    if (Array.isArray(summary)) return String(summary[0] || '假期');
    return String(summary);
  }

  /* ── Date string YYYYMMDD ─────────────────────────────────── */
  function toDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  }

  /* ── Format date for display ──────────────────────────────── */
  function fmtDate(d) {
    const y = d.getFullYear();
    const m = MONTHS_ZH[d.getMonth()];
    const day = d.getDate();
    const dow = DAYS_ZH[d.getDay()];
    const dowEn = DAYS_EN[d.getDay()];
    return { full: `${y}年${m}${day}日 (${dow})`, short: `${m}${day}日`, dow, dowEn, y, m, day };
  }

  /* ── Count days until a future date ──────────────────────── */
  function daysUntil(targetDate) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    return Math.round((target - today) / 86400000);
  }

  /* ── Render countdown + upcoming section ──────────────────── */
  function renderUpcoming(holidays) {
    const today = new Date();
    const todayStr = toDateStr(today);

    // Find today's holiday
    const todayHol = holidays.find(h => toDateStr(h.date) === todayStr);

    // Find upcoming (future or today)
    const upcoming = holidays
      .filter(h => daysUntil(h.date) >= 0)
      .slice(0, 5);

    // Next holiday (strictly future)
    const next = holidays.find(h => daysUntil(h.date) > 0);

    // Render today banner
    const todayBanner = document.getElementById('hol-today-banner');
    if (todayBanner) {
      if (todayHol) {
        todayBanner.innerHTML = `
          <div class="warn-strip" style="background:var(--success-bg);border-color:var(--success);color:var(--success)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <div>
              <div style="font-weight:700;font-size:var(--text-base)">今天是公眾假期！</div>
              <div style="font-size:var(--text-sm)">${escHtml(todayHol.name)}</div>
            </div>
          </div>
        `;
        todayBanner.style.display = '';
      } else {
        todayBanner.style.display = 'none';
      }
    }

    // Render countdown
    const countdownEl = document.getElementById('hol-countdown');
    if (countdownEl) {
      if (next) {
        const days = daysUntil(next.date);
        const fmt = fmtDate(next.date);
        countdownEl.innerHTML = `
          <div style="text-align:center;padding:var(--sp-4);width:100%">
            <div style="font-size:var(--text-xs);color:var(--text-faint);text-transform:uppercase;letter-spacing:.07em;margin-bottom:var(--sp-2)">距下個假期 Next Holiday</div>
            <div style="font-family:var(--font-mono);font-size:var(--text-3xl);font-weight:700;color:var(--primary);line-height:1">${days}</div>
            <div style="font-size:var(--text-sm);color:var(--text-muted);margin-top:var(--sp-1)">天 days</div>
            <div style="margin-top:var(--sp-3);font-weight:600;font-size:var(--text-base)">${escHtml(next.name)}</div>
            <div style="font-size:var(--text-sm);color:var(--text-muted)">${fmt.full}</div>
          </div>
        `;
      } else {
        countdownEl.innerHTML = `<div style="color:var(--text-faint);text-align:center;padding:var(--sp-4)">暫無假期數據</div>`;
      }
    }

    // Render upcoming list
    const upcomingEl = document.getElementById('hol-upcoming');
    if (upcomingEl) {
      if (!upcoming.length) {
        upcomingEl.innerHTML = `<div class="row-item"><span class="row-val" style="color:var(--text-faint)">暫無即將來臨的假期</span></div>`;
        return;
      }
      upcomingEl.innerHTML = upcoming.map(h => {
        const fmt = fmtDate(h.date);
        const days = daysUntil(h.date);
        const isToday = days === 0;
        const tagClass = isToday ? 'tag-green' : (days <= 7 ? 'tag-yellow' : 'tag-blue');
        const tagText = isToday ? '今天' : `${days} 天後`;
        return `
          <div class="row-item">
            <div style="display:flex;flex-direction:column;gap:2px">
              <span class="row-name">${escHtml(h.name)}</span>
              <span class="row-sub">${fmt.full}</span>
            </div>
            <span class="tag ${tagClass}">${tagText}</span>
          </div>
        `;
      }).join('');
    }
  }

  /* ── Render year tab buttons ──────────────────────────────── */
  function renderYearTabs(years) {
    const tabsEl = document.getElementById('hol-year-tabs');
    if (!tabsEl) return;
    tabsEl.innerHTML = years.map(y => `
      <button
        id="hol-tab-${y}"
        onclick="Holidays.showYear(${y})"
        style="
          padding:var(--sp-2) var(--sp-4);
          border-radius:var(--r-md);
          font-size:var(--text-sm);
          font-weight:600;
          border:1px solid var(--border);
          background:${y === _activeYear ? 'var(--primary-lt)' : 'var(--surface-2)'};
          color:${y === _activeYear ? 'var(--primary)' : 'var(--text-muted)'};
          transition:all 0.15s ease;
          cursor:pointer
        "
      >${y}</button>
    `).join('');
  }

  /* ── Update active tab styling ────────────────────────────── */
  function updateTabStyles(years) {
    years.forEach(y => {
      const btn = document.getElementById(`hol-tab-${y}`);
      if (!btn) return;
      btn.style.background = y === _activeYear ? 'var(--primary-lt)' : 'var(--surface-2)';
      btn.style.color = y === _activeYear ? 'var(--primary)' : 'var(--text-muted)';
    });
  }

  /* ── Render full year holiday list ───────────────────────── */
  function renderYearList(year) {
    const listEl = document.getElementById('hol-year-list');
    if (!listEl) return;

    const yearHols = _allHolidays.filter(h => h.date.getFullYear() === year);
    if (!yearHols.length) {
      listEl.innerHTML = `<div style="color:var(--text-faint);padding:var(--sp-4)">${year} 年無假期數據</div>`;
      const summEl = document.getElementById('hol-year-summary');
      if (summEl) summEl.textContent = '無假期數據';
      return;
    }

    const today = new Date();
    const todayStr = toDateStr(today);

    listEl.innerHTML = yearHols.map((h, i) => {
      const fmt = fmtDate(h.date);
      const isToday = toDateStr(h.date) === todayStr;
      const isPast = daysUntil(h.date) < 0;
      const bg = isToday ? 'var(--success-bg)' : 'var(--surface-2)';
      const border = isToday ? '1px solid var(--success)' : '1px solid var(--divider)';
      const opacity = isPast ? '0.55' : '1';
      return `
        <div class="row-item" style="background:${bg};border:${border};opacity:${opacity}">
          <div style="display:flex;flex-direction:column;gap:2px">
            <span class="row-name">${escHtml(h.name)}</span>
            <span class="row-sub" style="font-family:var(--font-mono)">
              ${fmt.full}
            </span>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
            <span class="tag tag-muted" style="font-size:10px">
              假期 #${i + 1}
            </span>
            ${isToday ? `<span class="tag tag-green" style="font-size:10px">今天</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Summary
    const summEl = document.getElementById('hol-year-summary');
    if (summEl) {
      summEl.textContent = `${year} 年共 ${yearHols.length} 個公眾假期`;
    }
  }

  /* ── Public: show a specific year ─────────────────────────── */
  function showYear(year) {
    _activeYear = year;
    const years = [...new Set(_allHolidays.map(h => h.date.getFullYear()))].sort();
    updateTabStyles(years);
    renderYearList(year);
  }

  /* ── HTML escape ──────────────────────────────────────────── */
  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── Solar terms 二十四節氣 ────────────────────────────────── */
  const SOLAR_TERM_NAMES = [
    ['小寒', 'Minor Cold'], ['大寒', 'Major Cold'],
    ['立春', 'Start of Spring'], ['雨水', 'Rain Water'],
    ['驚蟄', 'Awakening of Insects'], ['春分', 'Spring Equinox'],
    ['清明', 'Clear and Bright'], ['穀雨', 'Grain Rain'],
    ['立夏', 'Start of Summer'], ['小滿', 'Grain Buds'],
    ['芒種', 'Grain in Ear'], ['夏至', 'Summer Solstice'],
    ['小暑', 'Minor Heat'], ['大暑', 'Major Heat'],
    ['立秋', 'Start of Autumn'], ['處暑', 'End of Heat'],
    ['白露', 'White Dew'], ['秋分', 'Autumnal Equinox'],
    ['寒露', 'Cold Dew'], ['霜降', 'Frost Descent'],
    ['立冬', 'Start of Winter'], ['小雪', 'Minor Snow'],
    ['大雪', 'Major Snow'], ['冬至', 'Winter Solstice'],
  ];
  const SOLAR_TERMS_URL = year => `https://www.hko.gov.hk/tc/gts/astronomy/data/files/24SolarTerms_${year}.xml`;
  const SOLAR_TERMS_SOURCE = 'https://www.hko.gov.hk/tc/gts/astronomy/Solar_Term.htm';

  async function fetchSolarTermsYear(year) {
    const url = SOLAR_TERMS_URL(year);
    let response;
    try {
      response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch(e) {
      response = await fetch(`${CLOUDFLARE_WORKER_URL}?url=${encodeURIComponent(url)}`);
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const xml = new DOMParser().parseFromString(await response.text(), 'application/xml');
    if (xml.querySelector('parsererror')) throw new Error('Invalid solar term XML');
    const rows = [...xml.querySelectorAll('Data')];
    if (rows.length !== SOLAR_TERM_NAMES.length) throw new Error(`Expected 24 terms, received ${rows.length}`);

    return rows.map((row, index) => {
      const month = Number(row.querySelector('M')?.textContent);
      const day = Number(row.querySelector('D')?.textContent);
      const time = row.querySelector('hm')?.textContent.trim() || '';
      if (!month || !day || !/^\d{2}:\d{2}$/.test(time)) throw new Error(`Invalid term data for ${year}`);
      return {
        name: SOLAR_TERM_NAMES[index][0],
        en: SOLAR_TERM_NAMES[index][1],
        date: new Date(year, month - 1, day),
        time,
      };
    });
  }

  async function refreshSolarTerms() {
    const el = document.getElementById('hol-solar-terms');
    if (!el) return;

    const thisYear = new Date().getFullYear();
    const years = [thisYear - 1, thisYear, thisYear + 1, thisYear + 2];
    const results = await Promise.allSettled(years.map(fetchSolarTermsYear));
    _solarTerms = results
      .filter(result => result.status === 'fulfilled')
      .flatMap(result => result.value)
      .sort((a, b) => a.date - b.date);

    if (!_solarTerms.length) {
      el.innerHTML = `<div style="color:var(--text-faint);font-size:var(--text-xs)">無法載入香港天文台節氣資料。<a href="${SOLAR_TERMS_SOURCE}" target="_blank" rel="noopener">查看天文台資料</a></div>`;
      return;
    }

    _solarTermActiveYear = _solarTerms.some(term => term.date.getFullYear() === thisYear)
      ? thisYear
      : _solarTerms[0].date.getFullYear();
    renderSolarTerms();
  }

  function showSolarTermYear(year) {
    const selectedYear = Number(year);
    if (!_solarTerms.some(term => term.date.getFullYear() === selectedYear)) return;
    _solarTermActiveYear = selectedYear;
    renderSolarTerms();
  }

  function renderSolarTerms() {
    const el = document.getElementById('hol-solar-terms');
    if (!el || !_solarTerms.length) return;

    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const all   = _solarTerms;
    const years = [...new Set(all.map(term => term.date.getFullYear()))].sort();
    const yearTerms = all.filter(term => term.date.getFullYear() === _solarTermActiveYear);

    // Find current (most recent past or today)
    const past = all.filter(t => t.date <= today);
    const current = past.length > 0 ? past[past.length - 1] : null;

    // Find next upcoming
    const next = all.find(t => t.date > today);

    if (!current && !next) {
      el.innerHTML = `<div style="color:var(--text-faint);font-size:var(--text-xs)">節氣數據不可用</div>`;
      return;
    }

    const nextDays = next ? Math.round((next.date - today) / 86400000) : null;

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-4);margin-bottom:var(--sp-4)">
        ${current ? `
          <div style="padding:var(--sp-4);background:var(--surface-2);border-radius:var(--r-lg);
                      border-left:3px solid var(--teal)">
            <div style="font-size:var(--text-xs);color:var(--text-faint);margin-bottom:var(--sp-2)">
              當前節氣 Current Term
            </div>
            <div style="font-family:'WDXL Lubrifont TC',sans-serif;font-size:var(--text-3xl);font-weight:100;
                        color:var(--teal)">${current.name}</div>
            <div style="font-size:var(--text-xs);color:var(--text-muted);margin-top:var(--sp-1)">
              ${current.en}
            </div>
            <div style="font-size:var(--text-xs);color:var(--text-faint);margin-top:var(--sp-1);
                        font-family:var(--font-mono)">
              ${current.date.getFullYear()}年${current.date.getMonth()+1}月${current.date.getDate()}日
              ${current.time}
            </div>
          </div>
        ` : '<div></div>'}
        ${next ? `
          <div style="padding:var(--sp-4);background:var(--surface-2);border-radius:var(--r-lg);
                      border-left:3px solid var(--primary)">
            <div style="font-size:var(--text-xs);color:var(--text-faint);margin-bottom:var(--sp-2)">
              下個節氣 Next Term
            </div>
            <div style="font-family:'WDXL Lubrifont TC',sans-serif;font-size:var(--text-3xl);font-weight:100;
                        color:var(--primary)">${next.name}</div>
            <div style="font-size:var(--text-xs);color:var(--text-muted);margin-top:var(--sp-1)">
              ${next.en}
            </div>
            <div style="font-size:var(--text-xs);color:var(--text-faint);margin-top:var(--sp-1);
                        font-family:var(--font-mono)">
              ${next.date.getFullYear()}年${next.date.getMonth()+1}月${next.date.getDate()}日
              ${next.time}
              · 還有 <span style="color:var(--primary);font-weight:700">${nextDays}</span> 天
            </div>
          </div>
        ` : '<div></div>'}
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;gap:var(--sp-3);margin-bottom:var(--sp-2)">
        <div style="font-size:var(--text-xs);font-weight:700;color:var(--text-faint);
                    text-transform:uppercase;letter-spacing:.06em">
          ${_solarTermActiveYear}年的二十四節氣
        </div>
        <select aria-label="選擇節氣年份" onchange="Holidays.showSolarTermYear(this.value)"
                style="padding:var(--sp-1) var(--sp-2);border:1px solid var(--border);border-radius:var(--r-md);
                       background:var(--surface-2);color:var(--text);font-size:var(--text-sm)">
          ${years.map(year => `<option value="${year}" ${year === _solarTermActiveYear ? 'selected' : ''}>${year}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:var(--sp-2)">
          ${yearTerms.map(t => {
          const isToday = t.date.getTime() === today.getTime();
          const isPast  = t.date < today;
          const isNext  = next && t.date.getTime() === next.date.getTime();
          const bg = isToday ? 'var(--success-bg)' : isNext ? 'var(--primary-lt)' : isPast ? 'var(--surface-2)' : 'var(--surface-2)';
          const color = isToday ? 'var(--success)' : isNext ? 'var(--primary)' : isPast ? 'var(--text-faint)' : 'var(--text)';
          const opacity = isPast && !isToday ? '0.5' : '1';
          const mm = String(t.date.getMonth()+1).padStart(2,'0');
          const dd = String(t.date.getDate()).padStart(2,'0');
          return `
            <div style="padding:var(--sp-2) var(--sp-3);background:${bg};border-radius:var(--r-md);
                        opacity:${opacity};text-align:center;min-width:56px">
              <div style="font-size:12px;font-weight:700;color:${color}">${t.name}</div>
              <div style="font-size:9px;color:var(--text-faint);font-family:var(--font-mono)">${mm}/${dd} ${t.time}</div>
            </div>
          `;
        }).join('')}
      </div>
      <div style="font-size:var(--text-xs);color:var(--text-faint);margin-top:var(--sp-3)">
        資料來源：<a href="${SOLAR_TERMS_SOURCE}" target="_blank" rel="noopener">香港天文台（香港時間）</a>
      </div>
    `;
  }

  /* ── Main fetch + render ──────────────────────────────────── */
  async function refresh() {
    const listEl = document.getElementById('hol-year-list');
    if (!listEl) return;
    listEl.innerHTML = `<div class="skel skel-p" style="margin-bottom:8px"></div><div class="skel skel-p" style="margin-bottom:8px;width:70%"></div>`;
    refreshSolarTerms();

    // Load public holidays directly, then use the local proxy if browser CORS blocks it.
    try {
      let res;
      try {
        res = await fetch(API_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch(e) {
        console.warn('[Holidays] Direct API request failed, trying same-origin proxy:', e.message);
        res = await fetch(API_PROXY_URL);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const events = data?.vcalendar?.[0]?.vevent || [];
      _allHolidays = events
        .map(ev => {
          const date = parseDtstart(ev.dtstart);
          const name = parseSummary(ev.summary);
          if (!date) return null;
          return { date, name };
        })
        .filter(Boolean)
        .sort((a, b) => a.date - b.date);
      if (!_allHolidays.length) throw new Error('No valid holiday events');

      const notice = document.getElementById('hol-data-notice');
      if (notice) {
        notice.innerHTML = `<div style="font-size:var(--text-xs);color:var(--text-faint);padding:var(--sp-2) 0">
          數據來源：香港1823 公眾假期 API
        </div>`;
      }
    } catch(e) {
      console.warn('[Holidays] Unable to load public holidays from 1823 API:', e.message);
      _allHolidays = [];
      const notice = document.getElementById('hol-data-notice');
      if (notice) {
        notice.innerHTML = `<div style="font-size:var(--text-xs);color:var(--text-faint);padding:var(--sp-2) 0">
          無法載入香港1823公眾假期資料，請稍後再試。
        </div>`;
      }
    }

    const years = [...new Set(_allHolidays.map(h => h.date.getFullYear()))].sort();

    // Set active year to current or nearest available
    const curYear = new Date().getFullYear();
    if (years.includes(curYear)) _activeYear = curYear;
    else if (years.length) _activeYear = years[years.length - 1];

    renderYearTabs(years);
    renderUpcoming(_allHolidays);
    renderYearList(_activeYear);
  }

  return { refresh, showYear, showSolarTermYear };
})();
