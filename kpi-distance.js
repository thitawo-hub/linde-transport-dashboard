// ============================================================
// LINDE TRANSPORT
// KPI DISTANCE
// ============================================================

const SUPABASE_URL = 'https://hhsqijlcebaijtklskag.supabase.co';

// ใช้ Publishable Key เท่านั้น
const SUPABASE_KEY = 'sb_publishable_z5-j4hCd7dJ50-sLaUKraw_ZgM9ZA4W';

// ============================================================
// GLOBAL
// ============================================================

let summaryData = null;
let carData = [];

// ============================================================
// CONFIG
// ============================================================

const EXCLUDED_BRANCHES = ['linde oil'];

const BRANCH_ORDER = ['ระยอง', 'ท่าลาน', 'บางปะอิน', 'หาดใหญ่'];

// จำนวนรถ COCO ต่อสาขา/ประเภท — ตรึงค่าตายตัว ไม่อิงจำนวนแถวที่ได้จาก Supabase
// (เพราะ view v_kpi_distance_car อาจไม่มีข้อมูลรถบางประเภท เช่น 10W ครบ)
// vehicleType: null หมายถึงยังไม่แยกประเภท ให้รวมทุกประเภทของสาขานั้นเป็นแถวเดียว
const FLEET_COUNTS = [
  { branch: 'ระยอง', vehicleType: '22W', count: 35 },
  { branch: 'ระยอง', vehicleType: '10W', count: 3 },
  { branch: 'ท่าลาน', vehicleType: null, count: 14 },
  { branch: 'บางปะอิน', vehicleType: null, count: 7 },
  { branch: 'หาดใหญ่', vehicleType: null, count: 2 }
];

// Target KM สำหรับรถที่ไม่มี target_km จาก Supabase (เช่น 10W ที่ view ยังไม่ตั้งเป้าไว้)
// ให้ใช้ Target เดียวกับ 22W คือ 13,000 กม. — ใช้ทั้งกับรถจริงที่ target เป็น 0/ว่าง
// และรถ "หลอน" (virtual) ที่เติมให้ครบจำนวนตาม FLEET_COUNTS
const VIRTUAL_CAR_TARGETS = {
  '10W': 13000
};

function getFleetCountsForBranchFilter(branchFilter) {
  if (!branchFilter) return FLEET_COUNTS;
  const normalized = normalizeText(branchFilter);
  return FLEET_COUNTS.filter(entry => normalizeText(entry.branch) === normalized);
}

// หา target เริ่มต้นตามประเภทรถ (case-insensitive) จาก VIRTUAL_CAR_TARGETS
function getDefaultTargetForType(vehicleType) {
  const normalized = normalizeText(vehicleType);
  const matchKey = Object.keys(VIRTUAL_CAR_TARGETS).find(
    key => normalizeText(key) === normalized
  );
  return matchKey ? VIRTUAL_CAR_TARGETS[matchKey] : 0;
}

// Target ที่แท้จริงของรถแต่ละคัน: ใช้ target_km จาก Supabase ถ้ามี (>0)
// ถ้าไม่มี (null/0/ว่าง) ให้ fallback ไปใช้ default ตามประเภทรถ (เช่น 10W = 13000 เท่า 22W)
function getTargetKm(car) {
  const target = toNumber(car.target_km);
  if (target > 0) return target;
  return getDefaultTargetForType(car.vehicle_type);
}

// เติมรถ "หลอน" (ยังไม่มีข้อมูลทริปจริงใน Supabase) ให้ครบตามจำนวนใน FLEET_COUNTS
// เพื่อให้ตารางรายละเอียด/สรุปแสดงรถครบทุกคัน แม้ Supabase จะยังไม่มีข้อมูลของคันนั้น
function ensureFleetCoverage(cars) {
  const merged = [...cars];

  FLEET_COUNTS.forEach(entry => {
    if (!entry.vehicleType) return; // ไม่รู้ breakdown รายคัน ข้ามไป

    const matchCount = merged.filter(
      car =>
        normalizeText(car.branch) === normalizeText(entry.branch) &&
        normalizeText(normalizeVehicleType(car.vehicle_type)) === normalizeText(entry.vehicleType)
    ).length;

    const missing = entry.count - matchCount;
    if (missing <= 0) return;

    const defaultTarget = getDefaultTargetForType(entry.vehicleType);

    for (let i = 1; i <= missing; i++) {
      merged.push({
        car_no: `${entry.vehicleType}-${matchCount + i}`,
        license_plate: '-',
        branch: entry.branch,
        vehicle_type: entry.vehicleType,
        target_km: defaultTarget,
        total_km: 0,
        forecast_km: 0,
        _virtual: true
      });
    }
  });

  return merged;
}

// ============================================================
// SUPABASE FETCH
// ============================================================

async function fetchSupabase(table, params = '') {
  const pageSize = 1000;
  let offset = 0;
  let result = [];

  while (true) {
    const separator = params ? '&' : '';
    const url =
      `${SUPABASE_URL}/rest/v1/${table}?` +
      `${params}${separator}` +
      `limit=${pageSize}&offset=${offset}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Supabase ${table} ${response.status}: ${text}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error(`${table} ไม่ใช่ Array`);
    }

    result = result.concat(data);

    if (data.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return result;
}

// ============================================================
// INIT
// ============================================================

async function loadKpiDistance() {
  try {
    setPageStatus('กำลังโหลดข้อมูล KPI ระยะทาง...');

    const [summary, cars] = await Promise.all([
      fetchSupabase('v_kpi_distance_summary', 'select=*'),
      fetchSupabase('v_kpi_distance_car', 'select=*')
    ]);

    summaryData = summary?.[0] || null;
    carData = ensureFleetCoverage(cars || []);

    console.log('KPI Distance Summary:', summaryData);
    console.log('KPI Distance Cars:', carData.length);

    populateBranchFilter();
    render();

    setPageStatus(
      `ข้อมูล KPI ระยะทางโหลดแล้ว • รถ COCO ${formatNumber(carData.length)} คัน`
    );
  } catch (error) {
    console.error('KPI Distance Error:', error);
    setPageStatus(`⚠️ ${error.message}`);
  }
}

// ============================================================
// BRANCH FILTER
// ============================================================

function populateBranchFilter() {
  const select = document.getElementById('branchFilter');
  if (!select) return;

  const currentValue = select.value || '';

  const branches = [
    ...new Set(
      carData
        .map(row => String(row.branch || '').trim())
        .filter(branch => branch && !isExcludedBranch(branch))
    )
  ].sort((a, b) => getBranchOrder(a) - getBranchOrder(b));

  select.innerHTML = `<option value="">ทุกสาขา</option>`;

  branches.forEach(branch => {
    const option = document.createElement('option');
    option.value = branch;
    option.textContent = branch;
    select.appendChild(option);
  });

  if (branches.includes(currentValue)) {
    select.value = currentValue;
  }
}

// ============================================================
// MAIN RENDER
// ============================================================

function render() {
  const branch = document.getElementById('branchFilter')?.value || '';

  const filteredCars = carData.filter(car => {
    if (isExcludedBranch(car.branch)) return false;
    if (!branch) return true;
    return normalizeText(car.branch) === normalizeText(branch);
  });

  const fixedTotalCars = getFleetCountsForBranchFilter(branch).reduce(
    (sum, entry) => sum + entry.count,
    0
  );

  renderSummary(filteredCars, fixedTotalCars);
  renderFleetBreakdown(branch);
  renderCycle();
  renderAlerts(filteredCars);
  renderRankings(filteredCars);
  renderTable(filteredCars);
}

// ============================================================
// SUMMARY
// ============================================================

function renderSummary(cars, fixedTotalCars) {
  const totalCars = fixedTotalCars;

  const targetCars = cars.filter(car => getTargetKm(car) > 0);
  const runningCars = cars.filter(car => toNumber(car.total_km) > 0);

  const totalKm = targetCars.reduce((sum, car) => sum + toNumber(car.total_km), 0);
  const totalTarget = targetCars.reduce((sum, car) => sum + getTargetKm(car), 0);

  const achievement = totalTarget > 0 ? (totalKm / totalTarget) * 100 : 0;
  const avgKmCar = targetCars.length > 0 ? totalKm / targetCars.length : 0;

  const nearTargetCars = targetCars.filter(
    car => getAchievement(car) >= 90 && getForecastOver(car) <= 0
  ).length;

  const forecastOverCars = targetCars.filter(car => getForecastOver(car) > 0).length;

  const forecastKm = targetCars.reduce((sum, car) => sum + toNumber(car.forecast_km), 0);
  const forecastAchievement = totalTarget > 0 ? (forecastKm / totalTarget) * 100 : 0;

  setText('totalCars', formatNumber(totalCars));
  setText('totalKm', formatNumber(totalKm));
  setText('totalTargetKm', formatNumber(totalTarget));
  setText('achievement', totalTarget > 0 ? achievement.toFixed(1) + '%' : '-');
  setText('achievementMain', totalTarget > 0 ? achievement.toFixed(1) + '%' : '-');
  setText('runningCars', formatNumber(runningCars.length));
  setText('avgKmCar', formatNumber(avgKmCar));
  setText('nearTargetCars', formatNumber(nearTargetCars));
  setText('forecastOverCars', formatNumber(forecastOverCars));
  setText('forecastKm', totalTarget > 0 ? formatNumber(forecastKm) : '-');
  setText(
    'forecastAchievement',
    totalTarget > 0 ? forecastAchievement.toFixed(1) + '%' : '-'
  );
  setText('achievementStatus', getAchievementText(achievement));
}

// ============================================================
// FLEET BREAKDOWN (รายละเอียดเล็กๆ ใต้การ์ด "รถ COCO")
// ============================================================

function renderFleetBreakdown(branchFilter) {
  const container = document.getElementById('totalCarsBreakdown');
  if (!container) return;

  const typedEntries = getFleetCountsForBranchFilter(branchFilter).filter(
    entry => entry.vehicleType
  );

  if (!typedEntries.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = typedEntries
    .map(entry => `<span>${escapeHtml(entry.vehicleType)} = ${formatNumber(entry.count)}</span>`)
    .join(' &nbsp;•&nbsp; ');
}

// ============================================================
// GROUP STATUS
// ============================================================

function getGroupStatus(achievement, forecastAchievement, targetTotal) {
  if (!targetTotal || targetTotal <= 0) {
    return { className: 'no-target', text: 'ไม่มี Target' };
  }

  if (achievement >= 100) {
    return { className: 'over', text: 'เกินเป้า' };
  }

  if (forecastAchievement >= 100) {
    return { className: 'forecast', text: 'Forecast เกินเป้า' };
  }

  if (achievement >= 90) {
    return { className: 'near', text: 'ใกล้เป้า' };
  }

  return { className: 'normal', text: 'ปกติ' };
}

// ============================================================
// CYCLE
// ============================================================

function renderCycle() {
  if (!summaryData) return;

  const start = summaryData.cycle_start;
  const end = summaryData.cycle_end;
  const elapsed = toNumber(summaryData.elapsed_days);
  const remaining = toNumber(summaryData.remaining_calendar_days);
  const latest = summaryData.latest_trip_date;

  const cycleText = `${formatThaiDate(start)} – ${formatThaiDate(end)}`;

  setText('cycleValue', cycleText);
  setText('cycleText', cycleText);
  setText('elapsedDays', `${formatNumber(elapsed)} วัน`);
  setText('remainingDays', `${formatNumber(remaining)} วัน`);
  setText('latestDate', formatThaiDate(latest));
}

// ============================================================
// ALERTS
// ============================================================

function renderAlerts(cars) {
  const targetCars = cars.filter(car => getTargetKm(car) > 0);

  const forecastOver = targetCars
    .filter(car => getForecastOver(car) > 0)
    .sort((a, b) => getForecastOver(b) - getForecastOver(a));

  const nearTarget = targetCars
    .filter(car => getAchievement(car) >= 90 && getForecastOver(car) <= 0)
    .sort((a, b) => getAchievement(b) - getAchievement(a));

  renderAlertList('forecastOverList', forecastOver, 'forecast');
  renderAlertList('nearTargetList', nearTarget, 'near');
}

// ============================================================
// ALERT LIST
// ============================================================

function renderAlertList(elementId, cars, type) {
  const element = document.getElementById(elementId);
  if (!element) return;

  if (!cars.length) {
    element.innerHTML = `<li class="empty-alert">ไม่มีรถในกลุ่มนี้</li>`;
    return;
  }

  element.innerHTML = cars
    .slice(0, 10)
    .map(car => {
      const km = toNumber(car.total_km);
      const forecast = toNumber(car.forecast_km);
      const achievement = getAchievement(car);
      const over = getForecastOver(car);

      return `
        <li class="alert-item">
          <div>
            <div class="alert-car">${escapeHtml(car.car_no || '-')}</div>
            <div class="alert-plate">${escapeHtml(car.license_plate || '-')}</div>
            <div class="alert-type">${escapeHtml(normalizeVehicleType(car.vehicle_type))}</div>
          </div>
          <div class="alert-km">
            ${type === 'forecast' ? `Forecast ${formatNumber(forecast)}` : `${formatNumber(km)} KM`}
          </div>
          <div>
            <div class="alert-percent">${achievement.toFixed(1)}%</div>
            ${type === 'forecast' ? `<div class="alert-plate">+${formatNumber(over)} KM</div>` : ''}
          </div>
        </li>
      `;
    })
    .join('');
}

// ============================================================
// RANKINGS
// ============================================================

function renderRankings(cars) {
  const targetCars = cars.filter(car => getTargetKm(car) > 0);

  const highest = [...targetCars]
    .sort((a, b) => toNumber(b.total_km) - toNumber(a.total_km))
    .slice(0, 5);

  const lowest = [...targetCars]
    .sort((a, b) => toNumber(a.total_km) - toNumber(b.total_km))
    .slice(0, 5);

  renderRankingList('highestKmList', highest);
  renderRankingList('lowestKmList', lowest);
}

// ============================================================
// RANKING LIST
// ============================================================

function renderRankingList(elementId, cars) {
  const element = document.getElementById(elementId);
  if (!element) return;

  if (!cars.length) {
    element.innerHTML = `<li class="empty-alert">ไม่มีข้อมูล</li>`;
    return;
  }

  element.innerHTML = cars
    .map(
      (car, index) => `
        <li class="ranking-item">
          <div class="ranking-number">${index + 1}</div>
          <div class="ranking-car">
            ${escapeHtml(car.car_no || '-')}
            <small>${escapeHtml(car.license_plate || '-')} • ${escapeHtml(normalizeVehicleType(car.vehicle_type))}</small>
          </div>
          <div class="ranking-value">${formatNumber(car.total_km)} KM</div>
        </li>
      `
    )
    .join('');
}

// ============================================================
// TABLE
// ============================================================

function renderTable(cars) {
  const tbody = document.getElementById('carTableBody');
  if (!tbody) return;

  if (!cars.length) {
    tbody.innerHTML = `<tr><td colspan="11" class="empty-state">ไม่พบข้อมูลรถ</td></tr>`;
    return;
  }

  const sorted = [...cars].sort((a, b) => toNumber(b.total_km) - toNumber(a.total_km));

  tbody.innerHTML = sorted
    .map(car => {
      const target = getTargetKm(car);
      const km = toNumber(car.total_km);
      const forecast = toNumber(car.forecast_km);

      const achievement = target > 0 ? getAchievement(car) : null;
      const remaining = target > 0 ? Math.max(target - km, 0) : null;
      const over = target > 0 ? getForecastOver(car) : null;
      const forecastAchievement = target > 0 ? (forecast / target) * 100 : null;

      const status = getGroupStatus(achievement, forecastAchievement, target);

      return `
        <tr>
          <td>${escapeHtml(car.car_no || '-')}</td>
          <td>${escapeHtml(car.license_plate || '-')}</td>
          <td>${escapeHtml(car.branch || '-')}</td>
          <td class="vehicle-type-cell">${escapeHtml(normalizeVehicleType(car.vehicle_type))}</td>
          <td class="num">${formatNumber(km)}</td>
          <td class="num target-value">${target > 0 ? formatNumber(target) : '-'}</td>
          <td class="num ${getAchievementClass(achievement)}">
            ${achievement !== null ? achievement.toFixed(1) + '%' : '-'}
          </td>
          <td class="num">${remaining !== null ? formatNumber(remaining) : '-'}</td>
          <td class="num">${target > 0 ? formatNumber(forecast) : '-'}</td>
          <td class="num ${getAchievementClass(forecastAchievement)}">
            ${forecastAchievement !== null ? forecastAchievement.toFixed(1) + '%' : '-'}
            ${over > 0 ? `<small style="display:block;color:#dc2626;">+${formatNumber(over)} KM</small>` : ''}
          </td>
          <td><span class="distance-status ${status.className}">${status.text}</span></td>
        </tr>
      `;
    })
    .join('');
}

// ============================================================
// UTILITIES
// ============================================================

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatNumber(value) {
  return toNumber(value).toLocaleString('th-TH', { maximumFractionDigits: 0 });
}

function normalizeText(text) {
  return String(text || '').trim().toLowerCase();
}

function isExcludedBranch(branch) {
  const normalized = normalizeText(branch);
  return EXCLUDED_BRANCHES.some(excluded => normalizeText(excluded) === normalized);
}

function getBranchOrder(branch) {
  const normalized = normalizeText(branch);
  const index = BRANCH_ORDER.findIndex(b => normalizeText(b) === normalized);
  return index === -1 ? BRANCH_ORDER.length : index;
}

function normalizeVehicleType(type) {
  const value = String(type || '').trim();
  return value || 'ไม่ระบุ';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setPageStatus(text) {
  setText('pageStatus', text);
}

function formatThaiDate(dateStr) {
  if (!dateStr) return '-';

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '-';

  const months = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];

  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear() + 543;

  return `${day} ${month} ${year}`;
}

function getAchievement(car) {
  const target = getTargetKm(car);
  const km = toNumber(car.total_km);
  return target > 0 ? (km / target) * 100 : 0;
}

function getForecastOver(car) {
  const target = getTargetKm(car);
  const forecast = toNumber(car.forecast_km);
  return target > 0 ? forecast - target : 0;
}

function getAchievementClass(achievement) {
  if (achievement === null || achievement === undefined) return '';
  if (achievement >= 100) return 'achievement-danger';
  if (achievement >= 90) return 'achievement-warning';
  return 'achievement-good';
}

function getAchievementText(achievement) {
  if (achievement >= 100) return 'เกินเป้าหมายแล้ว';
  if (achievement >= 90) return 'ใกล้ถึงเป้าหมาย';
  if (achievement >= 50) return 'อยู่ในเกณฑ์ปกติ';
  return 'ยังห่างจากเป้าหมาย';
}

// ============================================================
// EVENTS
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  loadKpiDistance();

  const branchFilter = document.getElementById('branchFilter');
  if (branchFilter) {
    branchFilter.addEventListener('change', render);
  }
});
