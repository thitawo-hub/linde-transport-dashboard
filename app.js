const SUPABASE_URL =
  'https://hhsqijlcebaijtklskag.supabase.co';

const SUPABASE_KEY =
  'sb_publishable_z5-j4hCd7dJ50-sLaUKraw_ZgM9ZA4W';


/* =========================================================
   GLOBAL DATA
========================================================= */

let dashboardData = [];
let tripData = [];
let masterCarData = [];

let kmChart = null;
let kmCumulativeChart = null;
let carPerformanceData = [];


/* =========================================================
   SUPABASE FETCH
   - Supabase จำกัดผลลัพธ์ต่อ request ได้ 1,000 rows
   - ตัวนี้จะดึงทีละ 1,000 จนครบ
========================================================= */

async function fetchSupabase(
  table,
  params = '',
  pageSize = 1000
) {

  let allData = [];
  let offset = 0;

  while (true) {

    const separator =
      params ? '&' : '';

    const url =
      `${SUPABASE_URL}/rest/v1/${table}?` +
      `${params}${separator}` +
      `limit=${pageSize}&offset=${offset}`;

    const response =
      await fetch(url, {
        method: 'GET',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization:
            `Bearer ${SUPABASE_KEY}`
        }
      });

    if (!response.ok) {

      const text =
        await response.text();

      throw new Error(
        `Supabase ${table} ${response.status}: ${text}`
      );

    }

    const data =
      await response.json();

    allData =
      allData.concat(data);

    console.log(
      `${table}: loaded ${allData.length}`
    );

    if (
      data.length < pageSize
    ) {
      break;
    }

    offset += pageSize;
  }

  return allData;
}


/* =========================================================
   LOAD DASHBOARD
========================================================= */

async function loadDashboard() {

  try {

    setText(
      'status',
      'กำลังโหลดข้อมูล...'
    );


    /*
     * โหลด 3 ชุดพร้อมกัน
     */

    const [
      dashboard,
      trips,
      masterCars
    ] = await Promise.all([

      fetchSupabase(
        'v_dashboard',
        'select=*',
        1000
      ),

      fetchSupabase(
        'trips',
        [
          'select=branch,work_date,car_no,license_plate,total_distance',
          'order=work_date.asc'
        ].join('&'),
        1000
      ),

      fetchSupabase(
        'master_cars',
        [
          'select=branch,car_no,license_plate,vehicle_type,target_km',
          'order=car_no.asc'
        ].join('&'),
        1000
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


    /*
     * ตั้งรอบ 26-25
     */

    setDefaultBillingCycle();


    /*
     * สร้าง Branch Filter
     */

    populateBranchFilter();


    /*
     * แสดง Dashboard
     */

    updateDashboard();


  } catch (error) {

    console.error(
      'LOAD DASHBOARD ERROR:',
      error
    );


    setText(
      'status',
      'เกิดข้อผิดพลาดในการโหลดข้อมูล'
    );

  }

}


/* =========================================================
   DEFAULT BILLING CYCLE
   26 - 25
========================================================= */

function setDefaultBillingCycle() {

  const startInput =
    document.getElementById(
      'startDate'
    );

  const endInput =
    document.getElementById(
      'endDate'
    );


  if (
    !startInput ||
    !endInput
  ) {
    return;
  }


  const today =
    new Date();


  const year =
    today.getFullYear();

  const month =
    today.getMonth();

  let start;
  let end;


  if (
    today.getDate() >= 26
  ) {

    start =
      new Date(
        year,
        month,
        26
      );

    end =
      new Date(
        year,
        month + 1,
        25
      );

  } else {

    start =
      new Date(
        year,
        month - 1,
        26
      );

    end =
      new Date(
        year,
        month,
        25
      );

  }


  startInput.value =
    formatDateInput(start);

  endInput.value =
    formatDateInput(end);

}


/* =========================================================
   BRANCH FILTER
========================================================= */

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
          .map(row =>
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


  select.innerHTML =
    `
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

}


/* =========================================================
   MAIN DASHBOARD
========================================================= */

function updateDashboard() {

  const startDate =
    document.getElementById(
      'startDate'
    )?.value;


  const endDate =
    document.getElementById(
      'endDate'
    )?.value;


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


        if (
          branch &&
          String(
            row.branch || ''
          ).trim() !== branch
        ) {
          return false;
        }


        return true;

      }
    );


  /*
   * Master KPI
   */

  updateMasterKPI(rows);


  /*
   * KM KPI + Forecast
   */

  updateKmKPI(
    rows,
    startDate,
    endDate,
    branch
  );


  /*
   * Daily KM Chart
   */

  updateKmChart(
    rows,
    startDate,
    endDate,
    branch
  );


  /*
   * Cumulative KM Chart
   */

  updateCumulativeKmChart(
    rows,
    startDate,
    endDate,
    branch
  );


  /*
   * Car Performance
   *
   * สำคัญ:
   * ใช้ tripData ไม่ใช่ v_dashboard
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

function updateMasterKPI(
  rows
) {

  const branchMap =
    new Map();


  rows.forEach(
    row => {

      const branch =
        String(
          row.branch || ''
        ).trim();


      if (!branch) {
        return;
      }


      if (
        !branchMap.has(branch)
      ) {

        branchMap.set(
          branch,
          {

            targetCars:
              Number(
                row.target_coco_cars || 0
              ),

            targetDrivers:
              Number(
                row.target_coco_drivers || 0
              ),

            actualCars:
              Number(
                row.actual_coco_cars || 0
              ),

            actualDrivers:
              Number(
                row.actual_coco_drivers || 0
              )

          }
        );

      }

    }
  );


  let targetCars = 0;
  let actualDrivers = 0;


  branchMap.forEach(
    item => {

      targetCars +=
        item.targetCars;

      actualDrivers +=
        item.actualDrivers;

    }
  );


  const driverRatio =
    targetCars > 0
      ? actualDrivers / targetCars
      : 0;


  setText(
    'cocoCars',
    formatNumber(
      targetCars
    )
  );


  setText(
    'cocoDrivers',
    formatNumber(
      actualDrivers
    )
  );


  setText(
    'driverRatio',
    driverRatio > 0
      ? driverRatio.toFixed(2)
      : '-'
  );


  /*
   * Target KM
   */

  const targetValues =
    [
      ...new Set(
        rows
          .map(
            row =>
              Number(
                row.target_km_per_car || 0
              )
          )
          .filter(
            value => value > 0
          )
      )
    ];


  setText(
    'targetKm',
    targetValues.length === 1
      ? formatNumber(
          targetValues[0]
        )
      : '-'
  );

}


/* =========================================================
   KM KPI + FORECAST
========================================================= */

function updateKmKPI(
  rows,
  startDate,
  endDate,
  branch
) {

  let totalKm = 0;

  const workingDates =
    new Set();


  rows.forEach(
    row => {

      const km =
        getCocoKm(row);


      if (km > 0) {

        totalKm +=
          km;


        const date =
          normalizeDate(
            row.work_date
          );


        if (date) {

          workingDates.add(
            date
          );

        }

      }

    }
  );


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
      ? (
          avgKmCar /
          targetKm
        ) * 100
      : 0;


  /*
   * KPI
   */

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
    achievement > 0
      ? achievement.toFixed(1) + '%'
      : '-'
  );


  setAchievementStatus(
    'kmAchievementStatus',
    achievement
  );


  /*
   * ============================================
   * FORECAST
   * ============================================
   */

  const cycleDays =
    diffDays(
      startDate,
      endDate
    ) + 1;


  const today =
    formatDateInput(
      new Date()
    );


  let elapsedDays = 0;


  if (
    today < startDate
  ) {

    elapsedDays = 0;

  } else if (
    today > endDate
  ) {

    elapsedDays =
      cycleDays;

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
        ) * 100
      : 0;


  const targetTotalKm =
    targetCars *
    targetKm;


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
    forecastAchievement > 0
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


  /*
   * Performance Status
   */

  updatePerformanceStatus(
    forecastAchievement,
    totalKm,
    forecastTotalKm,
    targetTotalKm
  );


  /*
   * Car Breakdown
   */

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
    document.getElementById(
      'carBreakdown'
    );


  if (!container) {
    return;
  }


  const branches =
    [
      ...new Set(
        rows
          .map(
            row =>
              String(
                row.branch || ''
              ).trim()
          )
          .filter(Boolean)
      )
    ];


  /*
   * ระยอง
   */

  if (
    branches.length === 1 &&
    branches[0] === 'ระยอง'
  ) {

    container.innerHTML = `

      <div class="car-breakdown-item">

        <span>
          ระยองสัญญา 1
        </span>

        <strong>
          30 คัน
        </strong>

      </div>


      <div class="car-breakdown-item">

        <span>
          ระยองสัญญา 2
        </span>

        <strong>
          5 คัน
        </strong>

      </div>


      <div class="car-breakdown-item">

        <span>
          ระยอง10W
        </span>

        <strong>
          3 คัน
        </strong>

      </div>

    `;

    return;
  }


  /*
   * สาขาอื่น
   */

  container.innerHTML = `

    <div class="car-breakdown-item">

      <span>
        รถ COCO
      </span>

      <strong>
        ${formatNumber(targetCars)} คัน
      </strong>

    </div>

  `;

}


/* =========================================================
   KM PERFORMANCE BY CAR
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


  if (!tbody) {
    return;
  }


  /*
   * ============================================
   * 1. MASTER CAR PLATE SET
   * ============================================
   */

  const masterPlateSet =
    new Set();


  masterCarData.forEach(
    car => {

      const plate =
        normalizePlate(
          car.license_plate
        );


      if (plate) {

        masterPlateSet.add(
          plate
        );

      }

    }
  );


  console.log(
    'COCO master plates:',
    masterPlateSet.size
  );


  /*
   * ============================================
   * 2. TARGET KM BY BRANCH
   * ============================================
   */

  const targetKmByBranch =
    new Map();


  dashboardData.forEach(
    row => {

      const branchName =
        String(
          row.branch || ''
        ).trim();


      const target =
        Number(
          row.target_km_per_car || 0
        );


      if (
        branchName &&
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


  /*
   * ============================================
   * 3. FILTER TRIPS
   * ============================================
   */

  const filteredTrips =
    tripData.filter(
      trip => {

        const date =
          normalizeDate(
            trip.work_date
          );


        if (!date) {
          return false;
        }


        /*
         * วันที่
         */

        if (
          date < startDate ||
          date > endDate
        ) {

          return false;

        }


        /*
         * สาขา
         */

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
         * ทะเบียน
         */

        const plate =
          normalizePlate(
            trip.license_plate
          );


        if (!plate) {
          return false;
        }


        /*
         * COCO =
         * ทะเบียนอยู่ใน Master Car
         */

        if (
          !masterPlateSet.has(
            plate
          )
        ) {

          return false;

        }


        return true;

      }
    );


  console.log(
    'Filtered COCO trips:',
    filteredTrips.length
  );


  /*
   * ============================================
   * 4. GROUP BY BRANCH + CAR
   * ============================================
   */

  const carMap =
    new Map();


  filteredTrips.forEach(
    trip => {

      const tripBranch =
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


      if (!carNo) {
        return;
      }


      const key =
        `${tripBranch}||${carNo}`;


      if (
        !carMap.has(key)
      ) {

        carMap.set(
          key,
          {

            branch:
              tripBranch,

            carNo:
              carNo,

            plate:
              plate,

            km:
              0

          }
        );

      }


      const car =
        carMap.get(key);


      car.km +=
        Number(
          trip.total_distance || 0
        );

    }
  );


  /*
   * ============================================
   * 5. SORT
   * ============================================
   */

  carPerformanceData =
    [
      ...carMap.values()
    ]
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
            'th'
          );

        }
      );


  /*
   * ============================================
   * 6. EMPTY
   * ============================================
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
   * ============================================
   * 7. RENDER
   * ============================================
   */

  tbody.innerHTML =
    carPerformanceData
      .map(
        car => {

          const target =
            targetKmByBranch.get(
              car.branch
            ) || 0;


          const achievement =
            target > 0
              ? (
                  car.km /
                  target
                ) * 100
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
            achievement >= 80
          ) {

            statusClass =
              'status-ok';

            statusText =
              'ใกล้เป้า';

          }


          return `

            <tr>

              <td>
                ${escapeHtml(
                  car.carNo
                )}
              </td>


              <td>
                ${escapeHtml(
                  car.plate
                )}
              </td>


              <td>
                ${formatNumber(
                  car.km
                )}
              </td>


              <td>
                ${
                  target > 0
                    ? formatNumber(
                        target
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


/* =========================================================
   DAILY KM CHART
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


  if (!canvas) {
    return;
  }


  const dates =
    getDateRange(
      startDate,
      endDate
    );


  const dailyMap =
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
        getCocoKm(row);


      dailyMap.set(
        date,
        (
          dailyMap.get(date) || 0
        ) + km
      );

    }
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
    [
      ...dailyMap.values()
    ]
      .filter(
        km => km > 0
      )
      .length;


  const totalKm =
    [
      ...dailyMap.values()
    ]
      .reduce(
        (
          sum,
          km
        ) =>
          sum + km,
        0
      );


  const avgKmDay =
    workingDays > 0
      ? totalKm /
        workingDays
      : 0;


  const actualData =
    dates.map(
      date =>
        dailyMap.get(
          date
        ) || 0
    );


  const targetData =
    dates.map(
      () =>
        dailyTarget
    );


  let cumulativeActual =
    totalKm;


  /*
   * Forecast line
   */

  let forecastRunning =
    totalKm;


  const forecastData =
    dates.map(
      date => {

        if (
          date <= today
        ) {

          return null;

        }


        forecastRunning +=
          avgKmDay;


        return forecastRunning;

      }
    );


  const targetTotal =
    targetCars *
    targetKm;


  const forecastTotal =
    forecastRunning;


  /*
   * Summary
   */

  setText(
    'chartActualKm',
    formatNumber(
      totalKm
    )
  );


  setText(
    'chartTargetKm',
    formatNumber(
      targetTotal
    )
  );


  setText(
    'chartForecastKm',
    formatNumber(
      forecastTotal
    )
  );


  /*
   * Destroy old chart
   */

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

              label:
                'Actual KM',

              data:
                actualData,

              borderWidth:
                2,

              tension:
                0.25,

              pointRadius:
                2

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

              pointRadius:
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
                [4, 4],

              pointRadius:
                0

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


/* =========================================================
   CUMULATIVE KM CHART
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


  if (!canvas) {
    return;
  }


  const dates =
    getDateRange(
      startDate,
      endDate
    );


  const dailyMap =
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


      dailyMap.set(
        date,
        (
          dailyMap.get(date) || 0
        ) +
        getCocoKm(row)
      );

    }
  );


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


  dates.forEach(
    date => {

      actual +=
        dailyMap.get(
          date
        ) || 0;


      target +=
        dailyTarget;


      actualData.push(
        actual
      );


      targetData.push(
        target
      );

    }
  );


  if (
    kmCumulativeChart
  ) {

    kmCumulativeChart.destroy();

  }


  kmCumulativeChart =
    new Chart(
      canvas,
      {

        type: 'line',

        data: {

          labels:
            dates,

          datasets: [

            {

              label:
                'Actual KM สะสม',

              data:
                actualData,

              borderWidth:
                2,

              tension:
                0.25,

              pointRadius:
                2

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

              pointRadius:
                0

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
  ) {

    return;

  }


  /*
   * ป้องกัน Supabase ส่ง string
   */

  forecastAchievement =
    Number(
      forecastAchievement
    ) || 0;


  container.classList.remove(
    'status-on-track',
    'status-at-risk',
    'status-below-target'
  );


  achievement.textContent =
    forecastAchievement > 0
      ? forecastAchievement.toFixed(1) + '%'
      : '-';


  if (
    forecastAchievement >= 100
  ) {

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
   ACHIEVEMENT STATUS
========================================================= */

function setAchievementStatus(
  elementId,
  achievement
) {

  const el =
    document.getElementById(
      elementId
    );


  if (!el) {
    return;
  }


  achievement =
    Number(
      achievement
    ) || 0;


  el.classList.remove(
    'status-low',
    'status-ok',
    'status-high'
  );


  if (
    achievement <= 0
  ) {

    el.textContent =
      '-';

    return;

  }


  if (
    achievement < 100
  ) {

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


/* =========================================================
   HELPERS
========================================================= */

function getCocoKm(
  row
) {

  return Number(
    row.coco_km ??
    row.total_coco_km ??
    row.daily_coco_km ??
    row.actual_coco_km ??
    0
  );

}


function getTargetCars(
  rows
) {

  const values =
    rows
      .map(
        row =>
          Number(
            row.target_coco_cars || 0
          )
      )
      .filter(
        value => value > 0
      );


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
          .map(
            row =>
              Number(
                row[field] || 0
              )
          )
          .filter(
            value => value > 0
          )
      )
    ];


  return values.length === 1
    ? values[0]
    : 0;

}


function normalizeDate(
  value
) {

  if (!value) {
    return '';
  }


  if (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}/
      .test(value)
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


  return formatDateInput(
    date
  );

}


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
    .toUpperCase();

}


function getDateRange(
  startDate,
  endDate
) {

  const result = [];


  let current =
    new Date(
      startDate +
      'T00:00:00'
    );


  const end =
    new Date(
      endDate +
      'T00:00:00'
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


function diffDays(
  startDate,
  endDate
) {

  const start =
    new Date(
      startDate +
      'T00:00:00'
    );


  const end =
    new Date(
      endDate +
      'T00:00:00'
    );


  return Math.round(
    (
      end - start
    ) /
    (
      1000 *
      60 *
      60 *
      24
    )
  );

}


function formatDateInput(
  date
) {

  const year =
    date.getFullYear();


  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      '0'
    );


  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      '0'
    );


  return (
    `${year}-${month}-${day}`
  );

}


function formatNumber(
  value
) {

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
    document.getElementById(
      id
    );


  if (el) {

    el.textContent =
      value;

  }

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


/* =========================================================
   EVENTS
========================================================= */

document
  .getElementById(
    'startDate'
  )
  ?.addEventListener(
    'change',
    updateDashboard
  );


document
  .getElementById(
    'endDate'
  )
  ?.addEventListener(
    'change',
    updateDashboard
  );


document
  .getElementById(
    'branchFilter'
  )
  ?.addEventListener(
    'change',
    updateDashboard
  );


/* =========================================================
   START
========================================================= */

loadDashboard();
