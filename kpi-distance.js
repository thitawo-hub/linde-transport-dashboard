// ============================================================
// LINDE TRANSPORT
// KPI DISTANCE
// ============================================================


const SUPABASE_URL =
  'https://hhsqijlcebaijtklskag.supabase.co';


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
      `${SUPABASE_URL}/rest/v1/${table}?` +
      `${params}${separator}` +
      `limit=${pageSize}&offset=${offset}`;


    const response =
      await fetch(
        url,
        {
          method: 'GET',

          headers: {
            'apikey':
              SUPABASE_KEY,

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
      result.concat(
        data
      );


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


  const branches =
    [
      ...new Set(
        carData
          .map(
            row =>
              String(
                row.branch ||
                ''
              ).trim()
          )
          .filter(
            branch =>
              branch &&
              normalizeText(
                branch
              ) !==
              normalizeText(
                'linde oil'
              )
          )
      )
    ]
    .sort(
      (a, b) =>
        a.localeCompare(
          b,
          'th'
        )
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

}


// ============================================================
// RENDER
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
          normalizeText(
            car.branch
          ) ===
          normalizeText(
            'linde oil'
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
          normalizeText(
            row.branch
          ) ===
          normalizeText(
            'linde oil'
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


  renderSummary(
    filteredCars
  );


  renderCycle();


  renderAlerts(
    filteredCars
  );


  renderRankings(
    filteredCars
  );


  renderChart(
    filteredDaily
  );


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
        Number(
          car.total_km
        || 0
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
        Number(
          car.target_km
        || 0
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
        Number(
          car.achievement_percent
        || 0
        ) >= 90
    ).length;


  const forecastOverCars =
    targetCars.filter(
      car =>
        Number(
          car.forecast_over_km
        || 0
        ) > 0
    ).length;


  const forecastKm =
    targetCars.reduce(
      (
        sum,
        car
      ) =>
        sum +
        Number(
          car.forecast_km
        || 0
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
    formatNumber(
      forecastKm
    )
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
    Number(
      summaryData.elapsed_days
      || 0
    );


  const remaining =
    Number(
      summaryData.remaining_calendar_days
      || 0
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
        Number(
          car.target_km
        ) > 0
    );


  const forecastOver =
    targetCars
      .filter(
        car =>
          Number(
            car.forecast_over_km
            || 0
          ) > 0
      )
      .sort(
        (
          a,
          b
        ) =>
          Number(
            b.forecast_over_km
            || 0
          ) -
          Number(
            a.forecast_over_km
            || 0
          )
      );


  const nearTarget =
    targetCars
      .filter(
        car => {

          const achievement =
            Number(
              car.achievement_percent
              || 0
            );


          const isForecastOver =
            Number(
              car.forecast_over_km
              || 0
            ) > 0;


          return (
            achievement >= 90 &&
            !isForecastOver
          );

        }
      )
      .sort(
        (
          a,
          b
        ) =>
          Number(
            b.achievement_percent
            || 0
          ) -
          Number(
            a.achievement_percent
            || 0
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
        8
      )
      .map(
        car => {

          const km =
            Number(
              car.total_km
              || 0
            );


          const forecast =
            Number(
              car.forecast_km
              || 0
            );


          const achievement =
            Number(
              car.achievement_percent
              || 0
            );


          const over =
            Number(
              car.forecast_over_km
              || 0
            );


          return `

            <li class="alert-item">

              <div>

                <div class="alert-car">
                  ${escapeHtml(
                    car.car_no
                  )}
                </div>

                <div class="alert-plate">
                  ${escapeHtml(
                    car.license_plate ||
                    '-'
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

                  ${
                    achievement.toFixed(1)
                  }%

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
        Number(
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
          Number(
            b.total_km
            || 0
          ) -
          Number(
            a.total_km
            || 0
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
          Number(
            a.total_km
            || 0
          ) -
          Number(
            b.total_km
            || 0
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
              #${index + 1}
            </div>


            <div class="ranking-car">

              ${escapeHtml(
                car.car_no
              )}

              <small>
                ${escapeHtml(
                  car.license_plate ||
                  '-'
                )}
              </small>

            </div>


            <div class="ranking-value">

              ${formatNumber(
                car.total_km
              )}

              KM

            </div>

          </li>

        `
      )
      .join('');

}


// ============================================================
// DAILY CHART
// ============================================================

function renderChart(
  rows
) {

  const canvas =
    document.getElementById(
      'distanceDailyChart'
    );


  if (!canvas) {
    return;
  }


  const grouped =
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
        Number(
          row.total_km
          || 0
        );


      grouped.set(
        date,
        (
          grouped.get(
            date
          ) || 0
        ) +
        km
      );

    }
  );


  const dates =
    [
      ...grouped.keys()
    ]
    .sort();


  const values =
    dates.map(
      date =>
        grouped.get(
          date
        ) || 0
    );


  if (distanceChart) {

    distanceChart.destroy();

  }


  const context =
    canvas.getContext(
      '2d'
    );


  distanceChart =
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
                'KM รถ COCO',

              data:
                values,

              borderWidth:
                2,

              tension:
                0.25,

              fill:
                false

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
// TABLE
// ============================================================

function renderTable(
  cars
) {

  const tbody =
    document.getElementById(
      'carTableBody'
    );


  if (!tbody) {
    return;
  }


  if (!cars.length) {

    tbody.innerHTML = `

      <tr>

        <td
          colspan="9"
          class="empty-state"
        >
          ไม่พบข้อมูลรถ COCO
        </td>

      </tr>

    `;

    return;

  }


  const sorted =
    [...cars]
      .sort(
        (
          a,
          b
        ) =>
          Number(
            b.total_km
            || 0
          ) -
          Number(
            a.total_km
            || 0
          )
      );


  tbody.innerHTML =
    sorted
      .map(
        car => {

          const km =
            Number(
              car.total_km
              || 0
            );


          const target =
            Number(
              car.target_km
              || 0
            );


          const achievement =
            Number(
              car.achievement_percent
              || 0
            );


          const forecast =
            Number(
              car.forecast_km
              || 0
            );


          const forecastAchievement =
            Number(
              car.forecast_achievement_percent
              || 0
            );


          const forecastOver =
            Number(
              car.forecast_over_km
              || 0
            );


          const status =
            String(
              car.status
              || ''
            );


          let statusClass =
            'normal';


          let statusText =
            'ปกติ';


          if (
            status ===
            'OVER_TARGET'
          ) {

            statusClass =
              'over';

            statusText =
              'เกินเป้า';

          } else if (
            status ===
            'FORECAST_OVER'
          ) {

            statusClass =
              'forecast';

            statusText =
              'Forecast เกินเป้า';

          } else if (
            status ===
            'NEAR_TARGET'
          ) {

            statusClass =
              'near';

            statusText =
              'ใกล้เป้า';

          } else if (
            status ===
            'NO_TARGET'
          ) {

            statusClass =
              'no-target';

            statusText =
              'ไม่มี Target';

          }


          return `

            <tr>

              <td>
                ${escapeHtml(
                  car.car_no ||
                  '-'
                )}
              </td>


              <td>
                ${escapeHtml(
                  car.license_plate ||
                  '-'
                )}
              </td>


              <td>
                ${escapeHtml(
                  car.branch ||
                  '-'
                )}
              </td>


              <td class="num">
                ${formatNumber(
                  km
                )}
              </td>


              <td class="num">
                ${
                  target > 0
                    ? formatNumber(
                        target
                      )
                    : '-'
                }
              </td>


              <td class="num">

                ${
                  target > 0
                    ? achievement.toFixed(1) + '%'
                    : '-'
                }

              </td>


              <td class="num">

                ${
                  target > 0
                    ? formatNumber(
                        forecast
                      )
                    : '-'
                }

              </td>


              <td class="num">

                ${
                  target > 0
                    ? `
                      ${forecastAchievement.toFixed(1)}%
                      ${
                        forecastOver > 0
                          ? `
                            <small style="color:#dc2626;">
                              +${formatNumber(
                                forecastOver
                              )}
                            </small>
                          `
                          : ''
                      }
                    `
                    : '-'
                }

              </td>


              <td>

                <span
                  class="distance-status ${statusClass}"
                >
                  ${statusText}
                </span>

              </td>

            </tr>

          `;

        }
      )
      .join('');

}


// ============================================================
// NAVIGATION
// ============================================================

function goToPage(
  page
) {

  if (
    page ===
    'overview'
  ) {

    window.location.href =
      'index.html';

    return;

  }


  if (
    page ===
    'daily'
  ) {

    window.location.href =
      'daily-report.html';

    return;

  }

}


// ============================================================
// HELPERS
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

    const match =
      value.match(
        /^(\d{4})-(\d{2})-(\d{2})/
      );


    if (match) {

      return match[0];

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


function formatThaiDate(
  value
) {

  const date =
    normalizeDate(
      value
    );


  if (!date) {
    return '-';
  }


  const [
    year,
    month,
    day
  ] =
    date.split('-');


  return `${day}/${month}/${year}`;

}


function formatDisplayDate(
  value
) {

  const date =
    normalizeDate(
      value
    );


  if (!date) {
    return value;
  }


  const [
    year,
    month,
    day
  ] =
    date.split('-');


  return `${day}/${month}`;

}


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


function getAchievementText(
  value
) {

  const number =
    Number(
      value
    );


  if (
    !Number.isFinite(
      number
    ) ||
    number <= 0
  ) {

    return '-';

  }


  if (
    number >= 100
  ) {

    return 'เกินเป้า';

  }


  if (
    number >= 90
  ) {

    return 'ใกล้เป้า';

  }


  return 'ต่ำกว่าเป้า';

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


function setPageStatus(
  message
) {

  const element =
    document.getElementById(
      'pageStatus'
    );


  if (element) {

    element.textContent =
      message;

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


// ============================================================
// EVENTS
// ============================================================

document.addEventListener(
  'DOMContentLoaded',
  () => {

    const branch =
      document.getElementById(
        'branchFilter'
      );


    if (branch) {

      branch.addEventListener(
        'change',
        render
      );

    }


    loadKpiDistance();

  }
);
