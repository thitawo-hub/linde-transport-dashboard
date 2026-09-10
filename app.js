// ============================================================
// LINDE TRANSPORT DASHBOARD
// app.js
// ============================================================

const SUPABASE_URL =
  'https://hhsqijlcebaijtklskag.supabase.co';

// ใช้ Publishable Key เท่านั้น
const SUPABASE_KEY =
  'sb_publishable_z5-j4hCd7dJ50-sLaUKraw_ZgM9ZA4W';


// ============================================================
// GLOBAL DATA
// ============================================================

let dashboardData = [];
let tripData = [];
let masterCarData = [];

let kmChart = null;
let kmCumulativeChart = null;

let carPerformanceData = [];


// ============================================================
// SUPABASE FETCH
// รองรับข้อมูลมากกว่า 1,000 rows
// ============================================================

async function fetchSupabase(table, params = '') {

  const pageSize = 1000;

  let offset = 0;
  let allData = [];

  while (true) {

    const separator = params ? '&' : '';

    const url =
      `${SUPABASE_URL}/rest/v1/${table}?` +
      `${params}${separator}` +
      `limit=${pageSize}&offset=${offset}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {

      const errorText =
        await response.text();

      throw new Error(
        `Supabase ${table} ${response.status}: ${errorText}`
      );

    }

    const data =
      await response.json();

    if (!Array.isArray(data)) {

      throw new Error(
        `ข้อมูล ${table} ไม่ใช่ Array`
      );

    }

    allData =
      allData.concat(data);

    console.log(
      `${table}: loaded ${allData.length}`
    );

    if (data.length < pageSize) {
      break;
    }

    offset += pageSize;

  }

  return allData;

}


// ============================================================
// LOAD DASHBOARD
// ============================================================

async function loadDashboard() {

  try {

    showLoading();

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
        'select=branch,work_date,car_no,license_plate,total_distance,vehicle_type'
      ),

      fetchSupabase(
        'master_cars',
        'select=branch,car_no,license_plate,vehicle_type,target_km'
      )

    ]);


    dashboardData =
      dashboard || [];

    tripData =
      trips || [];

    masterCarData =
      masterCars || [];


    console.log(
      'Dashboard data:',
      dashboardData.length
    );

    console.log(
      'Trip data:',
      tripData.length
    );

    console.log(
      'Master Car data:',
      masterCarData.length
    );


    setDefaultBillingCycle();

    populateBranchFilter();

    updateDashboard();


  } catch (error) {

    console.error(
      'Load dashboard error:',
      error
    );

    showError(
      error.message ||
      'ไม่สามารถโหลดข้อมูลได้'
    );

  }

}


// ============================================================
// DEFAULT BILLING CYCLE
// รอบ 26 - 25
// ============================================================

function setDefaultBillingCycle() {

  const startInput =
    document.getElementById(
      'startDate'
    );

  const endInput =
    document.getElementById(
      'endDate'
    );

  if (!startInput || !endInput) {
    return;
  }


  const today =
    new Date();

  let year =
    today.getFullYear();

  let month =
    today.getMonth();


  if (today.getDate() >= 26) {

    const start =
      new Date(
        year,
        month,
        26
      );

    const end =
      new Date(
        year,
        month + 1,
        25
      );

    startInput.value =
      formatDateInput(start);

    endInput.value =
      formatDateInput(end);

  } else {

    const start =
      new Date(
        year,
        month - 1,
        26
      );

    const end =
      new Date(
        year,
        month,
        25
      );

    startInput.value =
      formatDateInput(start);

    endInput.value =
      formatDateInput(end);

  }

}


// ============================================================
// BRANCH FILTER
// ============================================================

function populateBranchFilter() {

  const select =
    document.getElementById(
      'branchFilter'
    );

  if (!select) {
    return;
  }


  const branches =
    [
      ...new Set(
        dashboardData
          .map(
            row =>
              String(
                row.branch || ''
              ).trim()
          )
          .filter(Boolean)
      )
    ]
    .sort(
      (a, b) =>
        a.localeCompare(
          b,
          'th'
        )
    );


  const currentValue =
    select.value;


  select.innerHTML = `
    <option value="">
      ทุกสาขา
    </option>
  `;


  branches.forEach(
    branch => {

      const option =
        document.createElement(
          'option'
        );

      option.value =
        branch;

      option.textContent =
        branch;

      select.appendChild(
        option
      );

    }
  );


  if (
    branches.includes(
      currentValue
    )
  ) {

    select.value =
      currentValue;

  }

}


// ============================================================
// MAIN UPDATE
// ============================================================

function updateDashboard() {

  const startDate =
    document.getElementById(
      'startDate'
    )?.value || '';

  const endDate =
    document.getElementById(
      'endDate'
    )?.value || '';

  const branch =
    document.getElementById(
      'branchFilter'
    )?.value || '';


  if (
    !startDate ||
    !endDate
  ) {

    return;

  }


  if (
    startDate >
    endDate
  ) {

    showError(
      'วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด'
    );

    return;

  }


  const rows =
    dashboardData.filter(
      row => {

        const date =
          normalizeDate(
            row.work_date
          );

        if (!date) {
          return false;
        }

        if (
          date < startDate ||
          date > endDate
        ) {

          return false;

        }


        if (branch) {

          return (
            normalizeText(
              row.branch
            ) ===
            normalizeText(
              branch
            )
          );

        }


        return true;

      }
    );


  updateMasterKpi(
    rows,
    branch
  );


  updateKmKpi(
    rows,
    startDate,
    endDate,
    branch
  );


  updateForecast(
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


  updateCarPerformance(
    startDate,
    endDate,
    branch
  );


  updateCarBreakdown(
    rows,
    branch
  );


  updateStatus(
    rows
  );

}


// ============================================================
// MASTER KPI
// ============================================================

function updateMasterKpi(
  rows,
  branch
) {

  const branchMaster =
    getMasterBranchData(
      branch
    );


  const targetCars =
    getTargetCars(
      rows,
      branch
    );


  const actualCars =
    branch
      ? targetCars
      : getTotalTargetCars(
          rows
        );


  const actualDrivers =
    branchMaster.drivers;


  const ratio =
    targetCars > 0
      ? actualDrivers /
        targetCars
      : 0;


  setText(
    'cocoCars',
    actualCars > 0
      ? formatNumber(
          actualCars
        )
      : '-'
  );


  setText(
    'cocoDrivers',
    actualDrivers > 0
      ? formatNumber(
          actualDrivers
        )
      : '-'
  );


  setText(
    'driverRatio',
    targetCars > 0
      ? ratio.toFixed(2)
      : '-'
  );


  const targetKm =
    getTargetKm(
      rows
    );


  setText(
    'targetKm',
    targetKm > 0
      ? formatNumber(
          targetKm
        )
      : '-'
  );

}


// ============================================================
// KM KPI
// ============================================================

function updateKmKpi(
  rows,
  startDate,
  endDate,
  branch
) {

  const totalKm =
    rows.reduce(
      (
        sum,
        row
      ) =>
        sum +
        getCocoKm(row),
      0
    );


  const workingDays =
    getWorkingDays(
      rows
    );


  const avgKmDay =
    workingDays > 0
      ? totalKm /
        workingDays
      : 0;


  const targetCars =
    getTargetCars(
      rows,
      branch
    );


  const avgKmCar =
    targetCars > 0
      ? totalKm /
        targetCars
      : 0;


  const targetKm =
    getTargetKm(
      rows
    );


  const achievement =
    targetKm > 0
      ? (
          avgKmCar /
          targetKm
        ) *
        100
      : 0;


  setText(
    'totalKm',
    formatNumber(
      totalKm
    )
  );


  setText(
    'avgKmDay',
    formatNumber(
      avgKmDay
    )
  );


  setText(
    'avgKmCar',
    formatNumber(
      avgKmCar
    )
  );


  setText(
    'kmAchievement',
    targetKm > 0
      ? achievement.toFixed(1) + '%'
      : '-'
  );


  setAchievementStatus(
    'kmAchievementStatus',
    achievement
  );

}


// ============================================================
// FORECAST
//
// ใช้หลักการ:
//
// Working Day Rate
// = วันวิ่งจริง / วันปฏิทินที่ผ่านไป
//
// Estimated Remaining Working Days
// = วันปฏิทินที่เหลือ × Working Day Rate
//
// Forecast
// = Actual KM +
//   Average KM/Working Day ×
//   Estimated Remaining Working Days
// ============================================================

function updateForecast(
  rows,
  startDate,
  endDate,
  branch
) {

  const totalKm =
    rows.reduce(
      (
        sum,
        row
      ) =>
        sum +
        getCocoKm(row),
      0
    );


  const workingDays =
    getWorkingDays(
      rows
    );


  const avgKmDay =
    workingDays > 0
      ? totalKm /
        workingDays
      : 0;


  const targetCars =
    getTargetCars(
      rows,
      branch
    );


  const targetKm =
    getTargetKm(
      rows
    );


  const cycleDays =
    getInclusiveDays(
      startDate,
      endDate
    );


  const today =
    new Date();


  const todayString =
    formatDateInput(
      today
    );


  let elapsedDays = 0;


  if (
    todayString <
    startDate
  ) {

    elapsedDays = 0;

  } else if (
    todayString >
    endDate
  ) {

    elapsedDays =
      cycleDays;

  } else {

    elapsedDays =
      getInclusiveDays(
        startDate,
        todayString
      );

  }


  elapsedDays =
    Math.max(
      1,
      elapsedDays
    );


  const workingDayRate =
    Math.min(
      1,
      workingDays /
      elapsedDays
    );


  const remainingCalendarDays =
    Math.max(
      0,
      cycleDays -
      elapsedDays
    );


  const estimatedRemainingWorkingDays =
    remainingCalendarDays *
    workingDayRate;


  const forecastTotalKm =
    totalKm +
    (
      avgKmDay *
      estimatedRemainingWorkingDays
    );


  const forecastKmCar =
    targetCars > 0
      ? forecastTotalKm /
        targetCars
      : 0;


  const forecastAchievement =
    targetKm > 0
      ? (
          forecastKmCar /
          targetKm
        ) *
        100
      : 0;


  setText(
    'forecastTotalKm',
    formatNumber(
      forecastTotalKm
    )
  );


  setText(
    'forecastKmCar',
    formatNumber(
      forecastKmCar
    )
  );


  setText(
    'forecastAchievement',
    targetKm > 0
      ? forecastAchievement.toFixed(1) + '%'
      : '-'
  );


  setAchievementStatus(
    'forecastAchievementStatus',
    forecastAchievement
  );


  const note =
    document.getElementById(
      'forecastNote'
    );


  if (note) {

    note.textContent =
      'ประมาณการจากสัดส่วนวันวิ่งจริงในช่วงที่ผ่านมา';

  }


  window.currentForecast = {

    totalKm,

    workingDays,

    avgKmDay,

    targetCars,

    targetKm,

    cycleDays,

    elapsedDays,

    workingDayRate,

    remainingCalendarDays,

    estimatedRemainingWorkingDays,

    forecastTotalKm,

    forecastKmCar,

    forecastAchievement

  };

}


// ============================================================
// ACHIEVEMENT STATUS
// ============================================================

function setAchievementStatus(
  elementId,
  achievement
) {

  const element =
    document.getElementById(
      elementId
    );

  if (!element) {
    return;
  }


  const value =
    Number(
      achievement
    );


  if (
    !Number.isFinite(
      value
    ) ||
    value <= 0
  ) {

    element.textContent =
      '-';

    element.className =
      '';

    return;

  }


  if (
    value < 100
  ) {

    element.textContent =
      'ต่ำกว่าเป้า';

    element.className =
      'status-low';

  } else if (
    value === 100
  ) {

    element.textContent =
      'ถึงเป้า';

    element.className =
      'status-ok';

  } else {

    element.textContent =
      'เกินเป้า';

    element.className =
      'status-high';

  }

}


// ============================================================
// PERFORMANCE STATUS
// ============================================================

function updatePerformanceStatus(
  rows,
  startDate,
  endDate,
  branch
) {

  const statusElement =
    document.getElementById(
      'performanceStatus'
    );

  const textElement =
    document.getElementById(
      'performanceStatusText'
    );

  const detailElement =
    document.getElementById(
      'performanceStatusDetail'
    );

  const achievementElement =
    document.getElementById(
      'performanceStatusAchievement'
    );


  if (
    !statusElement ||
    !textElement ||
    !detailElement ||
    !achievementElement
  ) {

    return;

  }


  const forecast =
    window.currentForecast;


  if (!forecast) {
    return;
  }


  const forecastAchievement =
    Number(
      forecast.forecastAchievement
    ) || 0;


  const totalKm =
    Number(
      forecast.totalKm
    ) || 0;


  const forecastTotalKm =
    Number(
      forecast.forecastTotalKm
    ) || 0;


  const targetTotalKm =
    (
      Number(
        forecast.targetCars
      ) || 0
    ) *
    (
      Number(
        forecast.targetKm
      ) || 0
    );


  statusElement.classList.remove(
    'status-on-track',
    'status-at-risk',
    'status-below-target'
  );


  if (
    forecastAchievement >= 100
  ) {

    statusElement.classList.add(
      'status-on-track'
    );

    textElement.textContent =
      '🟢 ON TRACK';

    detailElement.textContent =
      'Forecast มีแนวโน้มถึงหรือเกินเป้าหมาย';

  } else if (
    forecastAchievement >= 80
  ) {

    statusElement.classList.add(
      'status-at-risk'
    );

    textElement.textContent =
      '🟡 AT RISK';

    detailElement.textContent =
      'Forecast ใกล้เป้าหมาย แต่ควรติดตาม KM อย่างต่อเนื่อง';

  } else {

    statusElement.classList.add(
      'status-below-target'
    );

    textElement.textContent =
      '🔴 BELOW TARGET';

    detailElement.textContent =
      'Forecast ต่ำกว่าเป้าหมาย ควรเร่งเพิ่ม KM วิ่งงาน';

  }


  achievementElement.textContent =
    forecastAchievement > 0
      ? forecastAchievement.toFixed(1) + '%'
      : '-';


  console.log(
    'Performance Status:',
    {
      totalKm,
      forecastTotalKm,
      targetTotalKm,
      forecastAchievement
    }
  );

}


// ============================================================
// KM CHART
//
// Actual = KM จริงรายวัน
// Target = Target KM ต่อวัน
// Forecast = ค่าเฉลี่ย KM/วัน × Working Day Rate
// ============================================================

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

  if (!canvas) {
    return;
  }


  const dailyMap =
    buildDailyKmMap(
      rows
    );


  const dates =
    generateDateRange(
      startDate,
      endDate
    );


  const targetCars =
    getTargetCars(
      rows,
      branch
    );


  const targetKm =
    getTargetKm(
      rows
    );


  const cycleDays =
    getInclusiveDays(
      startDate,
      endDate
    );


  const dailyTarget =
    cycleDays > 0
      ? (
          targetCars *
          targetKm
        ) /
        cycleDays
      : 0;


  const forecast =
    window.currentForecast || {};


  const avgKmDay =
    Number(
      forecast.avgKmDay
    ) || 0;


  const workingDayRate =
    Number(
      forecast.workingDayRate
    ) || 0;


  const totalKm =
    rows.reduce(
      (
        sum,
        row
      ) =>
        sum +
        getCocoKm(row),
      0
    );


  const today =
    formatDateInput(
      new Date()
    );


  const actualData = [];
  const targetData = [];
  const forecastData = [];


  dates.forEach(
    date => {

      const actual =
        Number(
          dailyMap.get(
            date
          ) || 0
        );


      actualData.push(
        actual
      );


      targetData.push(
        dailyTarget
      );


      if (
        date <= today
      ) {

        forecastData.push(
          null
        );

      } else {

        forecastData.push(
          avgKmDay *
          workingDayRate
        );

      }

    }
  );


  setText(
    'chartActualKm',
    formatNumber(
      totalKm
    )
  );


  setText(
    'chartTargetKm',
    formatNumber(
      targetCars *
      targetKm
    )
  );


  setText(
    'chartForecastKm',
    formatNumber(
      forecast.forecastTotalKm ||
      0
    )
  );


  if (kmChart) {

    kmChart.destroy();

  }


  const context =
    canvas.getContext(
      '2d'
    );


  kmChart =
    new Chart(
      context,
      {

        type: 'line',

        data: {

          labels:
            dates.map(
              formatDisplayDate
            ),

          datasets: [

            {
              label:
                'Actual KM',

              data:
                actualData,

              borderWidth:
                2,

              tension:
                0.25
            },

            {
              label:
                'Daily Target',

              data:
                targetData,

              borderWidth:
                2,

              borderDash:
                [6, 6],

              tension:
                0
            },

            {
              label:
                'Forecast',

              data:
                forecastData,

              borderWidth:
                2,

              borderDash:
                [3, 3],

              tension:
                0.25
            }

          ]

        },

        options: {

          responsive:
            true,

          maintainAspectRatio:
            false,

          interaction: {

            mode:
              'index',

            intersect:
              false

          },

          plugins: {

            legend: {

              position:
                'top'

            }

          },

          scales: {

            y: {

              beginAtZero:
                true

            }

          }

        }

      }
    );

}


// ============================================================
// CUMULATIVE KM CHART
// ============================================================

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

  if (!canvas) {
    return;
  }


  const dailyMap =
    buildDailyKmMap(
      rows
    );


  const dates =
    generateDateRange(
      startDate,
      endDate
    );


  const targetCars =
    getTargetCars(
      rows,
      branch
    );


  const targetKm =
    getTargetKm(
      rows
    );


  const cycleDays =
    getInclusiveDays(
      startDate,
      endDate
    );


  const dailyTarget =
    cycleDays > 0
      ? (
          targetCars *
          targetKm
        ) /
        cycleDays
      : 0;


  const forecast =
    window.currentForecast || {};


  const avgKmDay =
    Number(
      forecast.avgKmDay
    ) || 0;


  const workingDayRate =
    Number(
      forecast.workingDayRate
    ) || 0;


  const today =
    formatDateInput(
      new Date()
    );


  let actualCumulative = 0;

  let targetCumulative = 0;

  let forecastCumulative = 0;


  const actualData = [];

  const targetData = [];

  const forecastData = [];


  dates.forEach(
    date => {

      const actual =
        Number(
          dailyMap.get(
            date
          ) || 0
        );


      if (
        date <= today
      ) {

        actualCumulative +=
          actual;

        forecastCumulative =
          actualCumulative;

      } else {

        forecastCumulative +=
          avgKmDay *
          workingDayRate;

      }


      targetCumulative +=
        dailyTarget;


      actualData.push(
        date <= today
          ? actualCumulative
          : null
      );


      targetData.push(
        targetCumulative
      );


      forecastData.push(
        date <= today
          ? null
          : forecastCumulative
      );

    }
  );


  if (
    kmCumulativeChart
  ) {

    kmCumulativeChart.destroy();

  }


  const context =
    canvas.getContext(
      '2d'
    );


  kmCumulativeChart =
    new Chart(
      context,
      {

        type: 'line',

        data: {

          labels:
            dates.map(
              formatDisplayDate
            ),

          datasets: [

            {
              label:
                'Actual KM สะสม',

              data:
                actualData,

              borderWidth:
                2,

              tension:
                0.25
            },

            {
              label:
                'Target KM สะสม',

              data:
                targetData,

              borderWidth:
                2,

              borderDash:
                [6, 6],

              tension:
                0
            },

            {
              label:
                'Forecast KM สะสม',

              data:
                forecastData,

              borderWidth:
                2,

              borderDash:
                [3, 3],

              tension:
                0.25
            }

          ]

        },

        options: {

          responsive:
            true,

          maintainAspectRatio:
            false,

          interaction: {

            mode:
              'index',

            intersect:
              false

          },

          plugins: {

            legend: {

              position:
                'top'

            }

          },

          scales: {

            y: {

              beginAtZero:
                true

            }

          }

        }

      }
    );

}


// ============================================================
// KM PERFORMANCE BY CAR
//
// ใช้ trips โดยตรง
//
// COCO = รถที่พบใน Master Car
//
// Matching:
//
// 1. Branch + Car No
// 2. Car No
// 3. License Plate
//
// จากนั้นใช้ข้อมูล Master Car เป็นตัวจริง
// ============================================================

function updateCarPerformance(
  startDate,
  endDate,
  branch
) {

  const tbody =
    document.getElementById(
      'carPerformanceBody'
    );

  if (!tbody) {
    return;
  }


  // ==========================================================
  // MASTER CAR MAP
  // ==========================================================

  const masterByBranchCar =
    new Map();

  const masterByCar =
    new Map();

  const masterByPlate =
    new Map();


  masterCarData.forEach(
    car => {

      const carNo =
        normalizeCarNo(
          car.car_no
        );

      const plate =
        normalizePlate(
          car.license_plate
        );

      const branchName =
        normalizeText(
          car.branch
        );


      if (carNo) {

        masterByBranchCar.set(
          `${branchName}||${carNo}`,
          car
        );


        if (
          !masterByCar.has(
            carNo
          )
        ) {

          masterByCar.set(
            carNo,
            car
          );

        }

      }


      if (plate) {

        masterByPlate.set(
          plate,
          car
        );

      }

    }
  );


  // ==========================================================
  // TARGET KM
  // ==========================================================

  const targetKmByBranch =
    new Map();


  dashboardData.forEach(
    row => {

      const branchName =
        normalizeText(
          row.branch
        );

      const target =
        Number(
          row.target_km_per_car
        );


      if (
        branchName &&
        Number.isFinite(
          target
        ) &&
        target > 0
      ) {

        if (
          !targetKmByBranch.has(
            branchName
          )
        ) {

          targetKmByBranch.set(
            branchName,
            target
          );

        }

      }

    }
  );


  // ==========================================================
  // FILTER TRIPS BY DATE
  // ==========================================================

  const dateFilteredTrips =
    tripData.filter(
      trip => {

        const date =
          normalizeDate(
            trip.work_date
          );


        if (!date) {
          return false;
        }


        if (
          date < startDate ||
          date > endDate
        ) {

          return false;

        }


        return true;

      }
    );


  // ==========================================================
  // FILTER BRANCH
  // ==========================================================

  const branchFilteredTrips =
    dateFilteredTrips.filter(
      trip => {

        if (!branch) {
          return true;
        }


        return (
          normalizeText(
            trip.branch
          ) ===
          normalizeText(
            branch
          )
        );

      }
    );


  // ==========================================================
  // MATCH STATISTICS
  // ==========================================================

  let matchByBranchCar = 0;

  let matchByCar = 0;

  let matchByPlate = 0;

  let unmatched = 0;


  const matchedTrips = [];


  // ==========================================================
  // MATCH EACH TRIP
  // ==========================================================

  branchFilteredTrips.forEach(
    trip => {

      const tripBranch =
        normalizeText(
          trip.branch
        );

      const tripCarNo =
        normalizeCarNo(
          trip.car_no
        );

      const tripPlate =
        normalizePlate(
          trip.license_plate
        );


      let masterCar =
        null;

      let matchType =
        '';


      // ------------------------------------------------------
      // 1. Branch + Car No
      // ------------------------------------------------------

      if (
        tripBranch &&
        tripCarNo
      ) {

        masterCar =
          masterByBranchCar.get(
            `${tripBranch}||${tripCarNo}`
          ) || null;


        if (masterCar) {

          matchType =
            'branch_car';

          matchByBranchCar++;

        }

      }


      // ------------------------------------------------------
      // 2. Car No
      // ------------------------------------------------------

      if (
        !masterCar &&
        tripCarNo
      ) {

        masterCar =
          masterByCar.get(
            tripCarNo
          ) || null;


        if (masterCar) {

          matchType =
            'car';

          matchByCar++;

        }

      }


      // ------------------------------------------------------
      // 3. License Plate
      // ------------------------------------------------------

      if (
        !masterCar &&
        tripPlate
      ) {

        masterCar =
          masterByPlate.get(
            tripPlate
          ) || null;


        if (masterCar) {

          matchType =
            'plate';

          matchByPlate++;

        }

      }


      // ------------------------------------------------------
      // No Master Car
      // ------------------------------------------------------

      if (!masterCar) {

        unmatched++;

        return;

      }


      // ------------------------------------------------------
      // IMPORTANT
      //
      // ใช้ Master Car เป็นตัวกำหนดรถ COCO
      // ------------------------------------------------------

      const finalCarNo =
        normalizeCarNo(
          masterCar.car_no
        );


      if (!finalCarNo) {
        return;
      }


      const finalBranch =
        String(
          masterCar.branch ||
          trip.branch ||
          ''
        ).trim();


      matchedTrips.push({

        branch:
          finalBranch,

        carNo:
          finalCarNo,

        plate:
          String(
            masterCar.license_plate ||
            trip.license_plate ||
            ''
          ).trim(),

        vehicleType:
          String(
            masterCar.vehicle_type ||
            trip.vehicle_type ||
            ''
          ).trim(),

        km:
          Number(
            trip.total_distance
          ) || 0,

        matchType

      });

    }
  );


  // ==========================================================
  // GROUP BY CAR
  // ==========================================================

  const carMap =
    new Map();


  matchedTrips.forEach(
    item => {

      const key =
        `${normalizeText(item.branch)}||${item.carNo}`;


      if (
        !carMap.has(
          key
        )
      ) {

        carMap.set(
          key,
          {

            branch:
              item.branch,

            carNo:
              item.carNo,

            plate:
              item.plate,

            vehicleType:
              item.vehicleType,

            km:
              0

          }
        );

      }


      const car =
        carMap.get(
          key
        );


      car.km +=
        Number(
          item.km
        ) || 0;


      if (
        !car.plate &&
        item.plate
      ) {

        car.plate =
          item.plate;

      }


      if (
        !car.vehicleType &&
        item.vehicleType
      ) {

        car.vehicleType =
          item.vehicleType;

      }

    }
  );


  // ==========================================================
  // SORT
  // ==========================================================

  carPerformanceData =
    Array.from(
      carMap.values()
    )
    .sort(
      (a, b) => {

        const branchCompare =
          a.branch.localeCompare(
            b.branch,
            'th'
          );


        if (
          branchCompare !== 0
        ) {

          return branchCompare;

        }


        return a.carNo.localeCompare(
          b.carNo,
          undefined,
          {
            numeric:
              true
          }
        );

      }
    );


  // ==========================================================
  // DEBUG
  // ==========================================================

  console.log(
    '========== CAR PERFORMANCE =========='
  );

  console.log(
    'Trips loaded:',
    tripData.length
  );

  console.log(
    'Master Cars:',
    masterCarData.length
  );

  console.log(
    'Trips date filtered:',
    dateFilteredTrips.length
  );

  console.log(
    'Trips branch filtered:',
    branchFilteredTrips.length
  );

  console.log(
    'Match Branch + Car:',
    matchByBranchCar
  );

  console.log(
    'Match Car:',
    matchByCar
  );

  console.log(
    'Match Plate:',
    matchByPlate
  );

  console.log(
    'Unmatched:',
    unmatched
  );

  console.log(
    'COCO Cars:',
    carPerformanceData.length
  );

  console.log(
    'COCO Car Data:',
    carPerformanceData
  );

  console.log(
    '===================================='
  );


  // ==========================================================
  // NO DATA
  // ==========================================================

  if (
    !carPerformanceData.length
  ) {

    tbody.innerHTML = `

      <tr>

        <td
          colspan="6"
          class="empty-state"
        >

          <div
            style="
              font-weight:700;
              margin-bottom:12px;
              color:#374151;
            "
          >
            ไม่พบข้อมูล KM ของรถ COCO
          </div>

          <div
            style="
              font-size:12px;
              line-height:1.9;
              color:#6b7280;
            "
          >

            Trips ที่โหลดทั้งหมด:
            <strong>
              ${tripData.length.toLocaleString()}
            </strong>

            <br>

            Master Car:
            <strong>
              ${masterCarData.length.toLocaleString()}
            </strong>

            <br>

            Trips ในช่วงวันที่:
            <strong>
              ${dateFilteredTrips.length.toLocaleString()}
            </strong>

            <br>

            Trips หลังกรองสาขา:
            <strong>
              ${branchFilteredTrips.length.toLocaleString()}
            </strong>

            <br>

            Match Branch + Car:
            <strong>
              ${matchByBranchCar.toLocaleString()}
            </strong>

            <br>

            Match Car:
            <strong>
              ${matchByCar.toLocaleString()}
            </strong>

            <br>

            Match ทะเบียน:
            <strong>
              ${matchByPlate.toLocaleString()}
            </strong>

            <br>

            ไม่ Match:
            <strong>
              ${unmatched.toLocaleString()}
            </strong>

          </div>

        </td>

      </tr>

    `;

    return;

  }


  // ==========================================================
  // RENDER
  // ==========================================================

  tbody.innerHTML =
    carPerformanceData
      .map(
        car => {

          const target =
            Number(
              targetKmByBranch.get(
                normalizeText(
                  car.branch
                )
              ) || 0
            );


          const achievement =
            target > 0
              ? (
                  car.km /
                  target
                ) *
                100
              : 0;


          let statusClass =
            'status-low';

          let statusText =
            'ต่ำกว่าเป้า';


          if (
            achievement >= 100
          ) {

            statusClass =
              'status-high';

            statusText =
              'เกินเป้า';

          } else if (
            achievement >= 90
          ) {

            statusClass =
              'status-ok';

            statusText =
              'ใกล้เป้า';

          }


          return `

            <tr>

              <td>
                <strong>
                  ${escapeHtml(
                    car.carNo
                  )}
                </strong>
              </td>

              <td>
                ${escapeHtml(
                  car.plate ||
                  '-'
                )}
              </td>

              <td>
                ${Number(
                  car.km
                ).toLocaleString(
                  'th-TH',
                  {
                    maximumFractionDigits:
                      0
                  }
                )}
              </td>

              <td>
                ${
                  target > 0
                    ? Number(
                        target
                      ).toLocaleString(
                        'th-TH',
                        {
                          maximumFractionDigits:
                            0
                        }
                      )
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

        }
      )
      .join('');

}


// ============================================================
// CAR BREAKDOWN
// ============================================================

function updateCarBreakdown(
  rows,
  branch
) {

  const element =
    document.getElementById(
      'carBreakdown'
    );

  if (!element) {
    return;
  }


  const targetCars =
    getTargetCars(
      rows,
      branch
    );


  if (!targetCars) {

    element.innerHTML =
      '<div class="empty-state">-</div>';

    return;

  }


  if (
    normalizeText(
      branch
    ) ===
    normalizeText(
      'ระยอง'
    )
  ) {

    element.innerHTML = `

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

      <div class="car-breakdown-total">
        <span>รวม</span>
        <strong>38 คัน</strong>
      </div>

    `;

    return;

  }


  element.innerHTML = `

    <div class="car-breakdown-total">

      <span>
        รถ COCO
      </span>

      <strong>
        ${formatNumber(
          targetCars
        )} คัน
      </strong>

    </div>

  `;

}


// ============================================================
// STATUS
// ============================================================

function updateStatus(
  rows
) {

  const element =
    document.getElementById(
      'status'
    );

  if (!element) {
    return;
  }


  const totalRows =
    rows.length;


  element.textContent =
    `ข้อมูล ${formatNumber(
      totalRows
    )} รายการ`;

}


// ============================================================
// HELPERS
// ============================================================

// ============================================================
// Normalize Text
// ============================================================

function normalizeText(
  value
) {

  return String(
    value || ''
  )
    .trim()
    .replace(
      /\s+/g,
      ' '
    )
    .toLowerCase();

}


// ============================================================
// Normalize Car No
// ============================================================

function normalizeCarNo(
  value
) {

  return String(
    value || ''
  )
    .trim()
    .replace(
      /\s+/g,
      ''
    );

}


// ============================================================
// Normalize License Plate
// ============================================================

function normalizePlate(
  value
) {

  return String(
    value || ''
  )
    .trim()
    .replace(
      /\s+/g,
      ''
    )
    .replace(
      /-/g,
      ''
    )
    .replace(
      /\//g,
      ''
    )
    .replace(
      /\./g,
      ''
    )
    .replace(
      /_/g,
      ''
    )
    .toLowerCase();

}


// ============================================================
// Normalize Date
// ============================================================

function normalizeDate(
  value
) {

  if (!value) {
    return '';
  }


  if (
    typeof value ===
    'string'
  ) {

    if (
      /^\d{4}-\d{2}-\d{2}/
        .test(value)
    ) {

      return value.substring(
        0,
        10
      );

    }

  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return '';

  }


  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      '0'
    ),
    String(
      date.getDate()
    ).padStart(
      2,
      '0'
    )
  ].join('-');

}


// ============================================================
// Date Input
// ============================================================

function formatDateInput(
  date
) {

  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      '0'
    ),
    String(
      date.getDate()
    ).padStart(
      2,
      '0'
    )
  ].join('-');

}


// ============================================================
// Display Date
// ============================================================

function formatDisplayDate(
  date
) {

  const parts =
    String(
      date
    ).split('-');


  if (
    parts.length !== 3
  ) {

    return date;

  }


  return `${parts[2]}/${parts[1]}`;

}


// ============================================================
// Date Range
// ============================================================

function generateDateRange(
  startDate,
  endDate
) {

  const result = [];


  let current =
    new Date(
      `${startDate}T00:00:00`
    );


  const end =
    new Date(
      `${endDate}T00:00:00`
    );


  while (
    current <= end
  ) {

    result.push(
      formatDateInput(
        current
      )
    );


    current.setDate(
      current.getDate() + 1
    );

  }


  return result;

}


// ============================================================
// Inclusive Days
// ============================================================

function getInclusiveDays(
  startDate,
  endDate
) {

  if (
    !startDate ||
    !endDate
  ) {

    return 0;

  }


  const start =
    new Date(
      `${startDate}T00:00:00`
    );


  const end =
    new Date(
      `${endDate}T00:00:00`
    );


  const diff =
    end.getTime() -
    start.getTime();


  return (
    Math.floor(
      diff /
      86400000
    ) + 1
  );

}


// ============================================================
// Working Days
// ============================================================

function getWorkingDays(
  rows
) {

  const dates =
    new Set();


  rows.forEach(
    row => {

      const date =
        normalizeDate(
          row.work_date
        );


      const km =
        getCocoKm(
          row
        );


      if (
        date &&
        km > 0
      ) {

        dates.add(
          date
        );

      }

    }
  );


  return dates.size;

}


// ============================================================
// Daily KM Map
// ============================================================

function buildDailyKmMap(
  rows
) {

  const map =
    new Map();


  rows.forEach(
    row => {

      const date =
        normalizeDate(
          row.work_date
        );


      if (!date) {
        return;
      }


      const km =
        getCocoKm(
          row
        );


      map.set(
        date,
        (
          map.get(
            date
          ) || 0
        ) +
        km
      );

    }
  );


  return map;

}


// ============================================================
// Get COCO KM
// ============================================================

function getCocoKm(
  row
) {

  const candidates = [

    row.coco_km,

    row.total_coco_km,

    row.daily_coco_km,

    row.actual_coco_km

  ];


  for (
    const value of candidates
  ) {

    const number =
      Number(
        value
      );


    if (
      Number.isFinite(
        number
      )
    ) {

      return number;

    }

  }


  return 0;

}


// ============================================================
// Get Target Cars
// ============================================================

function getTargetCars(
  rows,
  branch
) {

  if (branch) {

    const values =
      rows
        .map(
          row =>
            Number(
              row.target_coco_cars
            )
        )
        .filter(
          value =>
            Number.isFinite(
              value
            ) &&
            value > 0
        );


    if (
      values.length
    ) {

      return values[0];

    }


    return getTargetCarsFromAllData(
      branch
    );

  }


  return getTotalTargetCars(
    dashboardData
  );

}


// ============================================================
// Target Cars From All Data
// ============================================================

function getTargetCarsFromAllData(
  branch
) {

  const values =
    dashboardData
      .filter(
        row =>
          normalizeText(
            row.branch
          ) ===
          normalizeText(
            branch
          )
      )
      .map(
        row =>
          Number(
            row.target_coco_cars
          )
      )
      .filter(
        value =>
          Number.isFinite(
            value
          ) &&
          value > 0
      );


  return values.length
    ? values[0]
    : 0;

}


// ============================================================
// Total Target Cars
//
// ไม่ SUM ซ้ำทุก row
// ============================================================

function getTotalTargetCars(
  rows
) {

  const branchMap =
    new Map();


  rows.forEach(
    row => {

      const branch =
        normalizeText(
          row.branch
        );


      const cars =
        Number(
          row.target_coco_cars
        );


      if (
        !branch ||
        !Number.isFinite(
          cars
        ) ||
        cars <= 0
      ) {

        return;

      }


      if (
        !branchMap.has(
          branch
        )
      ) {

        branchMap.set(
          branch,
          cars
        );

      }

    }
  );


  let total = 0;


  branchMap.forEach(
    value => {

      total +=
        Number(
          value
        ) || 0;

    }
  );


  return total;

}


// ============================================================
// Get Target KM
// ============================================================

function getTargetKm(
  rows
) {

  const values =
    rows
      .map(
        row =>
          Number(
            row.target_km_per_car
          )
      )
      .filter(
        value =>
          Number.isFinite(
            value
          ) &&
          value > 0
      );


  if (
    !values.length
  ) {

    return 0;

  }


  if (
    new Set(
      values
    ).size === 1
  ) {

    return values[0];

  }


  return 0;

}


// ============================================================
// Master Branch Data
//
// Cars = Master Car
// Drivers = actual_coco_drivers จาก v_dashboard
// ============================================================

function getMasterBranchData(
  branch
) {

  if (!branch) {

    const cars =
      new Set();


    masterCarData.forEach(
      car => {

        const carNo =
          normalizeCarNo(
            car.car_no
          );


        if (carNo) {

          cars.add(
            carNo
          );

        }

      }
    );


    const drivers =
      getAllActualDrivers();


    return {

      cars:
        cars.size,

      drivers

    };

  }


  const cars =
    new Set();


  masterCarData.forEach(
    car => {

      if (
        normalizeText(
          car.branch
        ) !==
        normalizeText(
          branch
        )
      ) {

        return;

      }


      const carNo =
        normalizeCarNo(
          car.car_no
        );


      if (carNo) {

        cars.add(
          carNo
        );

      }

    }
  );


  const branchRows =
    dashboardData.filter(
      row =>
        normalizeText(
          row.branch
        ) ===
        normalizeText(
          branch
        )
    );


  const driverValues =
    branchRows
      .map(
        row =>
          Number(
            row.actual_coco_drivers
          )
      )
      .filter(
        value =>
          Number.isFinite(
            value
          )
      );


  const drivers =
    driverValues.length
      ? driverValues[0]
      : 0;


  return {

    cars:
      cars.size,

    drivers

  };

}


// ============================================================
// All Actual Drivers
// ============================================================

function getAllActualDrivers() {

  const branches =
    new Map();


  dashboardData.forEach(
    row => {

      const branch =
        normalizeText(
          row.branch
        );


      const drivers =
        Number(
          row.actual_coco_drivers
        );


      if (
        branch &&
        Number.isFinite(
          drivers
        )
      ) {

        if (
          !branches.has(
            branch
          )
        ) {

          branches.set(
            branch,
            drivers
          );

        }

      }

    }
  );


  let total = 0;


  branches.forEach(
    value => {

      total +=
        Number(
          value
        ) || 0;

    }
  );


  return total;

}


// ============================================================
// Set Text
// ============================================================

function setText(
  id,
  value
) {

  const element =
    document.getElementById(
      id
    );


  if (element) {

    element.textContent =
      value;

  }

}


// ============================================================
// Number Format
// ============================================================

function formatNumber(
  value
) {

  const number =
    Number(
      value
    );


  if (
    !Number.isFinite(
      number
    )
  ) {

    return '-';

  }


  return number.toLocaleString(
    'th-TH',
    {
      maximumFractionDigits:
        0
    }
  );

}


// ============================================================
// Escape HTML
// ============================================================

function escapeHtml(
  value
) {

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


// ============================================================
// Loading
// ============================================================

function showLoading() {

  const ids = [

    'totalKm',

    'avgKmDay',

    'avgKmCar',

    'kmAchievement',

    'forecastTotalKm',

    'forecastKmCar',

    'forecastAchievement'

  ];


  ids.forEach(
    id =>
      setText(
        id,
        'กำลังโหลด...'
      )
  );


  const tbody =
    document.getElementById(
      'carPerformanceBody'
    );


  if (tbody) {

    tbody.innerHTML = `

      <tr>

        <td
          colspan="6"
          class="empty-state"
        >

          กำลังโหลดข้อมูล...

        </td>

      </tr>

    `;

  }

}


// ============================================================
// Error
// ============================================================

function showError(
  message
) {

  console.error(
    message
  );


  const status =
    document.getElementById(
      'status'
    );


  if (status) {

    status.textContent =
      `⚠️ ${message}`;

  }

}


// ============================================================
// EVENT LISTENERS
// ============================================================

document.addEventListener(
  'DOMContentLoaded',
  () => {

    const start =
      document.getElementById(
        'startDate'
      );

    const end =
      document.getElementById(
        'endDate'
      );

    const branch =
      document.getElementById(
        'branchFilter'
      );


    if (start) {

      start.addEventListener(
        'change',
        updateDashboard
      );

    }


    if (end) {

      end.addEventListener(
        'change',
        updateDashboard
      );

    }


    if (branch) {

      branch.addEventListener(
        'change',
        updateDashboard
      );

    }


    loadDashboard();

  }
);
