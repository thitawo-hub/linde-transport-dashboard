// ============================================================
// LINDE TRANSPORT
// KPI DISTANCE
// ============================================================

const SUPABASE_URL =
  'https://hhsqijlcebaijtklskag.supabase.co';


// ใช้ Publishable Key เท่านั้น
const SUPABASE_KEY =
  'sb_publishable_z5-j4hCd7dJ50-sLaUKraw_ZgM9ZA4W';


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

const EXCLUDED_BRANCHES = [
  'linde oil'
];

const BRANCH_ORDER = [
  'ระยอง',
  'ท่าลาน',
  'บางปะอิน',
  'หาดใหญ่'
];


// ============================================================
// SUPABASE FETCH
// ============================================================

async function fetchSupabase(
  table,
  params = ''
) {

  const pageSize = 1000;

  let offset = 0;
  let result = [];


  while (true) {

    const separator =
      params ? '&' : '';

    const url =
      ${SUPABASE_URL}/rest/v1/${table}? +
      ${params}${separator} +
      limit=${pageSize}&offset=${offset};


    const response =
      await fetch(
        url,
        {
          method: 'GET',

          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization':
              `Bearer ${SUPABASE_KEY}`,
            'Content-Type':
              'application/json'
          }
        }
      );


    if (!response.ok) {

      const text =
        await response.text();

      throw new Error(
        `Supabase ${table} ${response.status}: ${text}`
      );

    }


    const data =
      await response.json();


    if (!Array.isArray(data)) {

      throw new Error(
        `${table} ไม่ใช่ Array`
      );

    }


    result =
      result.concat(data);


    if (
      data.length <
      pageSize
    ) {

      break;

    }


    offset +=
      pageSize;

  }


  return result;

}


// ============================================================
// INIT
// ============================================================

async function loadKpiDistance() {

  try {

    setPageStatus(
      'กำลังโหลดข้อมูล KPI ระยะทาง...'
    );


    const [
      summary,
      cars,
      daily
    ] = await Promise.all([

      fetchSupabase(
        'v_kpi_distance_summary',
        'select=*'
      ),

      fetchSupabase(
        'v_kpi_distance_car',
        'select=*'
      ),

      fetchSupabase(
        'v_kpi_distance_daily',
        'select=*'
      )

    ]);


    summaryData =
      summary?.[0] || null;


    carData =
      cars || [];


    dailyData =
      daily || [];


    console.log(
      'KPI Distance Summary:',
      summaryData
    );


    console.log(
      'KPI Distance Cars:',
      carData.length
    );


    console.log(
      'KPI Distance Daily:',
      dailyData.length
    );


    populateBranchFilter();

    render();


    setPageStatus(
      `ข้อมูล KPI ระยะทางโหลดแล้ว • รถ COCO ${formatNumber(carData.length)} คัน`
    );


  } catch (error) {

    console.error(
      'KPI Distance Error:',
      error
    );


    setPageStatus(
      `⚠️ ${error.message}`
    );

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


  const currentValue =
    select.value || '';


  const branches =
    [
      ...new Set(
        carData
          .map(
            row =>
              String(
                row.branch || ''
              ).trim()
          )
          .filter(
            branch =>
              branch &&
              !isExcludedBranch(branch)
          )
      )
    ]
    .sort(
      (a, b) =>
        getBranchOrder(a) -
        getBranchOrder(b)
    );


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
// MAIN RENDER
// ============================================================

function render() {

  const branch =
    document.getElementById(
      'branchFilter'
    )?.value || '';


  const filteredCars =
    carData.filter(
      car => {

        if (
          isExcludedBranch(
            car.branch
          )
        ) {

          return false;

        }


        if (!branch) {
          return true;
        }


        return (
          normalizeText(
            car.branch
          ) ===
          normalizeText(
            branch
          )
        );

      }
    );


  const filteredDaily =
    dailyData.filter(
      row => {

        if (
          isExcludedBranch(
            row.branch
          )
        ) {

          return false;

        }


        if (!branch) {
          return true;
        }


        return (
          normalizeText(
            row.branch
          ) ===
          normalizeText(
            branch
          )
        );

      }
    );


  // ----------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------

  renderSummary(
    filteredCars
  );


  // ----------------------------------------------------------
  // CYCLE
  // ----------------------------------------------------------

  renderCycle();


  // ----------------------------------------------------------
  // VEHICLE TYPE SUMMARY
  // ----------------------------------------------------------

  renderVehicleTypeSummary(
    filteredCars
  );


  // ----------------------------------------------------------
  // ALERT
  // ----------------------------------------------------------

  renderAlerts(
    filteredCars
  );


  // ----------------------------------------------------------
  // RANKING
  // ----------------------------------------------------------

  renderRankings(
    filteredCars
  );


  // ----------------------------------------------------------
  // CHART
  // ----------------------------------------------------------

  renderChart(
    filteredDaily
  );


  // ----------------------------------------------------------
  // TABLE
  // ----------------------------------------------------------

  renderTable(
    filteredCars
  );

}


// ============================================================
// SUMMARY
// ============================================================

function renderSummary(
  cars
) {

  const totalCars =
    cars.length;


  const targetCars =
    cars.filter(
      car =>
        Number(
          car.target_km
        ) > 0
    );


  const runningCars =
    cars.filter(
      car =>
        Number(
          car.total_km
        ) > 0
    );


  const totalKm =
    targetCars.reduce(
      (
        sum,
        car
      ) =>
        sum +
        toNumber(
          car.total_km
        ),
      0
    );


  const totalTarget =
    targetCars.reduce(
      (
        sum,
        car
      ) =>
        sum +
        toNumber(
          car.target_km
        ),
      0
    );


  const achievement =
    totalTarget > 0
      ? (
          totalKm /
          totalTarget
        ) *
        100
      : 0;


  const avgKmCar =
    targetCars.length > 0
      ? totalKm /
        targetCars.length
      : 0;


  const nearTargetCars =
    targetCars.filter(
      car =>
        getAchievement(
          car
        ) >= 90 &&
        getForecastOver(
          car
        ) <= 0
    ).length;


  const forecastOverCars =
    targetCars.filter(
      car =>
        getForecastOver(
          car
        ) > 0
    ).length;


  const forecastKm =
    targetCars.reduce(
      (
        sum,
        car
      ) =>
        sum +
        toNumber(
          car.forecast_km
        ),
      0
    );


  const forecastAchievement =
    totalTarget > 0
      ? (
          forecastKm /
          totalTarget
        ) *
        100
      : 0;


  setText(
    'totalCars',
    formatNumber(
      totalCars
    )
  );


  setText(
    'totalKm',
    formatNumber(
      totalKm
    )
  );


  setText(
    'totalTargetKm',
    formatNumber(
      totalTarget
    )
  );


  setText(
    'achievement',
    totalTarget > 0
      ? achievement.toFixed(1) + '%'
      : '-'
  );


  setText(
    'achievementMain',
    totalTarget > 0
      ? achievement.toFixed(1) + '%'
      : '-'
  );


  setText(
    'runningCars',
    formatNumber(
      runningCars.length
    )
  );


  setText(
    'avgKmCar',
    formatNumber(
      avgKmCar
    )
  );


  setText(
    'nearTargetCars',
    formatNumber(
      nearTargetCars
    )
  );


  setText(
    'forecastOverCars',
    formatNumber(
      forecastOverCars
    )
  );


  setText(
    'forecastKm',
    totalTarget > 0
      ? formatNumber(
          forecastKm
        )
      : '-'
  );


  setText(
    'forecastAchievement',
    totalTarget > 0
      ? forecastAchievement.toFixed(1) + '%'
      : '-'
  );


  setText(
    'achievementStatus',
    getAchievementText(
      achievement
    )
  );

}


// ============================================================
// VEHICLE TYPE SUMMARY
// ============================================================

function renderVehicleTypeSummary(
  cars
) {

  const tbody =
    document.getElementById(
      'vehicleTypeSummaryBody'
    );


  if (!tbody) {
    return;
  }


  if (!cars.length) {

    tbody.innerHTML = `
      <tr>
        <td
          colspan="10"
          class="empty-state"
        >
          ไม่พบข้อมูลรถ
        </td>
      </tr>
    `;

    return;

  }


  const groups =
    new Map();


  cars.forEach(
    car => {

      const branch =
        String(
          car.branch || '-'
        ).trim();


      const vehicleType =
        normalizeVehicleType(
          car.vehicle_type
        );


      const key =
        `${normalizeText(branch)}|||${normalizeText(vehicleType)}`;


      if (!groups.has(key)) {

        groups.set(
          key,
          {
            branch,
            vehicleType,
            cars: []
          }
        );

      }


      groups
        .get(key)
        .cars
        .push(car);

    }
  );


  const rows =
    [...groups.values()]
      .sort(
        (a, b) => {

          const branchDiff =
            getBranchOrder(
              a.branch
            ) -
            getBranchOrder(
              b.branch
            );


          if (
            branchDiff !== 0
          ) {

            return branchDiff;

          }


          return a.vehicleType
            .localeCompare(
              b.vehicleType,
              'th'
            );

        }
      );


  tbody.innerHTML =
    rows
      .map(
        group => {

          const carsInGroup =
            group.cars;


          const totalCars =
            carsInGroup.length;


          const targetCars =
            carsInGroup.filter(
              car =>
                toNumber(
                  car.target_km
                ) > 0
            );


          const targetTotal =
            targetCars.reduce(
              (
                sum,
                car
              ) =>
                sum +
                toNumber(
                  car.target_km
                ),
              0
            );


          const totalKm =
            targetCars.reduce(
              (
                sum,
                car
              ) =>
                sum +
                toNumber(
                  car.total_km
                ),
              0
            );


          const forecastTotal =
            targetCars.reduce(
              (
                sum,
                car
              ) =>
                sum +
                toNumber(
                  car.forecast_km
                ),
              0
            );


          const achievement =
            targetTotal > 0
              ? (
                  totalKm /
                  targetTotal
                ) *
                100
              : null;


          const forecastAchievement =
            targetTotal > 0
              ? (
                  forecastTotal /
                  targetTotal
                ) *
                100
              : null;


          const avgTarget =
            targetCars.length > 0
              ? targetTotal /
                targetCars.length
              : null;


          const forecastOver =
            forecastTotal -
            targetTotal;


          const status =
            getGroupStatus(
              achievement,
              forecastAchievement,
              targetTotal
            );


          return `

            <tr>

              <td>
                <strong>
                  ${escapeHtml(
                    group.branch
                  )}
                </strong>
              </td>


              <td>
                <span class="vehicle-type-badge">
                  ${escapeHtml(
                    group.vehicleType
                  )}
                </span>
              </td>


              <td class="num">
                ${formatNumber(
                  totalCars
                )}
              </td>


              <td class="num target-value">
                ${
                  avgTarget !== null
                    ? formatNumber(
                        avgTarget
                      )
                    : '-'
                }
              </td>


              <td class="num target-value">
                ${
                  targetTotal > 0
                    ? formatNumber(
                        targetTotal
                      )
                    : '-'
                }
              </td>


              <td class="num">
                ${formatNumber(
                  totalKm
                )}
              </td>


              <td
                class="num ${
                  getAchievementClass(
                    achievement
                  )
                }"
              >
                ${
                  achievement !== null
                    ? achievement.toFixed(1) + '%'
                    : '-'
                }
              </td>


              <td class="num">
                ${
                  targetTotal > 0
                    ? formatNumber(
                        forecastTotal
                      )
                    : '-'
                }
              </td>


              <td
                class="num ${
                  getAchievementClass(
                    forecastAchievement
                  )
                }"
              >
                ${
                  forecastAchievement !== null
                    ? forecastAchievement.toFixed(1) + '%'
                    : '-'
                }

                ${
                  forecastOver > 0
                    ? `
                      <small style="display:block;color:#dc2626;">
                        +${formatNumber(
                          forecastOver
                        )} KM
                      </small>
                    `
                    : ''
                }

              </td>


              <td>

                <span
                  class="distance-status ${status.className}"
                >
                  ${status.text}
                </span>

              </td>

            </tr>

          `;

        }
      )
      .join('');

}


// ============================================================
// GROUP STATUS
// ============================================================

function getGroupStatus(
  achievement,
  forecastAchievement,
  targetTotal
) {

  if (
    !targetTotal ||
    targetTotal <= 0
  ) {

    return {
      className: 'no-target',
      text: 'ไม่มี Target'
    };

  }


  if (
    achievement >= 100
  ) {

    return {
      className: 'over',
      text: 'เกินเป้า'
    };

  }


  if (
    forecastAchievement >= 100
  ) {

    return {
      className: 'forecast',
      text: 'Forecast เกินเป้า'
    };

  }


  if (
    achievement >= 90
  ) {

    return {
      className: 'near',
      text: 'ใกล้เป้า'
    };

  }


  return {
    className: 'normal',
    text: 'ปกติ'
  };

}


// ============================================================
// CYCLE
// ============================================================

function renderCycle() {

  if (!summaryData) {
    return;
  }


  const start =
    summaryData.cycle_start;


  const end =
    summaryData.cycle_end;


  const elapsed =
    toNumber(
      summaryData.elapsed_days
    );


  const remaining =
    toNumber(
      summaryData.remaining_calendar_days
    );


  const latest =
    summaryData.latest_trip_date;


  const cycleText =
    `${formatThaiDate(start)} – ${formatThaiDate(end)}`;


  setText(
    'cycleValue',
    cycleText
  );


  setText(
    'cycleText',
    cycleText
  );


  setText(
    'elapsedDays',
    `${formatNumber(elapsed)} วัน`
  );


  setText(
    'remainingDays',
    `${formatNumber(remaining)} วัน`
  );


  setText(
    'latestDate',
    formatThaiDate(
      latest
    )
  );

}


// ============================================================
// ALERTS
// ============================================================

function renderAlerts(
  cars
) {

  const targetCars =
    cars.filter(
      car =>
        toNumber(
          car.target_km
        ) > 0
    );


  const forecastOver =
    targetCars
      .filter(
        car =>
          getForecastOver(
            car
          ) > 0
      )
      .sort(
        (
          a,
          b
        ) =>
          getForecastOver(
            b
          ) -
          getForecastOver(
            a
          )
      );


  const nearTarget =
    targetCars
      .filter(
        car => {

          const achievement =
            getAchievement(
              car
            );


          const forecastOver =
            getForecastOver(
              car
            );


          return (
            achievement >= 90 &&
            forecastOver <= 0
          );

        }
      )
      .sort(
        (
          a,
          b
        ) =>
          getAchievement(
            b
          ) -
          getAchievement(
            a
          )
      );


  renderAlertList(
    'forecastOverList',
    forecastOver,
    'forecast'
  );


  renderAlertList(
    'nearTargetList',
    nearTarget,
    'near'
  );

}


// ============================================================
// ALERT LIST
// ============================================================

function renderAlertList(
  elementId,
  cars,
  type
) {

  const element =
    document.getElementById(
      elementId
    );


  if (!element) {
    return;
  }


  if (!cars.length) {

    element.innerHTML = `
      <li class="empty-alert">
        ไม่มีรถในกลุ่มนี้
      </li>
    `;

    return;

  }


  element.innerHTML =
    cars
      .slice(
        0,
        10
      )
      .map(
        car => {

          const km =
            toNumber(
              car.total_km
            );


          const forecast =
            toNumber(
              car.forecast_km
            );


          const achievement =
            getAchievement(
              car
            );


          const over =
            getForecastOver(
              car
            );


          return `

            <li class="alert-item">

              <div>

                <div class="alert-car">
                  ${escapeHtml(
                    car.car_no ||
                    '-'
                  )}
                </div>

                <div class="alert-plate">
                  ${escapeHtml(
                    car.license_plate ||
                    '-'
                  )}
                </div>

                <div class="alert-type">
                  ${escapeHtml(
                    normalizeVehicleType(
                      car.vehicle_type
                    )
                  )}
                </div>

              </div>


              <div class="alert-km">

                ${
                  type === 'forecast'
                    ? `
                      Forecast
                      ${formatNumber(
                        forecast
                      )}
                    `
                    : `
                      ${formatNumber(
                        km
                      )} KM
                    `
                }

              </div>


              <div>

                <div class="alert-percent">
                  ${achievement.toFixed(1)}%
                </div>


                ${
                  type === 'forecast'
                    ? `
                      <div class="alert-plate">
                        +${formatNumber(
                          over
                        )} KM
                      </div>
                    `
                    : ''
                }

              </div>

            </li>

          `;

        }
      )
      .join('');

}


// ============================================================
// RANKINGS
// ============================================================

function renderRankings(
  cars
) {

  const targetCars =
    cars.filter(
      car =>
        toNumber(
          car.target_km
        ) > 0
    );


  const highest =
    [...targetCars]
      .sort(
        (
          a,
          b
        ) =>
          toNumber(
            b.total_km
          ) -
          toNumber(
            a.total_km
          )
      )
      .slice(
        0,
        5
      );


  const lowest =
    [...targetCars]
      .sort(
        (
          a,
          b
        ) =>
          toNumber(
            a.total_km
          ) -
          toNumber(
            b.total_km
          )
      )
      .slice(
        0,
        5
      );


  renderRankingList(
    'highestKmList',
    highest
  );


  renderRankingList(
    'lowestKmList',
    lowest
  );

}


// ============================================================
// RANKING LIST
// ============================================================

function renderRankingList(
  elementId,
  cars
) {

  const element =
    document.getElementById(
      elementId
    );


  if (!element) {
    return;
  }


  if (!cars.length) {

    element.innerHTML = `
      <li class="empty-alert">
        ไม่มีข้อมูล
      </li>
    `;

    return;

  }


  element.innerHTML =
    cars
      .map(
        (
          car,
          index
        ) => `

          <li class="ranking-item">

            <div class="ranking-number">
