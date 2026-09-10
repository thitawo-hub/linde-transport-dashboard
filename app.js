const SUPABASE_URL = 'https://hhsqijlcebaijtklskag.supabase.co';
const SUPABASE_KEY = 'sb_publishable_z5-j4hCd7dJ50-sLaUKraw_ZgM9ZA4W';

let dashboardData = [];
let kmChart = null;
let kmCumulativeChart = null;
let carPerformanceData = [];

// ============================================================
// INIT
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

  setDefaultBillingCycle();

  document.getElementById('startDate')
    .addEventListener('change', updateDashboard);

  document.getElementById('endDate')
    .addEventListener('change', updateDashboard);

  document.getElementById('branchFilter')
    .addEventListener('change', updateDashboard);

  loadDashboard();

});


// ============================================================
// DEFAULT BILLING CYCLE 26 - 25
// ============================================================

function setDefaultBillingCycle() {

  const today = new Date();

  let start;
  let end;

  if (today.getDate() >= 26) {

    start = new Date(
      today.getFullYear(),
      today.getMonth(),
      26
    );

    end = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      25
    );

  } else {

    start = new Date(
      today.getFullYear(),
      today.getMonth() - 1,
      26
    );

    end = new Date(
      today.getFullYear(),
      today.getMonth(),
      25
    );

  }

  document.getElementById('startDate').value =
    formatDateInput(start);

  document.getElementById('endDate').value =
    formatDateInput(end);

}


// ============================================================
// LOAD DATA
// ============================================================

async function loadDashboard() {

  try {

    const url =
      SUPABASE_URL +
      '/rest/v1/v_dashboard?select=*';

    const response = await fetch(url, {

      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY
      }

    });

    if (!response.ok) {
      throw new Error(
        'Supabase HTTP ' + response.status
      );
    }

    dashboardData = await response.json();

    console.log(
      'Dashboard data:',
      dashboardData
    );

    buildBranchFilter();

    updateDashboard();

  } catch (error) {

    console.error(error);

    const status =
      document.getElementById('status');

    if (status) {
      status.textContent =
        'ไม่สามารถโหลดข้อมูลได้';
    }

  }

}


// ============================================================
// BRANCH FILTER
// ============================================================

function buildBranchFilter() {

  const select =
    document.getElementById('branchFilter');

  if (!select) return;

  const branches = [
    ...new Set(
      dashboardData
        .map(row => row.branch)
        .filter(Boolean)
    )
  ].sort();

  select.innerHTML =
    '<option value="">ทุกสาขา</option>';

  branches.forEach(branch => {

    const option =
      document.createElement('option');

    option.value = branch;
    option.textContent = branch;

    select.appendChild(option);

  });

}


// ============================================================
// UPDATE DASHBOARD
// ============================================================

function updateDashboard() {

  const startDate =
    document.getElementById('startDate').value;

  const endDate =
    document.getElementById('endDate').value;

  const branch =
    document.getElementById('branchFilter').value;

  if (!startDate || !endDate) return;

  const rows =
    dashboardData.filter(row => {

      if (!row.work_date) return false;

      const date =
        String(row.work_date).substring(0, 10);

      if (
        date < startDate ||
        date > endDate
      ) {
        return false;
      }

      if (
        branch &&
        row.branch !== branch
      ) {
        return false;
      }

      return true;

    });


  updateMasterKPI(
    rows,
    branch
  );


  updateKmKPI(
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


  updateCarBreakdown(
    rows,
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


  updateCarPerformance(
    rows,
    startDate,
    endDate,
    branch
  );

}


// ============================================================
// MASTER KPI
// ============================================================

function updateMasterKPI(
  rows,
  branch
) {

  const masterRows =
    getMasterBranchRows(
      dashboardData,
      branch
    );


  const cocoCars =
    sumUniqueMasterValue(
      masterRows,
      'actual_coco_cars'
    );


  const cocoDrivers =
    sumUniqueMasterValue(
      masterRows,
      'actual_coco_drivers'
    );


  const targetCars =
    sumUniqueTargetValue(
      rows,
      'target_coco_cars'
    );


  const targetDrivers =
    sumUniqueTargetValue(
      rows,
      'target_coco_drivers'
    );


  const targetRatio =
    getSingleTargetValue(
      rows,
      'target_driver_ratio'
    );


  const actualCars =
    targetCars || cocoCars;


  const actualRatio =
    actualCars > 0
      ? cocoDrivers / actualCars
      : 0;


  setText(
    'cocoCars',
    formatNumber(actualCars)
  );


  setText(
    'cocoDrivers',
    formatNumber(cocoDrivers)
  );


  setText(
    'driverRatio',
    actualRatio
      ? actualRatio.toFixed(2)
      : '-'
  );


  setText(
    'targetKm',
    formatNumber(
      getSingleTargetValue(
        rows,
        'target_km_per_car'
      )
    )
  );

}


// ============================================================
// KM KPI
// ============================================================

function updateKmKPI(
  rows,
  startDate,
  endDate,
  branch
) {

  const totalKm =
    rows.reduce(
      (sum, row) =>
        sum + getCocoKm(row),
      0
    );


  const workingDates =
    getWorkingDates(rows);


  const workingDays =
    workingDates.length;


  const targetCars =
    getSingleTargetValue(
      rows,
      'target_coco_cars'
    ) || 0;


  const targetKm =
    getSingleTargetValue(
      rows,
      'target_km_per_car'
    ) || 0;


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
      ? avgKmCar / targetKm * 100
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


  setText(
    'status',
    'ข้อมูล ' +
    formatNumber(rows.length) +
    ' รายการ'
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
      (sum, row) =>
        sum + getCocoKm(row),
      0
    );


  const workingDates =
    getWorkingDates(rows);


  const workingDays =
    workingDates.length;


  const targetCars =
    getSingleTargetValue(
      rows,
      'target_coco_cars'
    ) || 0;


  const targetKm =
    getSingleTargetValue(
      rows,
      'target_km_per_car'
    ) || 0;


  const avgKmDay =
    workingDays > 0
      ? totalKm / workingDays
      : 0;


  const cycleDays =
    getInclusiveDays(
      startDate,
      endDate
    );


  const today =
    new Date();


  const start =
    parseDate(startDate);


  const end =
    parseDate(endDate);


  let elapsedDays;


  if (
    today >= start &&
    today <= end
  ) {

    elapsedDays =
      Math.floor(
        (
          today - start
        ) /
        86400000
      ) + 1;

  }

  else if (
    today > end
  ) {

    elapsedDays =
      cycleDays;

  }

  else {

    elapsedDays =
      0;

  }


  elapsedDays =
    Math.max(
      1,
      Math.min(
        elapsedDays,
        cycleDays
      )
    );


  // จำนวนวันปฏิทินที่เหลือ
  const remainingCalendarDays =
    Math.max(
      0,
      cycleDays - elapsedDays
    );


  // สัดส่วนวันวิ่งจริงต่อวันปฏิทิน
  const workingDayRate =
    elapsedDays > 0
      ? workingDays / elapsedDays
      : 0;


  // ประมาณจำนวนวันวิ่งที่เหลือ
  const estimatedRemainingWorkingDays =
    remainingCalendarDays *
    workingDayRate;


  /*
   * Forecast:
   *
   * Actual KM ถึงปัจจุบัน
   * +
   * ค่าเฉลี่ย KM/วัน
   * × จำนวนวันวิ่งที่คาดว่าจะเหลือ
   */

  const forecastTotalKm =
    totalKm +
    (
      avgKmDay *
      estimatedRemainingWorkingDays
    );


  const forecastKmCar =
    targetCars > 0
      ? forecastTotalKm / targetCars
      : 0;


  const forecastAchievement =
    targetKm > 0
      ? forecastKmCar / targetKm * 100
      : 0;


  updatePerformanceStatus(
    forecastAchievement,
    totalKm,
    forecastTotalKm,
    targetCars * targetKm
  );


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

  if (!canvas) return;


  // ---------------------------------------------------------
  // รวม KM ต่อวัน
  // ---------------------------------------------------------

  const dailyKm = {};


  rows.forEach(row => {

    const date =
      String(row.work_date)
        .substring(0, 10);


    if (!date) return;


    if (!dailyKm[date]) {
      dailyKm[date] = 0;
    }


    dailyKm[date] +=
      getCocoKm(row);

  });


  // ---------------------------------------------------------
  // สร้างวันที่ครบทุกวัน
  // ---------------------------------------------------------

  const dates =
    getDateRange(
      startDate,
      endDate
    );


  const actualData =
    dates.map(
      date =>
        dailyKm[date] || 0
    );


  // ---------------------------------------------------------
  // Target
  // ---------------------------------------------------------

  const targetCars =
    getSingleTargetValue(
      rows,
      'target_coco_cars'
    ) || 0;


  const targetKmPerCar =
    getSingleTargetValue(
      rows,
      'target_km_per_car'
    ) || 0;


  const cycleDays =
    dates.length;


  const targetTotalKm =
    targetCars *
    targetKmPerCar;


  const targetPerDay =
    cycleDays > 0
      ? targetTotalKm / cycleDays
      : 0;


  const targetData =
    dates.map(
      () =>
        targetPerDay
    );


  // ---------------------------------------------------------
  // Forecast
  // ---------------------------------------------------------

  const workingDates =
    Object.keys(dailyKm)
      .filter(
        date =>
          dailyKm[date] > 0
      );


  const totalActual =
    actualData.reduce(
      (sum, value) =>
        sum + value,
      0
    );


  const workingDays =
    workingDates.length;


  const avgKmDay =
    workingDays > 0
      ? totalActual / workingDays
      : 0;


  // ---------------------------------------------------------
  // วันนี้
  // ---------------------------------------------------------

  const today =
    formatDateInput(
      new Date()
    );


  // ---------------------------------------------------------
  // Forecast line
  // ---------------------------------------------------------

  const forecastData =
    dates.map(
      date => {

        if (date <= today) {
          return null;
        }

        return avgKmDay;

      }
    );


  // ---------------------------------------------------------
  // Summary
  // ---------------------------------------------------------

  setText(
    'chartActualKm',
    formatNumber(
      totalActual
    )
  );


  setText(
    'chartTargetKm',
    formatNumber(
      targetTotalKm
    )
  );


  const remainingDays =
    dates.filter(
      date =>
        date > today
    ).length;


  const forecastTotal =
    totalActual +
    (
      avgKmDay *
      remainingDays
    );


  setText(
    'chartForecastKm',
    formatNumber(
      forecastTotal
    )
  );


  // ---------------------------------------------------------
  // Destroy chart เดิม
  // ---------------------------------------------------------

  if (kmChart) {
    kmChart.destroy();
  }


  // ---------------------------------------------------------
  // สร้าง Chart
  // ---------------------------------------------------------

  kmChart =
    new Chart(
      canvas.getContext('2d'),
      {

        type: 'bar',

        data: {

          labels:
            dates.map(
              formatDateDisplay
            ),

          datasets: [

            {
              type: 'bar',

              label:
                'Actual KM',

              data:
                actualData,

              borderWidth: 0,

              borderRadius: 4

            },

            {

              type: 'line',

              label:
                'Target KM/วัน',

              data:
                targetData,

              borderWidth: 2,

              pointRadius: 0,

              tension: 0

            },

            {

              type: 'line',

              label:
                'Forecast KM/วัน',

              data:
                forecastData,

              borderWidth: 2,

              borderDash:
                [6, 6],

              pointRadius: 0,

              tension: 0

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

          plugins: {

            legend: {

              position: 'top'

            },

            tooltip: {

              callbacks: {

                label:
                  function(context) {

                    return (
                      context.dataset.label +
                      ': ' +
                      formatNumber(
                        context.raw
                      ) +
                      ' KM'
                    );

                  }

              }

            }

          },

          scales: {

            x: {

              grid: {
                display: false
              }

            },

            y: {

              beginAtZero: true,

              ticks: {

                callback:
                  function(value) {

                    return formatNumber(
                      value
                    );

                  }

              }

            }

          }

        }

      }
    );

}


// ============================================================
// CAR BREAKDOWN
// ============================================================

function updateCarBreakdown(
  rows,
  branch
) {

  const container =
    document.getElementById(
      'carBreakdown'
    );

  if (!container) return;


  const targetCars =
    getSingleTargetValue(
      rows,
      'target_coco_cars'
    ) || 0;


  if (!targetCars) {

    container.innerHTML =
      '<div>ไม่มีข้อมูล</div>';

    return;

  }


  if (
    branch === 'ระยอง'
  ) {

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

      <div class="car-breakdown-total">
        <span>รวมรถ COCO</span>
        <strong>38 คัน</strong>
      </div>

    `;

  }

  else {

    container.innerHTML = `

      <div class="car-breakdown-total">
        <span>รถ COCO</span>

        <strong>
          ${formatNumber(targetCars)} คัน
        </strong>

      </div>

    `;

  }

}


// ============================================================
// KM PERFORMANCE BY CAR
// ============================================================

function updateCarPerformance(
  rows,
  startDate,
  endDate,
  branch
) {

  const tbody =
    document.getElementById(
      'carPerformanceBody'
    );

  if (!tbody) return;


  const carMap =
    new Map();


  // ------------------------------------------------------------
  // รวม KM แยกตามรถ
  // ------------------------------------------------------------

  rows.forEach(row => {

    const carNo =
      String(
        row.car_no || ''
      ).trim();


    const plate =
      String(
        row.license_plate || ''
      ).trim();


    // ต้องมีเบอร์รถ
    if (!carNo) return;


    // COCO = มีทะเบียน
    if (!plate) return;


    const workDate =
      String(
        row.work_date || ''
      ).substring(
        0,
        10
      );


    if (!workDate) return;


    // ตรวจช่วงวันที่
    if (
      workDate < startDate ||
      workDate > endDate
    ) {
      return;
    }


    const km =
      getCocoKm(row);


    if (
      !Number.isFinite(km) ||
      km <= 0
    ) {
      return;
    }


    if (
      !carMap.has(carNo)
    ) {

      carMap.set(
        carNo,
        {
          carNo: carNo,
          plate: plate,
          km: 0
        }
      );

    }


    carMap.get(carNo).km += km;

  });


  // ------------------------------------------------------------
  // Target KM / คัน / รอบ
  // ------------------------------------------------------------

  const targetKm =
    getSingleTargetValue(
      rows,
      'target_km_per_car'
    ) || 0;


  // ------------------------------------------------------------
  // เรียงตามเบอร์รถ
  // ------------------------------------------------------------

  const cars =
    Array.from(
      carMap.values()
    ).sort(
      (a, b) =>
        a.carNo.localeCompare(
          b.carNo,
          undefined,
          {
            numeric: true
          }
        )
    );


  carPerformanceData =
    cars;


  // ------------------------------------------------------------
  // ไม่มีข้อมูล
  // ------------------------------------------------------------

  if (!cars.length) {

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


  // ------------------------------------------------------------
  // แสดงผล
  // ------------------------------------------------------------

  tbody.innerHTML =
    cars.map(
      car => {

        const achievement =
          targetKm > 0
            ? (
                car.km /
                targetKm
              ) * 100
            : null;


        let statusText = '-';
        let statusClass = '';


        if (
          achievement !== null
        ) {

          if (
            achievement < 100
          ) {

            statusText =
              '🔴 ต่ำกว่าเป้า';

            statusClass =
              'status-low';

          }

          else if (
            achievement === 100
          ) {

            statusText =
              '🟢 ถึงเป้า';

            statusClass =
              'status-ok';

          }

          else {

            statusText =
              '🔵 เกินเป้า';

            statusClass =
              'status-high';

          }

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
                car.plate || '-'
              )}
            </td>

            <td>
              ${formatNumber(
                car.km
              )}
            </td>

            <td>
              ${
                targetKm > 0
                  ? formatNumber(
                      targetKm
                    )
                  : '-'
              }
            </td>

            <td>
              ${
                achievement !== null
                  ? achievement.toFixed(1) + '%'
                  : '-'
              }
            </td>

            <td>

              <span
                class="car-status ${statusClass}"
              >
                ${statusText}
              </span>

            </td>

          </tr>
        `;

      }
    ).join('');

}


// ============================================================
// HELPERS
// ============================================================

function getCocoKm(row) {

  const value =
    row.coco_km ??
    row.total_coco_km ??
    row.daily_coco_km ??
    row.actual_coco_km ??
    0;


  return Number(value) || 0;

}


function getWorkingDates(rows) {

  return [
    ...new Set(

      rows

        .filter(
          row =>
            getCocoKm(row) > 0
        )

        .map(
          row =>
            String(
              row.work_date
            ).substring(
              0,
              10
            )
        )

    )
  ].sort();

}


function getMasterBranchRows(
  data,
  branch
) {

  const rows =
    branch
      ? data.filter(
          row =>
            row.branch === branch
        )
      : data;


  const unique = {};


  rows.forEach(row => {

    if (!row.branch) return;


    if (
      !unique[row.branch]
    ) {

      unique[row.branch] =
        row;

    }

  });


  return Object.values(
    unique
  );

}


function sumUniqueMasterValue(
  rows,
  field
) {

  return rows.reduce(
    (
      sum,
      row
    ) =>
      sum +
      (
        Number(
          row[field]
        ) || 0
      ),
    0
  );

}


function sumUniqueTargetValue(
  rows,
  field
) {

  const unique = {};


  rows.forEach(row => {

    if (!row.branch) return;


    if (
      unique[row.branch] ===
      undefined
    ) {

      unique[row.branch] =
        Number(
          row[field]
        ) || 0;

    }

  });


  return Object.values(
    unique
  ).reduce(
    (
      sum,
      value
    ) =>
      sum + value,
    0
  );

}


function getSingleTargetValue(
  rows,
  field
) {

  const values =
    rows

      .map(
        row =>
          Number(
            row[field]
          )
      )

      .filter(
        value =>
          Number.isFinite(value) &&
          value > 0
      );


  if (!values.length) {
    return 0;
  }


  /*
   * ถ้าเลือกทุกสาขา
   * และมีหลาย Target
   * ไม่เอามาบวกกันมั่ว ๆ
   */

  const unique =
    [
      ...new Set(
        values
      )
    ];


  if (
    unique.length === 1
  ) {

    return unique[0];

  }


  /*
   * target cars / target drivers
   * ต้องรวมได้
   *
   * ส่วน KM / ratio
   * ถ้ามีหลายค่าให้ใช้ 0
   */

  if (
    field ===
      'target_coco_cars' ||
    field ===
      'target_coco_drivers'
  ) {

    return values.reduce(
      (
        sum,
        value
      ) =>
        sum + value,
      0
    );

  }


  return 0;

}


function getInclusiveDays(
  startDate,
  endDate
) {

  const start =
    parseDate(
      startDate
    );


  const end =
    parseDate(
      endDate
    );


  return Math.floor(
    (
      end - start
    ) /
    86400000
  ) + 1;

}


function getDateRange(
  startDate,
  endDate
) {

  const result = [];


  let current =
    parseDate(
      startDate
    );


  const end =
    parseDate(
      endDate
    );


  while (
    current <= end
  ) {

    result.push(
      formatDateInput(
        current
      )
    );


    current =
      new Date(
        current.getTime() +
        86400000
      );

  }


  return result;

}


function parseDate(
  value
) {

  const parts =
    value
      .split('-')
      .map(Number);


  return new Date(
    parts[0],
    parts[1] - 1,
    parts[2]
  );

}


function formatDateInput(
  date
) {

  const y =
    date.getFullYear();


  const m =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      '0'
    );


  const d =
    String(
      date.getDate()
    ).padStart(
      2,
      '0'
    );


  return (
    `${y}-${m}-${d}`
  );

}


function formatDateDisplay(
  date
) {

  const parts =
    date.split('-');


  return (
    parts[2] +
    '/' +
    parts[1]
  );

}


function formatNumber(
  value
) {

  if (
    value === null ||
    value === undefined ||
    value === '' ||
    !Number.isFinite(
      Number(value)
    )
  ) {

    return '-';

  }


  return Number(value)
    .toLocaleString(
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

  const element =
    document.getElementById(
      id
    );


  if (element) {

    element.textContent =
      value;

  }

}


function setAchievementStatus(
  elementId,
  achievement
) {

  const element =
    document.getElementById(
      elementId
    );


  if (!element) return;


  element.classList.remove(
    'status-low',
    'status-ok',
    'status-high'
  );


  if (
    achievement === null ||
    achievement === undefined ||
    !Number.isFinite(
      Number(achievement)
    )
  ) {

    element.textContent =
      '-';

    return;

  }


  if (
    achievement < 100
  ) {

    element.textContent =
      'ต่ำกว่าเป้า';

    element.classList.add(
      'status-low'
    );

  }

  else if (
    achievement === 100
  ) {

    element.textContent =
      'ถึงเป้า';

    element.classList.add(
      'status-ok'
    );

  }

  else {

    element.textContent =
      'เกินเป้า';

    element.classList.add(
      'status-high'
    );

  }

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


  if (!canvas) return;


  // ---------------------------------------------------------
  // วันที่ทั้งหมดในรอบ
  // ---------------------------------------------------------

  const dates =
    getDateRange(
      startDate,
      endDate
    );


  // ---------------------------------------------------------
  // รวม Actual KM ต่อวัน
  // ---------------------------------------------------------

  const dailyKm = {};


  rows.forEach(row => {

    const date =
      String(
        row.work_date
      ).substring(
        0,
        10
      );


    if (!date) return;


    if (!dailyKm[date]) {
      dailyKm[date] = 0;
    }


    dailyKm[date] +=
      getCocoKm(row);

  });


  // ---------------------------------------------------------
  // Target
  // ---------------------------------------------------------

  const targetCars =
    getSingleTargetValue(
      rows,
      'target_coco_cars'
    ) || 0;


  const targetKmPerCar =
    getSingleTargetValue(
      rows,
      'target_km_per_car'
    ) || 0;


  const cycleDays =
    dates.length;


  const targetTotalKm =
    targetCars *
    targetKmPerCar;


  const targetPerDay =
    cycleDays > 0
      ? targetTotalKm / cycleDays
      : 0;


  // ---------------------------------------------------------
  // Actual Cumulative
  // ---------------------------------------------------------

  let actualRunning = 0;


  const actualCumulative =
    dates.map(
      date => {

        actualRunning +=
          dailyKm[date] || 0;

        return actualRunning;

      }
    );


  // ---------------------------------------------------------
  // Target Cumulative
  // ---------------------------------------------------------

  const targetCumulative =
    dates.map(
      (
        _,
        index
      ) =>
        targetPerDay *
        (
          index + 1
        )
    );


  // ---------------------------------------------------------
  // Forecast
  // ---------------------------------------------------------

  const today =
    formatDateInput(
      new Date()
    );


  const workingDates =
    Object.keys(
      dailyKm
    )
      .filter(
        date =>
          dailyKm[date] > 0
      );


  const totalActual =
    Object.values(
      dailyKm
    )
      .reduce(
        (
          sum,
          value
        ) =>
          sum + value,
        0
      );


  const workingDays =
    workingDates.length;


  const avgKmDay =
    workingDays > 0
      ? totalActual /
        workingDays
      : 0;


  /*
   * Forecast จะเริ่มจาก Actual ล่าสุด
   * แล้วลากต่อด้วยค่าเฉลี่ย KM/วัน
   */

  let lastActual =
    totalActual;


  let forecastStarted =
    false;


  const forecastData =
    dates.map(
      date => {

        if (
          date <= today
        ) {

          return null;

        }


        if (
          !forecastStarted
        ) {

          forecastStarted =
            true;

          return lastActual;

        }


        const daysAfterToday =
          Math.max(
            0,
            Math.floor(
              (
                parseDate(
                  date
                ) -
                parseDate(
                  today
                )
              ) /
              86400000
            )
          );


        return (
          lastActual +
          (
            avgKmDay *
            daysAfterToday
          )
        );

      }
    );


  // ---------------------------------------------------------
  // ถ้าเลือกช่วงวันที่ย้อนหลัง
  // Forecast ไม่ต้องแสดง
  // ---------------------------------------------------------

  if (
    today > endDate
  ) {

    for (
      let i = 0;
      i < forecastData.length;
      i++
    ) {

      forecastData[i] =
        null;

    }

  }


  // ---------------------------------------------------------
  // Destroy chart เดิม
  // ---------------------------------------------------------

  if (
    kmCumulativeChart
  ) {

    kmCumulativeChart.destroy();

  }


  // ---------------------------------------------------------
  // สร้าง Chart
  // ---------------------------------------------------------

  kmCumulativeChart =
    new Chart(
      canvas.getContext(
        '2d'
      ),
      {

        type: 'line',

        data: {

          labels:
            dates.map(
              formatDateDisplay
            ),

          datasets: [

            {
              label:
                'Actual KM สะสม',

              data:
                actualCumulative,

              borderWidth: 3,

              pointRadius: 2,

              tension: 0.25,

              fill: false
            },

            {

              label:
                'Target KM สะสม',

              data:
                targetCumulative,

              borderWidth: 2,

              pointRadius: 0,

              borderDash:
                [6, 5],

              tension: 0,

              fill: false
            },

            {

              label:
                'Forecast',

              data:
                forecastData,

              borderWidth: 2,

              pointRadius: 0,

              borderDash:
                [3, 4],

              tension: 0,

              fill: false
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

          plugins: {

            legend: {

              position: 'top'

            },

            tooltip: {

              callbacks: {

                label:
                  function(
                    context
                  ) {

                    return (
                      context.dataset.label +
                      ': ' +
                      formatNumber(
                        context.raw
                      ) +
                      ' KM'
                    );

                  }

              }

            }

          },

          scales: {

            x: {

              grid: {
                display: false
              }

            },

            y: {

              beginAtZero: true,

              ticks: {

                callback:
                  function(
                    value
                  ) {

                    return formatNumber(
                      value
                    );

                  }

              }

            }

          }

        }

      }
    );

}


// ============================================================
// PERFORMANCE STATUS
// ============================================================

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


  if (!container) return;


  container.classList.remove(
    'status-on-track',
    'status-at-risk',
    'status-below-target'
  );


  const statusText =
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


  if (!forecastAchievement) {

    statusText.textContent =
      'ไม่มีข้อมูล';

    detail.textContent =
      'ไม่สามารถคำนวณ Forecast ได้';

    achievement.textContent =
      '-';

    return;

  }


  achievement.textContent =
    forecastAchievement.toFixed(
      1
    ) + '%';


  if (
    forecastAchievement >= 100
  ) {

    container.classList.add(
      'status-on-track'
    );


    statusText.textContent =
      '🟢 ON TRACK';


    detail.textContent =
      'Forecast มีแนวโน้มถึงเป้าหมายภายในรอบนี้';

  }

  else if (
    forecastAchievement >= 80
  ) {

    container.classList.add(
      'status-at-risk'
    );


    statusText.textContent =
      '🟡 AT RISK';


    detail.textContent =
      'Forecast ยังต่ำกว่าเป้าหมาย ควรติดตามผลงานอย่างใกล้ชิด';

  }

  else {

    container.classList.add(
      'status-below-target'
    );


    statusText.textContent =
      '🔴 BELOW TARGET';


    detail.textContent =
      'Forecast ต่ำกว่าเป้าหมาย ควรเร่งเพิ่ม KM วิ่งงาน';

  }

}


// ============================================================
// DATE / HTML HELPERS
// ============================================================

function normalizeDate(
  value
) {

  if (!value) return null;


  const date =
    new Date(
      value
    );


  if (
    isNaN(
      date.getTime()
    )
  ) {
    return null;
  }


  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

}


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
