const SUPABASE_URL = 'https://hhsqijlcebaijtklskag.supabase.co';
const SUPABASE_KEY = 'sb_publishable_z5-j4hCd7dJ50-sLaUKraw_ZgM9ZA4W';

let dashboardData = [];
let tripData = [];
let masterCarData = [];

let kmChart = null;
let kmCumulativeChart = null;
let carPerformanceData = [];


/* =========================================================
   SUPABASE
========================================================= */

async function fetchSupabase(table, params = '') {

  const url =
    `${SUPABASE_URL}/rest/v1/${table}?${params}`;

  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Supabase ${table} ${response.status}: ${text}`
    );
  }

  return await response.json();
}


/* =========================================================
   LOAD DASHBOARD
========================================================= */

async function loadDashboard() {

  try {

    const [
      dashboard,
      trips,
      masterCars
    ] = await Promise.all([

      fetchSupabase(
        'v_dashboard',
        'select=*'
      ),

      fetchSupabase(
        'trips',
        [
          'select=branch,work_date,car_no,license_plate,total_distance',
          'order=work_date.asc',
          'limit=50000'
        ].join('&')
      ),

      fetchSupabase(
        'master_cars',
        [
          'select=branch,car_no,license_plate,vehicle_type,target_km',
          'order=car_no.asc',
          'limit=50000'
        ].join('&')
      )

    ]);

    dashboardData = dashboard || [];
    tripData = trips || [];
    masterCarData = masterCars || [];

    console.log('Dashboard data:', dashboardData.length);
    console.log('Trip data:', tripData.length);
    console.log('Master Car data:', masterCarData.length);

    setDefaultBillingCycle();

    populateBranchFilter();

    updateDashboard();

  } catch (error) {

    console.error(error);

    const status = document.getElementById('status');

    if (status) {
      status.textContent =
        'เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + error.message;
    }
  }
}


/* =========================================================
   DEFAULT BILLING CYCLE 26 - 25
========================================================= */

function setDefaultBillingCycle() {

  const startInput = document.getElementById('startDate');
  const endInput = document.getElementById('endDate');

  if (!startInput || !endInput) return;

  const today = new Date();

  let year = today.getFullYear();
  let month = today.getMonth();

  let start;
  let end;

  if (today.getDate() >= 26) {

    start = new Date(year, month, 26);
    end = new Date(year, month + 1, 25);

  } else {

    start = new Date(year, month - 1, 26);
    end = new Date(year, month, 25);

  }

  startInput.value = formatDateInput(start);
  endInput.value = formatDateInput(end);
}


function formatDateInput(date) {

  const y = date.getFullYear();

  const m = String(
    date.getMonth() + 1
  ).padStart(2, '0');

  const d = String(
    date.getDate()
  ).padStart(2, '0');

  return `${y}-${m}-${d}`;
}


/* =========================================================
   BRANCH FILTER
========================================================= */

function populateBranchFilter() {

  const select =
    document.getElementById('branchFilter');

  if (!select) return;

  const branches = [
    ...new Set(
      dashboardData
        .map(row => String(row.branch || '').trim())
        .filter(Boolean)
    )
  ].sort();

  select.innerHTML =
    `<option value="">ทุกสาขา</option>`;

  branches.forEach(branch => {

    const option =
      document.createElement('option');

    option.value = branch;
    option.textContent = branch;

    select.appendChild(option);

  });
}


/* =========================================================
   MAIN UPDATE
========================================================= */

function updateDashboard() {

  const startDate =
    document.getElementById('startDate')?.value;

  const endDate =
    document.getElementById('endDate')?.value;

  const branch =
    document.getElementById('branchFilter')?.value || '';

  if (!startDate || !endDate) return;

  const rows =
    dashboardData.filter(row => {

      const date =
        normalizeDate(row.work_date);

      if (!date) return false;

      if (date < startDate || date > endDate) {
        return false;
      }

      if (
        branch &&
        String(row.branch || '').trim() !== branch
      ) {
        return false;
      }

      return true;
    });


  updateMasterKPI(rows);

  updateKmKPI(
    rows,
    startDate,
    endDate,
    branch
  );

  updateKmChart(
    rows,
    startDate,
    endDate,
    branch
  );

  updateCumulativeKmChart(
    rows,
    startDate,
    endDate,
    branch
  );

  updatePerformanceStatus(
    rows,
    startDate,
    endDate,
    branch
  );

  /*
   * สำคัญ:
   * ตารางรถใช้ tripData ไม่ใช่ rows จาก v_dashboard
   */
  updateCarPerformance(
    startDate,
    endDate,
    branch
  );

}


/* =========================================================
   MASTER KPI
========================================================= */

function updateMasterKPI(rows) {

  const branchMap = new Map();

  rows.forEach(row => {

    const branch =
      String(row.branch || '').trim();

    if (!branch) return;

    if (!branchMap.has(branch)) {

      branchMap.set(branch, {

        targetCars:
          Number(row.target_coco_cars || 0),

        targetDrivers:
          Number(row.target_coco_drivers || 0),

        actualCars:
          Number(row.actual_coco_cars || 0),

        actualDrivers:
          Number(row.actual_coco_drivers || 0)

      });

    }

  });


  let targetCars = 0;
  let targetDrivers = 0;
  let actualCars = 0;
  let actualDrivers = 0;


  branchMap.forEach(item => {

    targetCars += item.targetCars;
    targetDrivers += item.targetDrivers;
    actualCars += item.actualCars;
    actualDrivers += item.actualDrivers;

  });


  const displayCars =
    branchMap.size === 1
      ? targetCars
      : targetCars;

  const ratio =
    displayCars > 0
      ? actualDrivers / displayCars
      : 0;


  setText(
    'cocoCars',
    formatNumber(displayCars)
  );

  setText(
    'cocoDrivers',
    formatNumber(actualDrivers)
  );

  setText(
    'driverRatio',
    ratio
      ? ratio.toFixed(2)
      : '-'
  );


  const targetKmValues = [
    ...new Set(
      rows
        .map(row =>
          Number(row.target_km_per_car || 0)
        )
        .filter(v => v > 0)
    )
  ];


  setText(
    'targetKm',
    targetKmValues.length === 1
      ? formatNumber(targetKmValues[0])
      : '-'
  );
}


/* =========================================================
   KM KPI
========================================================= */

function updateKmKPI(
  rows,
  startDate,
  endDate,
  branch
) {

  let totalKm = 0;

  const workingDates = new Set();


  rows.forEach(row => {

    const km = getCocoKm(row);

    if (km > 0) {

      totalKm += km;

      const date =
        normalizeDate(row.work_date);

      if (date) {
        workingDates.add(date);
      }

    }

  });


  const workingDays =
    workingDates.size;


  const targetCars =
    getTargetCars(rows);


  const targetKm =
    getSingleTargetValue(
      rows,
      'target_km_per_car'
    );


  const avgKmDay =
    workingDays > 0
      ? totalKm / workingDays
      : 0;


  const avgKmCar =
    targetCars > 0
      ? totalKm / targetCars
      : 0;


  const achievement =
    targetKm > 0
      ? (avgKmCar / targetKm) * 100
      : 0;


  setText(
    'totalKm',
    formatNumber(totalKm)
  );

  setText(
    'avgKmDay',
    formatNumber(avgKmDay)
  );

  setText(
    'avgKmCar',
    formatNumber(avgKmCar)
  );

  setText(
    'kmAchievement',
    achievement
      ? achievement.toFixed(1) + '%'
      : '-'
  );


  setAchievementStatus(
    'kmAchievementStatus',
    achievement
  );


  /* =========================
     FORECAST
  ========================= */

  const cycleDays =
    diffDays(
      startDate,
      endDate
    ) + 1;


  const today =
    formatDateInput(new Date());


  let elapsedDays;

  if (today < startDate) {

    elapsedDays = 0;

  } else if (today > endDate) {

    elapsedDays = cycleDays;

  } else {

    elapsedDays =
      diffDays(
        startDate,
        today
      ) + 1;

  }


  const workingDayRate =
    elapsedDays > 0
      ? workingDays / elapsedDays
      : 0;


  const remainingCalendarDays =
    Math.max(
      0,
      cycleDays - elapsedDays
    );


  const estimatedRemainingWorkingDays =
    remainingCalendarDays *
    workingDayRate;


  const forecastTotalKm =
    totalKm +
    avgKmDay *
    estimatedRemainingWorkingDays;


  const forecastKmCar =
    targetCars > 0
      ? forecastTotalKm / targetCars
      : 0;


  const forecastAchievement =
    targetKm > 0
      ? (forecastKmCar / targetKm) * 100
      : 0;


  const targetTotalKm =
    targetCars *
    targetKm;


  setText(
    'forecastTotalKm',
    formatNumber(forecastTotalKm)
  );

  setText(
    'forecastKmCar',
    formatNumber(forecastKmCar)
  );

  setText(
    'forecastAchievement',
    forecastAchievement
      ? forecastAchievement.toFixed(1) + '%'
      : '-'
  );


  setAchievementStatus(
    'forecastAchievementStatus',
    forecastAchievement
  );


  setText(
    'forecastNote',
    'ประมาณการจากสัดส่วนวันวิ่งจริงในช่วงที่ผ่านมา'
  );


  updatePerformanceStatus(
    forecastAchievement,
    totalKm,
    forecastTotalKm,
    targetTotalKm
  );


  updateCarBreakdown(
    rows,
    targetCars
  );


  setText(
    'status',
    `${rows.length.toLocaleString()} รายการ`
  );
}


/* =========================================================
   CAR BREAKDOWN
========================================================= */

function updateCarBreakdown(
  rows,
  targetCars
) {

  const container =
    document.getElementById('carBreakdown');

  if (!container) return;


  const branch =
    rows.length
      ? String(rows[0].branch || '').trim()
      : '';


  if (branch === 'ระยอง') {

    container.innerHTML = `
      <div class="car-breakdown-item">
        <span>ระยองสัญญา 1</span>
        <strong>30 คัน</strong>
      </div>

      <div class="car-breakdown-item">
        <span>ระยองสัญญา 2</span>
        <strong>5 คัน</strong>
      </div>

      <div class="car-breakdown-item">
        <span>ระยอง10W</span>
        <strong>3 คัน</strong>
      </div>
    `;

  } else {

    container.innerHTML = `
      <div class="car-breakdown-item">
        <span>รถ COCO</span>
        <strong>${formatNumber(targetCars)} คัน</strong>
      </div>
    `;

  }
}


/* =========================================================
   KM PERFORMANCE BY CAR
   ใช้ trips + master_cars
========================================================= */

function updateCarPerformance(
  startDate,
  endDate,
  branch
) {

  const tbody =
    document.getElementById(
      'carPerformanceBody'
    );

  if (!tbody) return;


  /*
   * สร้าง Set ทะเบียน COCO
   * COCO = ทะเบียนที่มีอยู่ใน Master Car
   */

  const masterPlateSet =
    new Set(

      masterCarData

        .map(car =>
          normalizePlate(
            car.license_plate
          )
        )

        .filter(Boolean)

    );


  /*
   * สร้างข้อมูล Target KM แยกตามสาขา
   */

  const targetKmByBranch =
    new Map();


  dashboardData.forEach(row => {

    const b =
      String(row.branch || '').trim();

    const target =
      Number(
        row.target_km_per_car || 0
      );

    if (
      b &&
      target > 0 &&
      !targetKmByBranch.has(b)
    ) {

      targetKmByBranch.set(
        b,
        target
      );

    }

  });


  /*
   * Filter trips ตามช่วงวันที่ / สาขา
   */

  const filteredTrips =
    tripData.filter(trip => {

      const date =
        normalizeDate(
          trip.work_date
        );

      if (!date) return false;

      if (
        date < startDate ||
        date > endDate
      ) {
        return false;
      }


      const tripBranch =
        String(
          trip.branch || ''
        ).trim();


      if (
        branch &&
        tripBranch !== branch
      ) {
        return false;
      }


      /*
       * COCO check
       */

      const plate =
        normalizePlate(
          trip.license_plate
        );


      if (
        !plate ||
        !masterPlateSet.has(plate)
      ) {
        return false;
      }


      return true;

    });


  /*
   * Group ตาม branch + car_no
   */

  const carMap =
    new Map();


  filteredTrips.forEach(trip => {

    const branchName =
      String(
        trip.branch || ''
      ).trim();


    const carNo =
      String(
        trip.car_no || ''
      ).trim();


    const plate =
      String(
        trip.license_plate || ''
      ).trim();


    if (!carNo) return;


    const key =
      `${branchName}||${carNo}`;


    if (!carMap.has(key)) {

      carMap.set(key, {

        branch: branchName,

        carNo: carNo,

        plate: plate,

        km: 0

      });

    }


    const item =
      carMap.get(key);


    item.km += Number(
      trip.total_distance || 0
    );

  });


  carPerformanceData =
    [...carMap.values()]


      .sort((a, b) => {

        if (
          a.branch !== b.branch
        ) {

          return a.branch.localeCompare(
            b.branch,
            'th'
          );

        }

        return a.carNo.localeCompare(
          b.carNo,
          'th'
        );

      });


  /*
   * ไม่มีข้อมูล
   */

  if (
    carPerformanceData.length === 0
  ) {

    tbody.innerHTML = `
      <tr>
        <td
          colspan="6"
          class="empty-state"
        >
          ไม่พบข้อมูล KM ของรถ COCO
        </td>
      </tr>
    `;

    return;

  }


  /*
   * Render
   */

  tbody.innerHTML =
    carPerformanceData.map(car => {

      const target =
        targetKmByBranch.get(
          car.branch
        ) || 0;


      /*
       * สำคัญ:
       * Target = KM/คัน/เดือน
       *
       * ดังนั้นในตารางนี้
       * ใช้ Target เป็นค่าเป้าหมายต่อรถ
       */

      const achievement =
        target > 0
          ? (car.km / target) * 100
          : 0;


      let statusClass =
        'status-low';

      let statusText =
        'ต่ำกว่าเป้า';


      if (achievement >= 100) {

        statusClass =
          'status-high';

        statusText =
          'เกินเป้า';

      } else if (achievement >= 80) {

        statusClass =
          'status-ok';

        statusText =
          'ใกล้เป้า';

      }


      return `

        <tr>

          <td>
            ${escapeHtml(car.carNo)}
          </td>

          <td>
            ${escapeHtml(car.plate)}
          </td>

          <td>
            ${formatNumber(car.km)}
          </td>

          <td>
            ${
              target > 0
                ? formatNumber(target)
                : '-'
            }
          </td>

          <td>
            ${
              target > 0
                ? achievement.toFixed(1) + '%'
                : '-'
            }
          </td>

          <td>

            ${
              target > 0

                ? `
                  <span
                    class="car-status ${statusClass}"
                  >
                    ${statusText}
                  </span>
                `

                : '-'
            }

          </td>

        </tr>

      `;

    }).join('');

}


/* =========================================================
   NORMALIZE PLATE
========================================================= */

function normalizePlate(value) {

  return String(
    value || ''
  )
    .trim()
    .replace(/\s+/g, '')
    .replace(/-/g, '')
    .toUpperCase();

}


/* =========================================================
   KM CHART
========================================================= */

function updateKmChart(
  rows,
  startDate,
  endDate,
  branch
) {

  const canvas =
    document.getElementById(
      'kmChart'
    );

  if (!canvas) return;


  const dailyMap =
    new Map();


  rows.forEach(row => {

    const date =
      normalizeDate(
        row.work_date
      );

    if (!date) return;


    const km =
      getCocoKm(row);


    dailyMap.set(
      date,
      (dailyMap.get(date) || 0) + km
    );

  });


  const dates =
    getDateRange(
      startDate,
      endDate
    );


  const targetCars =
    getTargetCars(rows);


  const targetKm =
    getSingleTargetValue(
      rows,
      'target_km_per_car'
    );


  const cycleDays =
    dates.length;


  const dailyTarget =
    cycleDays > 0
      ? (
          targetCars *
          targetKm
        ) / cycleDays
      : 0;


  const today =
    formatDateInput(
      new Date()
    );


  const workingDays =
    [...dailyMap.values()]
      .filter(km => km > 0)
      .length;


  const totalKm =
    [...dailyMap.values()]
      .reduce(
        (sum, km) => sum + km,
        0
      );


  const avgKmDay =
    workingDays > 0
      ? totalKm / workingDays
      : 0;


  const actualData =
    dates.map(
      date =>
        dailyMap.get(date) || 0
    );


  const targetData =
    dates.map(
      () => dailyTarget
    );


  let cumulativeActual = 0;
  let cumulativeTarget = 0;


  const cumulativeActualData =
    dates.map(
      date => {

        cumulativeActual +=
          dailyMap.get(date) || 0;

        return cumulativeActual;

      }
    );


  const cumulativeTargetData =
    dates.map(
      () => {

        cumulativeTarget +=
          dailyTarget;

        return cumulativeTarget;

      }
    );


  let forecastStart =
    cumulativeActual;


  const forecastData =
    dates.map(
      date => {

        if (date <= today) {

          return null;

        }

        forecastStart +=
          avgKmDay;

        return forecastStart;

      }
    );


  const actualTotal =
    totalKm;


  const targetTotal =
    targetCars *
    targetKm;


  const forecastTotal =
    forecastStart;


  setText(
    'chartActualKm',
    formatNumber(actualTotal)
  );

  setText(
    'chartTargetKm',
    formatNumber(targetTotal)
  );

  setText(
    'chartForecastKm',
    formatNumber(forecastTotal)
  );


  if (kmChart) {

    kmChart.destroy();

  }


  kmChart =
    new Chart(
      canvas,
      {

        type: 'line',

        data: {

          labels: dates,

          datasets: [

            {

              label: 'Actual KM',

              data: actualData,

              borderWidth: 2,

              tension: 0.25,

              pointRadius: 2

            },

            {

              label: 'Daily Target',

              data: targetData,

              borderWidth: 2,

              borderDash: [6, 6],

              pointRadius: 0

            },

            {

              label: 'Forecast',

              data: forecastData,

              borderWidth: 2,

              borderDash: [4, 4],

              pointRadius: 0

            }

          ]

        },

        options: {

          responsive: true,

          maintainAspectRatio: false,

          interaction: {

            mode: 'index',

            intersect: false

          },

          scales: {

            y: {

              beginAtZero: true

            }

          }

        }

      }

    );

}


/* =========================================================
   CUMULATIVE CHART
========================================================= */

function updateCumulativeKmChart(
  rows,
  startDate,
  endDate,
  branch
) {

  const canvas =
    document.getElementById(
      'kmCumulativeChart'
    );

  if (!canvas) return;


  const dates =
    getDateRange(
      startDate,
      endDate
    );


  const dailyMap =
    new Map();


  rows.forEach(row => {

    const date =
      normalizeDate(
        row.work_date
      );

    if (!date) return;


    dailyMap.set(
      date,
      (dailyMap.get(date) || 0) +
      getCocoKm(row)
    );

  });


  const targetCars =
    getTargetCars(rows);


  const targetKm =
    getSingleTargetValue(
      rows,
      'target_km_per_car'
    );


  const dailyTarget =
    dates.length > 0
      ? (
          targetCars *
          targetKm
        ) / dates.length
      : 0;


  let actual = 0;
  let target = 0;


  const actualData = [];
  const targetData = [];


  dates.forEach(date => {

    actual +=
      dailyMap.get(date) || 0;

    target +=
      dailyTarget;


    actualData.push(actual);
    targetData.push(target);

  });


  if (kmCumulativeChart) {

    kmCumulativeChart.destroy();

  }


  kmCumulativeChart =
    new Chart(
      canvas,
      {

        type: 'line',

        data: {

          labels: dates,

          datasets: [

            {

              label: 'Actual KM สะสม',

              data: actualData,

              borderWidth: 2,

              tension: 0.25,

              pointRadius: 2

            },

            {

              label: 'Target KM สะสม',

              data: targetData,

              borderWidth: 2,

              borderDash: [6, 6],

              pointRadius: 0

            }

          ]

        },

        options: {

          responsive: true,

          maintainAspectRatio: false,

          interaction: {

            mode: 'index',

            intersect: false

          },

          scales: {

            y: {

              beginAtZero: true

            }

          }

        }

      }

    );

}


/* =========================================================
   PERFORMANCE STATUS
========================================================= */

function updatePerformanceStatus(
  forecastAchievement,
  totalKm,
  forecastTotalKm,
  targetTotalKm
) {

  const container =
    document.getElementById(
      'performanceStatus'
    );

  const text =
    document.getElementById(
      'performanceStatusText'
    );

  const detail =
    document.getElementById(
      'performanceStatusDetail'
    );

  const achievement =
    document.getElementById(
      'performanceStatusAchievement'
    );


  if (
    !container ||
    !text ||
    !detail ||
    !achievement
  ) return;


  container.classList.remove(
    'status-on-track',
    'status-at-risk',
    'status-below-target'
  );


  achievement.textContent =
    forecastAchievement
      ? forecastAchievement.toFixed(1) + '%'
      : '-';


  if (forecastAchievement >= 100) {

    container.classList.add(
      'status-on-track'
    );

    text.textContent =
      '🟢 ON TRACK';

    detail.textContent =
      'Forecast มีแนวโน้มถึงหรือเกินเป้าหมาย';

  } else if (
    forecastAchievement >= 80
  ) {

    container.classList.add(
      'status-at-risk'
    );

    text.textContent =
      '🟡 AT RISK';

    detail.textContent =
      'Forecast มีแนวโน้มต่ำกว่าเป้าหมายเล็กน้อย';

  } else {

    container.classList.add(
      'status-below-target'
    );

    text.textContent =
      '🔴 BELOW TARGET';

    detail.textContent =
      'Forecast ต่ำกว่าเป้าหมาย ควรเร่งเพิ่ม KM วิ่งงาน';

  }

}


/* =========================================================
   HELPERS
========================================================= */

function getCocoKm(row) {

  return Number(
    row.coco_km ??
    row.total_coco_km ??
    row.daily_coco_km ??
    row.actual_coco_km ??
    0
  );

}


function getTargetCars(rows) {

  const values =
    rows
      .map(row =>
        Number(
          row.target_coco_cars || 0
        )
      )
      .filter(v => v > 0);


  return values.length
    ? Math.max(...values)
    : 0;

}


function getSingleTargetValue(
  rows,
  field
) {

  const values =
    [
      ...new Set(
        rows
          .map(row =>
            Number(
              row[field] || 0
            )
          )
          .filter(v => v > 0)
      )
    ];


  return values.length === 1
    ? values[0]
    : 0;

}


function normalizeDate(value) {

  if (!value) return '';

  if (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}/.test(value)
  ) {

    return value.substring(
      0,
      10
    );

  }


  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '';
  }


  return formatDateInput(date);

}


function getDateRange(
  startDate,
  endDate
) {

  const result = [];

  let current =
    new Date(
      startDate + 'T00:00:00'
    );

  const end =
    new Date(
      endDate + 'T00:00:00'
    );


  while (current <= end) {

    result.push(
      formatDateInput(current)
    );

    current.setDate(
      current.getDate() + 1
    );

  }


  return result;

}


function diffDays(
  startDate,
  endDate
) {

  const start =
    new Date(
      startDate + 'T00:00:00'
    );

  const end =
    new Date(
      endDate + 'T00:00:00'
    );


  return Math.round(
    (
      end - start
    ) / (
      1000 *
      60 *
      60 *
      24
    )
  );

}


function formatNumber(value) {

  return Number(
    value || 0
  ).toLocaleString(
    'en-US',
    {
      maximumFractionDigits: 0
    }
  );

}


function setText(
  id,
  value
) {

  const el =
    document.getElementById(id);

  if (el) {
    el.textContent = value;
  }

}


function setAchievementStatus(
  elementId,
  achievement
) {

  const el =
    document.getElementById(
      elementId
    );

  if (!el) return;


  el.classList.remove(
    'status-low',
    'status-ok',
    'status-high'
  );


  if (!achievement) {

    el.textContent = '-';
    return;

  }


  if (achievement < 100) {

    el.textContent =
      'ต่ำกว่าเป้า';

    el.classList.add(
      'status-low'
    );

  } else if (
    achievement === 100
  ) {

    el.textContent =
      'ถึงเป้า';

    el.classList.add(
      'status-ok'
    );

  } else {

    el.textContent =
      'เกินเป้า';

    el.classList.add(
      'status-high'
    );

  }

}


function escapeHtml(value) {

  return String(
    value ?? ''
  )
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    );

}


/* =========================================================
   EVENT
========================================================= */

document
  .getElementById('startDate')
  ?.addEventListener(
    'change',
    updateDashboard
  );


document
  .getElementById('endDate')
  ?.addEventListener(
    'change',
    updateDashboard
  );


document
  .getElementById('branchFilter')
  ?.addEventListener(
    'change',
    updateDashboard
  );


/* =========================================================
   START
========================================================= */

loadDashboard();
