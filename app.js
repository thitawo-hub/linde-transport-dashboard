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
    targetCars;


  const actualDrivers =
    branchMaster.drivers;


  // ==========================================================
  // DRIVER RATIO
  // ==========================================================

  const ratio =
    targetCars > 0
      ? actualDrivers / targetCars
      : 0;


  // ==========================================================
  // TARGET DRIVER RATIO
  // ==========================================================

  const targetDriverRatio =
    getDriverRatioTarget(
      branch
    );


  // ==========================================================
  // TARGET DRIVER COUNT
  //
  // จำนวน พขร. ที่ควรมีตาม Target Ratio
  // ==========================================================

  const targetDrivers =
    targetDriverRatio > 0 &&
    targetCars > 0
      ? Math.ceil(
          targetCars *
          targetDriverRatio
        )
      : 0;


  // ==========================================================
  // GAP
  //
  // > 0 = ขาด
  // < 0 = เกิน
  // ==========================================================

  const driverGap =
    targetDrivers > 0
      ? targetDrivers -
        actualDrivers
      : 0;


  // ==========================================================
  // รถ COCO
  // ==========================================================

  setText(
    'cocoCars',
    actualCars > 0
      ? formatNumber(
          actualCars
        )
      : '-'
  );


  // ==========================================================
  // พขร.
  // ==========================================================

  setText(
    'cocoDrivers',
    actualDrivers > 0
      ? formatNumber(
          actualDrivers
        )
      : '-'
  );


  // ==========================================================
  // DRIVER RATIO
  // ==========================================================

  setText(
    'driverRatio',
    targetCars > 0
      ? ratio.toFixed(2)
      : '-'
  );


  // ==========================================================
  // DRIVER RATIO DETAIL
  // ==========================================================

  const ratioDetail =
    document.getElementById(
      'driverRatioDetail'
    );


  if (ratioDetail) {

    if (
      targetDrivers <= 0
    ) {

      ratioDetail.textContent =
        '-';

      ratioDetail.className =
        'card-status';

    } else if (
      driverGap > 0
    ) {

      ratioDetail.textContent =
        `Target ${formatNumber(targetDriverRatio, 3)} | ขาด ${formatNumber(driverGap)} คน`;

      ratioDetail.className =
        'card-status status-low';

    } else if (
      driverGap < 0
    ) {

      ratioDetail.textContent =
        `Target ${formatNumber(targetDriverRatio, 3)} | เกิน ${formatNumber(Math.abs(driverGap))} คน`;

      ratioDetail.className =
        'card-status status-high';

    } else {

      ratioDetail.textContent =
        `Target ${formatNumber(targetDriverRatio, 3)} | ครบตามเป้า`;

      ratioDetail.className =
        'card-status status-ok';

    }

  }


  // ==========================================================
  // TARGET KM
  // ==========================================================

  const targetKm =
    getTargetKm(
      rows,
      branch
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
// DRIVER RATIO TARGET
//
// Branch:
//   ใช้ Target Driver Ratio ของสาขานั้น
//
// All branches:
//   คำนวณจาก Target Cars × Target Ratio
//   ของแต่ละสาขา แล้วรวมจำนวน พขร. ที่ควรมี
//
// รองรับ Target Ratio ที่แตกต่างกันแต่ละสาขา
// ============================================================

function getDriverRatioTarget(
  branch
) {

  // ==========================================================
  // กรณีเลือกสาขา
  // ==========================================================

  if (branch) {

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
              row.target_driver_ratio
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


  // ==========================================================
  // กรณีทุกสาขา
  //
  // ต้องคำนวณ Target Driver รวมก่อน
  // ==========================================================

  const branchMap =
    new Map();


  dashboardData.forEach(
    row => {

      const branchName =
        normalizeText(
          row.branch
        );


      if (
        !branchName
      ) {

        return;

      }


      const targetCars =
        Number(
          row.target_coco_cars
        );


      const targetRatio =
        Number(
          row.target_driver_ratio
        );


      if (
        !Number.isFinite(
          targetCars
        ) ||
        targetCars <= 0
      ) {

        return;

      }


      if (
        !Number.isFinite(
          targetRatio
        ) ||
        targetRatio <= 0
      ) {

        return;

      }


      if (
        !branchMap.has(
          branchName
        )
      ) {

        branchMap.set(
          branchName,
          {
            cars:
              targetCars,

            ratio:
              targetRatio
          }
        );

      }

    }
  );


  let totalTargetCars =
    0;

  let totalTargetDrivers =
    0;


  branchMap.forEach(
    item => {

      totalTargetCars +=
        Number(
          item.cars
        ) || 0;


      totalTargetDrivers +=
        (
          Number(
            item.cars
          ) || 0
        ) *
        (
          Number(
            item.ratio
          ) || 0
        );

    }
  );


  if (
    totalTargetCars <= 0
  ) {

    return 0;

  }


  // ค่า Ratio รวม = Target พขร.รวม / Target รถรวม

  return (
    totalTargetDrivers /
    totalTargetCars
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
      rows,
      branch
    );


  const targetTotalKm =
    getTargetTotalKm(
      branch
    );


  const achievement =
    targetTotalKm > 0
      ? (
          totalKm /
          targetTotalKm
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
    targetTotalKm > 0
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
      rows,
      branch
    );


  const targetTotalKm =
    getTargetTotalKm(
      branch
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


  if (
    cycleDays <= 0
  ) {

    elapsedDays = 0;

  }


  const safeElapsedDays =
    Math.max(
      1,
      elapsedDays
    );


  const workingDayRate =
    Math.min(
      1,
      workingDays /
      safeElapsedDays
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


  const forecastDailyKm =
    avgKmDay *
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
    targetTotalKm > 0
      ? (
          forecastTotalKm /
          targetTotalKm
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
    targetTotalKm > 0
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

    targetTotalKm,

    cycleDays,

    elapsedDays,

    workingDayRate,

    remainingCalendarDays,

    estimatedRemainingWorkingDays,

    forecastDailyKm,

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
    Math.abs(
      value - 100
    ) < 0.05
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
    Number(
      forecast.targetTotalKm
    ) || 0;


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


  const targetTotalKm =
    getTargetTotalKm(
      branch
    );


  const cycleDays =
    getInclusiveDays(
      startDate,
      endDate
    );


  const dailyTarget =
    cycleDays > 0
      ? targetTotalKm /
        cycleDays
      : 0;


  const forecast =
    window.currentForecast || {};


  const forecastDailyKm =
    Number(
      forecast.forecastDailyKm
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
          forecastDailyKm
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
      targetTotalKm
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


  const targetTotalKm =
    getTargetTotalKm(
      branch
    );


  const cycleDays =
    getInclusiveDays(
      startDate,
      endDate
    );


  const dailyTarget =
    cycleDays > 0
      ? targetTotalKm /
        cycleDays
      : 0;


  const forecast =
    window.currentForecast || {};


  const forecastDailyKm =
    Number(
      forecast.forecastDailyKm
    ) || 0;


  const today =
    formatDateInput(
      new Date()
    );


  let actualCumulative =
    0;

  let targetCumulative =
    0;

  let forecastCumulative =
    0;


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
          forecastDailyKm;

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
// ใช้ Master Car เป็นตัวตั้ง
// รถที่มีทะเบียนใน Master Car = COCO
//
// KM สะสม
// = SUM(trips.total_distance)
//
// KM คาดการณ์
// = KM สะสม +
//   ค่าเฉลี่ย KM/วันของรถคันนั้น ×
//   จำนวนวันทำงานที่คาดว่าจะเหลือ
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

      const branchName =
        normalizeText(
          car.branch
        );

      const carNo =
        normalizeCarNo(
          car.car_no
        );

      const plate =
        normalizePlate(
          car.license_plate
        );


      if (
        branchName &&
        carNo
      ) {

        masterByBranchCar.set(
          `${branchName}||${carNo}`,
          car
        );

      }


      if (carNo) {

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
  // TARGET KM BY BRANCH
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
  // INITIALIZE ALL COCO CARS FROM MASTER CAR
  //
  // เพื่อให้รถที่ยังไม่มี KM ก็แสดงเป็น 0
  // ==========================================================

  const carMap =
    new Map();


  masterCarData.forEach(
    masterCar => {

      const masterPlate =
        normalizePlate(
          masterCar.license_plate
        );

      const masterCarNo =
        normalizeCarNo(
          masterCar.car_no
        );

      const masterBranch =
        String(
          masterCar.branch ||
          ''
        ).trim();


      // ไม่มีทะเบียน = ไม่ถือเป็น COCO
      if (
        !masterPlate ||
        !masterCarNo
      ) {

        return;

      }


      if (
        branch &&
        normalizeText(
          masterBranch
        ) !==
        normalizeText(
          branch
        )
      ) {

        return;

      }


      const key =
        `${normalizeText(masterBranch)}||${masterCarNo}`;


      if (
        !carMap.has(
          key
        )
      ) {

        carMap.set(
          key,
          {

            branch:
              masterBranch,

            carNo:
              masterCarNo,

            plate:
              String(
                masterCar.license_plate ||
                ''
              ).trim(),

            vehicleType:
              String(
                masterCar.vehicle_type ||
                ''
              ).trim(),

            km:
              0,

            workingDays:
              new Set()

          }
        );

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
  // MATCH TRIPS TO MASTER CAR
  // ==========================================================

  let matchedTrips =
    0;

  let unmatchedTrips =
    0;


  dateFilteredTrips.forEach(
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


      // ------------------------------------------------------
      // 1. ทะเบียน
      // ------------------------------------------------------

      if (
        tripPlate
      ) {

        masterCar =
          masterByPlate.get(
            tripPlate
          ) || null;

      }


      // ------------------------------------------------------
      // 2. สาขา + เบอร์รถ
      // ------------------------------------------------------

      if (
        !masterCar &&
        tripBranch &&
        tripCarNo
      ) {

        masterCar =
          masterByBranchCar.get(
            `${tripBranch}||${tripCarNo}`
          ) || null;

      }


      // ------------------------------------------------------
      // 3. เบอร์รถ
      // ------------------------------------------------------

      if (
        !masterCar &&
        tripCarNo
      ) {

        masterCar =
          masterByCar.get(
            tripCarNo
          ) || null;

      }


      // ------------------------------------------------------
      // ถ้าไม่เจอ Master Car = LOCO
      // ------------------------------------------------------

      if (!masterCar) {

        unmatchedTrips++;

        return;

      }


      // ------------------------------------------------------
      // Master Car ไม่มีทะเบียน = ไม่ใช่ COCO
      // ------------------------------------------------------

      const masterPlate =
        normalizePlate(
          masterCar.license_plate
        );


      if (!masterPlate) {

        unmatchedTrips++;

        return;

      }


      const finalBranch =
        String(
          masterCar.branch ||
          ''
        ).trim();

      const finalCarNo =
        normalizeCarNo(
          masterCar.car_no
        );


      if (
        !finalBranch ||
        !finalCarNo
      ) {

        unmatchedTrips++;

        return;

      }


      if (
        branch &&
        normalizeText(
          finalBranch
        ) !==
        normalizeText(
          branch
        )
      ) {

        return;

      }


      const key =
        `${normalizeText(finalBranch)}||${finalCarNo}`;


      // ------------------------------------------------------
      // ถ้ามี Master Car แต่ไม่อยู่ใน initial map
      // ------------------------------------------------------

      if (
        !carMap.has(
          key
        )
      ) {

        carMap.set(
          key,
          {

            branch:
              finalBranch,

            carNo:
              finalCarNo,

            plate:
              String(
                masterCar.license_plate ||
                ''
              ).trim(),

            vehicleType:
              String(
                masterCar.vehicle_type ||
                ''
              ).trim(),

            km:
              0,

            workingDays:
              new Set()

          }
        );

      }


      const car =
        carMap.get(
          key
        );


      const km =
        Number(
          trip.total_distance
        ) || 0;


      car.km +=
        km;


      if (
        km > 0
      ) {

        const date =
          normalizeDate(
            trip.work_date
          );


        if (date) {

          car.workingDays.add(
            date
          );

        }

      }


      matchedTrips++;

    }
  );


  // ==========================================================
  // CURRENT DATE / REMAINING DAYS
  // ==========================================================

  const cycleDays =
    getInclusiveDays(
      startDate,
      endDate
    );


  const today =
    formatDateInput(
      new Date()
    );


  let elapsedDays =
    0;


  if (
    today < startDate
  ) {

    elapsedDays =
      0;

  } else if (
    today > endDate
  ) {

    elapsedDays =
      cycleDays;

  } else {

    elapsedDays =
      getInclusiveDays(
        startDate,
        today
      );

  }


  const safeElapsedDays =
    Math.max(
      1,
      elapsedDays
    );


  // ==========================================================
  // RENDER DATA
  // ==========================================================

  carPerformanceData =
    Array.from(
      carMap.values()
    )
    .map(
      car => {

        const workingDays =
          car.workingDays.size;


        const avgKmDay =
          workingDays > 0
            ? car.km /
              workingDays
            : 0;


        const workingDayRate =
          Math.min(
            1,
            workingDays /
            safeElapsedDays
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


        const forecastKm =
          car.km +
          (
            avgKmDay *
            estimatedRemainingWorkingDays
          );


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


        const forecastAchievement =
          target > 0
            ? (
                forecastKm /
                target
              ) *
              100
            : 0;


        return {

          branch:
            car.branch,

          carNo:
            car.carNo,

          plate:
            car.plate,

          vehicleType:
            car.vehicleType,

          km:
            car.km,

          target,

          achievement,

          workingDays,

          avgKmDay,

          workingDayRate,

          remainingCalendarDays,

          estimatedRemainingWorkingDays,

          forecastKm,

          forecastAchievement

        };

      }
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
    'Matched Trips:',
    matchedTrips
  );

  console.log(
    'Unmatched Trips:',
    unmatchedTrips
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
          colspan="7"
          class="empty-state"
        >

          ไม่พบข้อมูลรถ COCO

        </td>

      </tr>

    `;

    return;

  }


  // ==========================================================
  // RENDER TABLE
  // ==========================================================

  tbody.innerHTML =
    carPerformanceData
      .map(
        car => {

          const achievement =
            Number(
              car.achievement
            ) || 0;


          const forecastAchievement =
            Number(
              car.forecastAchievement
            ) || 0;


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


          // --------------------------------------------------
          // Forecast Status
          // --------------------------------------------------

          let forecastStatusClass =
            'status-low';

          let forecastStatusText =
            'ต่ำกว่าเป้า';


          if (
            forecastAchievement >= 100
          ) {

            forecastStatusClass =
              'status-high';

            forecastStatusText =
              'เกินเป้า';

          } else if (
            forecastAchievement >= 90
          ) {

            forecastStatusClass =
              'status-ok';

            forecastStatusText =
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
                ${escapeHtml(
                  car.branch ||
                  '-'
                )}
              </td>

              <td>
                ${formatNumber(
                  car.km
                )}
              </td>

              <td>
                ${
                  car.target > 0
                    ? formatNumber(
                        car.target
                      )
                    : '-'
                }
              </td>

              <td>

                ${
                  car.target > 0
                    ? `
                      <strong>
                        ${formatNumber(
                          car.forecastKm
                        )}
                      </strong>
                    `
                    : '-'
                }

              </td>

              <td>

                ${
                  car.target > 0
                    ? `
                      <span
                        class="car-status ${forecastStatusClass}"
                      >
                        ${forecastAchievement.toFixed(1)}%
                      </span>
                    `
                    : '-'
                }

              </td>

              <td>

                ${
                  car.target > 0
                    ? `
                      <span
                        class="car-status ${forecastStatusClass}"
                      >
                        ${forecastStatusText}
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

    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {

      continue;

    }


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

  const branchKey =
    normalizeText(
      branch
    );


  const values =
    dashboardData
      .filter(
        row =>
          normalizeText(
            row.branch
          ) ===
          branchKey
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


  // ถ้า rows ไม่มีบางสาขา ให้ดึงจาก dashboard ทั้งหมด
  if (
    branchMap.size === 0
  ) {

    dashboardData.forEach(
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

  }


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
  rows,
  branch
) {

  if (branch) {

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


    return values.length
      ? values[0]
      : 0;

  }


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
// Get Target Total KM
//
// Branch = target cars × target KM
//
// All branches = SUM แต่ละสาขา
// ============================================================

function getTargetTotalKm(
  branch
) {

  const branchMap =
    new Map();


  dashboardData.forEach(
    row => {

      const branchName =
        normalizeText(
          row.branch
        );


      if (
        !branchName
      ) {

        return;

      }


      if (
        branch &&
        branchName !==
        normalizeText(
          branch
        )
      ) {

        return;

      }


      const targetCars =
        Number(
          row.target_coco_cars
        );


      const targetKm =
        Number(
          row.target_km_per_car
        );


      if (
        !Number.isFinite(
          targetCars
        ) ||
        targetCars <= 0 ||
        !Number.isFinite(
          targetKm
        ) ||
        targetKm <= 0
      ) {

        return;

      }


      if (
        !branchMap.has(
          branchName
        )
      ) {

        branchMap.set(
          branchName,
          {
            cars:
              targetCars,

            targetKm:
              targetKm
          }
        );

      }

    }
  );


  let total = 0;


  branchMap.forEach(
    item => {

      total +=
        (
          Number(
            item.cars
          ) || 0
        ) *
        (
          Number(
            item.targetKm
          ) || 0
        );

    }
  );


  return total;

}


// ============================================================
// Master Branch Data
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
          colspan="7"
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
