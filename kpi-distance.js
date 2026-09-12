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
let dailyData = [];

let distanceChart = null;

// ============================================================
// CONFIG
// ============================================================

const EXCLUDED_BRANCHES = ['linde oil'];

const BRANCH_ORDER = ['ระยอง', 'ท่าลาน', 'บางปะอิน', 'หาดใหญ่'];

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

    const [summary, cars, daily] = await Promise.all([
      fetchSupabase('v_kpi_distance_summary', 'select=*'),
      fetchSupabase('v_kpi_distance_car', 'select=*'),
      fetchSupabase('v_kpi_distance_daily', 'select=*')
    ]);

    summaryData = summary?.[0] || null;
    carData = cars || [];
    dailyData = daily || [];

    console.log('KPI Distance Summary:', summaryData);
    console.log('KPI Distance Cars:', carData.length);
    console.log('KPI Distance Daily:', dailyData.length);

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

  const filteredDaily = dailyData.filter(row => {
    if (isExcludedBranch(row.branch)) return false;
    if (!branch) return true;
    return normalizeText(row.branch) === normalizeText(branch);
  });

  renderSummary(filteredCars);
  renderCycle();
  renderVehicleTypeSummary(filteredCars);
  renderAlerts(filteredCars);
  renderRankings(filteredCars);
  renderChart(filteredDaily);
  renderTable(filteredCars);
}

// ============================================================
// SUMMARY
// ============================================================

function renderSummary(cars) {
  const totalCars = cars.length;

  const targetCars = cars.filter(car => toNumber(car.target_km) > 0);
  const runningCars = cars.filter(car => toNumber(car.total_km) > 0);

  const totalKm = targetCars.reduce((sum, car) => sum + toNumber(car.total_km), 0);
  const totalTarget = targetCars.reduce((sum, car) => sum + toNumber(car.target_km), 0);

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
// VEHICLE TYPE SUMMARY
// ============================================================

function renderVehicleTypeSummary(cars) {
  const tbody = document.getElementById('vehicleTypeSummaryBody');
  if (!tbody) return;

  if (!cars.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="empty-state">ไม่พบข้อมูลรถ</td></tr>`;
    return;
  }

  const groups = new Map();

  cars.forEach(car => {
    const branch = String(car.branch || '-').trim();
    const vehicleType = normalizeVehicleType(car.vehicle_type);
    const key = `${normalizeText(branch)}|||${normalizeText(vehicleType)}`;

    if (!groups.has(key)) {
      groups.set(key, { branch, vehicleType, cars: [] });
    }

    groups.get(key).cars.push(car);
  });

  const rows = [...groups.values()].sort((a, b) => {
    const branchDiff = getBranchOrder(a.branch) - getBranchOrder(b.branch);
    if (branchDiff !== 0) return branchDiff;
    return a.vehicleType.localeCompare(b.vehicleType, 'th');
  });

  tbody.innerHTML = rows
    .map(group => {
      const carsInGroup = group.cars;
      const totalCars = carsInGroup.length;

      const targetCars = carsInGroup.filter(car => toNumber(car.target_km) > 0);
      const targetTotal = targetCars.reduce((sum, car) => sum + toNumber(car.target_km), 0);
      const totalKm = targetCars.reduce((sum, car) => sum + toNumber(car.total_km), 0);
      const forecastTotal = targetCars.reduce((sum, car) => sum + toNumber(car.forecast_km), 0);

      const achievement = targetTotal > 0 ? (totalKm / targetTotal) * 100 : null;
      const forecastAchievement = targetTotal > 0 ? (forecastTotal / targetTotal) * 100 : null;
      const avgTarget = targetCars.length > 0 ? targetTotal / targetCars.length : null;
      const forecastOver = forecastTotal - targetTotal;

      const status = getGroupStatus(achievement, forecastAchievement, targetTotal);

      return `
        <tr>
          <td><strong>${escapeHtml(group.branch)}</strong></td>
          <td><span class="vehicle-type-badge">${escapeHtml(group.vehicleType)}</span></td>
          <td class="num">${formatNumber(totalCars)}</td>
          <td class="num target-value">${avgTarget !== null ? formatNumber(avgTarget) : '-'}</td>
          <td class="num target-value">${targetTotal > 0 ? formatNumber(targetTotal) : '-'}</td>
          <td class="num">${formatNumber(totalKm)}</td>
          <td class="num ${getAchievementClass(achievement)}">
            ${achievement !== null ? achievement.toFixed(1) + '%' : '-'}
          </td>
          <td class="num">${targetTotal > 0 ? formatNumber(forecastTotal) : '-'}</td>
          <td class="num ${getAchievementClass(forecastAchievement)}">
            ${forecastAchievement !== null ? forecastAchievement.toFixed(1) + '%' : '-'}
            ${forecastOver > 0 ? `<small style="display:block;color:#dc2626;">+${formatNumber(forecastOver)} KM</small>` : ''}
          </td>
          <td><span class="distance-status ${status.className}">${status.text}</span></td>
        </tr>
      `;
    })
    .join('');
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
  const targetCars = cars.filter(car => toNumber(car.target_km) > 0);

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
  const targetCars = cars.filter(car => toNumber(car.target_km) > 0);

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
// CHART
// ============================================================

function renderChart(dailyRows) {
  const canvas = document.getElementById('distanceDailyChart');
  if (!canvas) return;

  // NOTE: ปรับชื่อ field ตรงนี้ให้ตรงกับ column จริงใน view
  // v_kpi_distance_daily ถ้าชื่อ column ไม่ตรงกับที่เดาไว้ (trip_date / km)
  const grouped = new Map();

  dailyRows.forEach(row => {
    const date = row.trip_date || row.date;
    if (!date) return;

    const km = toNumber(row.km ?? row.total_km ?? row.distance_km);
    grouped.set(date, (grouped.get(date) || 0) + km);
  });

  const sortedDates = [...grouped.keys()].sort((a, b) => new Date(a) - new Date(b));
  const labels = sortedDates.map(d => formatThaiDate(d));
  const dailyValues = sortedDates.map(d => grouped.get(d));

  let running = 0;
  const cumulativeValues = dailyValues.map(v => (running += v));

  if (distanceChart) {
    distanceChart.destroy();
  }

  distanceChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'KM สะสม',
          data: cumulativeValues,
          borderColor: '#111827',
          backgroundColor: 'rgba(17,24,39,0.08)',
          fill: true,
          tension: 0.3,
          pointRadius: 2
        },
        {
          label: 'KM รายวัน',
          data: dailyValues,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37,99,235,0.08)',
          fill: false,
          tension: 0.3,
          pointRadius: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top' }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
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
      const target = toNumber(car.target_km);
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
  const target = toNumber(car.target_km);
  const km = toNumber(car.total_km);
  return target > 0 ? (km / target) * 100 : 0;
}

function getForecastOver(car) {
  const target = toNumber(car.target_km);
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
