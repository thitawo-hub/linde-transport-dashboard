const SUPABASE_URL =
  'https://hhsqijlcebaijtklskag.supabase.co';

const SUPABASE_KEY =
  'sb_publishable_z5-j4hCd7dJ50-sLaUKraw_ZgM9ZA4W';


let dashboardData = [];


/* =========================================================
   SUPABASE
========================================================= */

async function fetchDashboard() {

  const url =
    `${SUPABASE_URL}/rest/v1/v_dashboard?select=*`;

  const response = await fetch(url, {

    headers: {

      apikey: SUPABASE_KEY,

      Authorization:
        `Bearer ${SUPABASE_KEY}`

    }

  });


  if (!response.ok) {

    throw new Error(
      `Supabase Error ${response.status}`
    );

  }


  return await response.json();
}


/* =========================================================
   BILLING CYCLE 26 - 25
========================================================= */

function setDefaultBillingCycle() {

  const today =
    new Date();

  let start;
  let end;


  if (today.getDate() >= 26) {

    start =
      new Date(
        today.getFullYear(),
        today.getMonth(),
        26
      );


    end =
      new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        25
      );

  } else {

    start =
      new Date(
        today.getFullYear(),
        today.getMonth() - 1,
        26
      );


    end =
      new Date(
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


/* =========================================================
   DATE FORMAT
========================================================= */

function formatDateInput(date) {

  const year =
    date.getFullYear();


  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, '0');


  const day =
    String(
      date.getDate()
    ).padStart(2, '0');


  return `${year}-${month}-${day}`;
}


/* =========================================================
   SELECTED DATE RANGE
========================================================= */

function getSelectedDateRange() {

  return {

    start:
      document.getElementById(
        'startDate'
      ).value,

    end:
      document.getElementById(
        'endDate'
      ).value

  };
}


/* =========================================================
   BRANCH FILTER
========================================================= */

function setupBranchFilter(data) {

  const select =
    document.getElementById(
      'branchFilter'
    );


  const branches = [

    ...new Set(

      data

        .map(row => row.branch)

        .filter(Boolean)

    )

  ].sort();


  select.innerHTML =

    `<option value="">
      ทุกสาขา
    </option>`;


  branches.forEach(branch => {

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

  });

}


/* =========================================================
   MASTER DATA
========================================================= */

function getBranchMasterData(data) {

  const map =
    new Map();


  data.forEach(row => {

    if (!row.branch) {
      return;
    }


    if (!map.has(row.branch)) {

      map.set(

        row.branch,

        {

          branch:
            row.branch,

          actual_coco_cars:
            Number(
              row.actual_coco_cars || 0
            ),

          actual_coco_drivers:
            Number(
              row.actual_coco_drivers || 0
            ),

          actual_driver_ratio:
            Number(
              row.actual_driver_ratio || 0
            ),

          target_coco_cars:
            Number(
              row.target_coco_cars || 0
            ),

          target_km_per_car:
            Number(
              row.target_km_per_car || 0
            )

        }

      );

    }

  });


  return [
    ...map.values()
  ];
}


/* =========================================================
   FILTER DATA
========================================================= */

function getFilteredData(data) {

  const {
    start,
    end
  } =
    getSelectedDateRange();


  const selectedBranch =
    document.getElementById(
      'branchFilter'
    ).value;


  return data.filter(row => {


    /* -------------------------
       BRANCH
    ------------------------- */

    if (

      selectedBranch &&

      row.branch !==
        selectedBranch

    ) {

      return false;

    }


    /* -------------------------
       DATE
    ------------------------- */

    if (row.work_date) {

      const date =
        String(
          row.work_date
        ).substring(0, 10);


      if (
        start &&
        date < start
      ) {

        return false;

      }


      if (
        end &&
        date > end
      ) {

        return false;

      }

    }


    return true;

  });

}


/* =========================================================
   COCO KM
========================================================= */

function getCocoKm(row) {

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

      value !== null &&

      value !== undefined &&

      value !== ''

    ) {

      return (
        Number(value) || 0
      );

    }

  }


  return 0;
}


/* =========================================================
   TARGET COCO CARS
========================================================= */

function getTargetCars(
  masterData,
  selectedBranch
) {

  if (!selectedBranch) {

    return masterData.reduce(

      (sum, row) =>

        sum +
        Number(
          row.target_coco_cars || 0
        ),

      0

    );

  }


  const branch =
    masterData.find(
      row =>
        row.branch ===
        selectedBranch
    );


  return branch

    ? Number(
        branch.target_coco_cars || 0
      )

    : 0;
}


/* =========================================================
   TARGET KM
========================================================= */

function getTargetKm(
  masterData,
  selectedBranch
) {

  if (!selectedBranch) {

    return 0;

  }


  const branch =
    masterData.find(
      row =>
        row.branch ===
        selectedBranch
    );


  return branch

    ? Number(
        branch.target_km_per_car || 0
      )

    : 0;
}


/* =========================================================
   CAR BREAKDOWN
========================================================= */

function updateCarBreakdown(
  selectedBranch,
  targetCars
) {

  const container =
    document.getElementById(
      'carBreakdown'
    );


  container.innerHTML = '';


  /*
   * ระยองมี Target แยกประเภท
   */

  if (
    selectedBranch ===
    'ระยอง'
  ) {


    const breakdown = [

      {
        name:
          'ระยองสัญญา 1',

        cars:
          30

      },

      {
        name:
          'ระยองสัญญา 2',

        cars:
          5

      },

      {
        name:
          'ระยอง10W',

        cars:
          3

      }

    ];


    breakdown.forEach(item => {

      const div =
        document.createElement(
          'div'
        );


      div.className =
        'breakdown-item';


      div.innerHTML = `

        <div class="breakdown-name">
          ${item.name}
        </div>

        <div class="breakdown-value">
          ${item.cars.toLocaleString()} คัน
        </div>

      `;


      container.appendChild(
        div
      );

    });


    return;
  }


  /*
   * สาขาอื่น
   */

  if (
    selectedBranch
  ) {

    const div =
      document.createElement(
        'div'
      );


    div.className =
      'breakdown-item';


    div.innerHTML = `

      <div class="breakdown-name">
        COCO
      </div>

      <div class="breakdown-value">
        ${targetCars.toLocaleString()} คัน
      </div>

    `;


    container.appendChild(
      div
    );


    return;
  }


  /*
   * ทุกสาขา
   */

  const div =
    document.createElement(
      'div'
    );


  div.className =
    'breakdown-item';


  div.innerHTML = `

    <div class="breakdown-name">
      COCO รวมทุกสาขา
    </div>

    <div class="breakdown-value">
      ${targetCars.toLocaleString()} คัน
    </div>

  `;


  container.appendChild(
    div
  );

}


/* =========================================================
   UPDATE DASHBOARD
========================================================= */

function updateDashboard(data) {

  const selectedBranch =
    document.getElementById(
      'branchFilter'
    ).value;


  /* =====================================================
     MASTER
  ===================================================== */

  const masterData =
    getBranchMasterData(data);


  const filteredMaster =
    selectedBranch

      ? masterData.filter(
          row =>
            row.branch ===
            selectedBranch
        )

      : masterData;


  /* =====================================================
     TARGET CARS
  ===================================================== */

  const targetCars =
    getTargetCars(
      masterData,
      selectedBranch
    );


  /* =====================================================
     ACTUAL DRIVERS
  ===================================================== */

  const totalDrivers =
    filteredMaster.reduce(

      (sum, row) =>

        sum +
        Number(
          row.actual_coco_drivers || 0
        ),

      0

    );


  /* =====================================================
     DRIVER RATIO
  ===================================================== */

  const ratio =
    targetCars > 0

      ? totalDrivers /
        targetCars

      : 0;


  /* =====================================================
     TARGET KM
  ===================================================== */

  const targetKm =
    getTargetKm(
      masterData,
      selectedBranch
    );


  /* =====================================================
     FILTER DATA
  ===================================================== */

  const filteredData =
    getFilteredData(data);


  /* =====================================================
     TOTAL COCO KM
  ===================================================== */

  const totalKm =
    filteredData.reduce(

      (sum, row) =>

        sum +
        getCocoKm(row),

      0

    );


  /* =====================================================
     WORKING DAYS
  ===================================================== */

  const workingDates =
    new Set();


  filteredData.forEach(row => {

    const km =
      getCocoKm(row);


    if (

      km > 0 &&

      row.work_date

    ) {

      workingDates.add(

        String(
          row.work_date
        ).substring(0, 10)

      );

    }

  });


  const workingDays =
    workingDates.size;


  /* =====================================================
     AVG KM / DAY
  ===================================================== */

  const avgKmDay =
    workingDays > 0

      ? totalKm /
        workingDays

      : 0;


  /* =====================================================
     AVG KM / CAR
  ===================================================== */

  const avgKmCar =
    targetCars > 0

      ? totalKm /
        targetCars

      : 0;


  /* =====================================================
     CURRENT ACHIEVEMENT
  ===================================================== */

  const achievement =

    targetKm > 0

      ? (
          avgKmCar /
          targetKm
        ) * 100

      : 0;


  /* =====================================================
     BILLING CYCLE DAYS
  ===================================================== */

  const {
    start,
    end
  } =
    getSelectedDateRange();


  let cycleDays = 0;


  if (
    start &&
    end
  ) {

    const startDate =
      new Date(
        start + 'T00:00:00'
      );


    const endDate =
      new Date(
        end + 'T00:00:00'
      );


    cycleDays =
      Math.floor(

        (
          endDate -
          startDate
        ) /
        (
          1000 *
          60 *
          60 *
          24
        )

      ) + 1;

  }


  /* =====================================================
     ELAPSED DAYS
  ===================================================== */

  let elapsedDays =
    workingDays;


  /*
   * ถ้าวันนี้อยู่ในช่วง
   * และยังไม่มีข้อมูลบางวัน
   * ใช้วันปัจจุบันเป็นวันล่าสุด
   */

  if (
    start &&
    end
  ) {

    const today =
      new Date();


    const todayText =
      formatDateInput(
        today
      );


    if (
      todayText >= start &&
      todayText <= end
    ) {

      const rangeStart =
        new Date(
          start + 'T00:00:00'
        );


      const current =
        new Date(
          todayText + 'T00:00:00'
        );


      const calendarDays =
        Math.floor(

          (
            current -
            rangeStart
          ) /
          (
            1000 *
            60 *
            60 *
            24
          )

        ) + 1;


      elapsedDays =
        Math.max(
          workingDays,
          calendarDays
        );

    }

  }


  /* =====================================================
     FORECAST
  ===================================================== */

  let forecastTotalKm =
    totalKm;


  let forecastKmCar =
    avgKmCar;


  let forecastAchievement =
    achievement;


  let remainingDays =
    0;


  if (
    cycleDays > 0 &&
    elapsedDays > 0
  ) {

    remainingDays =
      Math.max(
        0,
        cycleDays -
        elapsedDays
      );


    /*
     * ใช้ KM เฉลี่ยต่อวัน
     * จากข้อมูลที่เกิดขึ้นจริง
     */

    forecastTotalKm =

      avgKmDay *
      cycleDays;


    forecastKmCar =

      targetCars > 0

        ? forecastTotalKm /
          targetCars

        : 0;


    forecastAchievement =

      targetKm > 0

        ? (
            forecastKmCar /
            targetKm
          ) * 100

        : 0;

  }


  /* =====================================================
     UPDATE MASTER KPI
  ===================================================== */

  document.getElementById(
    'cocoCars'
  ).textContent =

    targetCars.toLocaleString();


  document.getElementById(
    'cocoDrivers'
  ).textContent =

    totalDrivers.toLocaleString();


  document.getElementById(
    'driverRatio'
  ).textContent =

    ratio.toFixed(2);


  document.getElementById(
    'targetKm'
  ).textContent =

    targetKm > 0

      ? targetKm.toLocaleString()

      : '-';


  /* =====================================================
     UPDATE KM KPI
  ===================================================== */

  document.getElementById(
    'totalKm'
  ).textContent =

    Math.round(
      totalKm
    ).toLocaleString();


  document.getElementById(
    'avgKmDay'
  ).textContent =

    Math.round(
      avgKmDay
    ).toLocaleString();


  document.getElementById(
    'avgKmCar'
  ).textContent =

    Math.round(
      avgKmCar
    ).toLocaleString();


  document.getElementById(
    'kmAchievement'
  ).textContent =

    selectedBranch && targetKm > 0

      ? achievement.toFixed(1) + '%'

      : '-';


  /* =====================================================
     UPDATE FORECAST
  ===================================================== */

  document.getElementById(
    'forecastTotalKm'
  ).textContent =

    Math.round(
      forecastTotalKm
    ).toLocaleString();


  document.getElementById(
    'forecastKmCar'
  ).textContent =

    Math.round(
      forecastKmCar
    ).toLocaleString();


  document.getElementById(
    'forecastAchievement'
  ).textContent =

    selectedBranch &&
    targetKm > 0

      ? forecastAchievement.toFixed(1) + '%'

      : '-';


  document.getElementById(
    'forecastNote'
  ).textContent =

    cycleDays > 0

      ? `รอบ ${start} ถึง ${end} | ใช้ ${elapsedDays} วันในการประมาณการณ์ | เหลือ ${remainingDays} วัน`

      : '';


  /* =====================================================
     CAR BREAKDOWN
  ===================================================== */

  updateCarBreakdown(
    selectedBranch,
    targetCars
  );


  /* =====================================================
     STATUS
  ===================================================== */

  document.getElementById(
    'status'
  ).textContent =

    `ข้อมูล ${filteredData.length.toLocaleString()} รายการ`;

}


/* =========================================================
   EVENTS
========================================================= */

function setupEvents(data) {

  document
    .getElementById(
      'branchFilter'
    )
    .addEventListener(

      'change',

      () =>
        updateDashboard(data)

    );


  document
    .getElementById(
      'startDate'
    )
    .addEventListener(

      'change',

      () =>
        updateDashboard(data)

    );


  document
    .getElementById(
      'endDate'
    )
    .addEventListener(

      'change',

      () =>
        updateDashboard(data)

    );

}


/* =========================================================
   LOAD
========================================================= */

async function loadDashboard() {

  try {


    setDefaultBillingCycle();


    dashboardData =
      await fetchDashboard();


    setupBranchFilter(
      dashboardData
    );


    setupEvents(
      dashboardData
    );


    updateDashboard(
      dashboardData
    );


    console.log(
      'Dashboard data:',
      dashboardData
    );


  } catch (error) {


    console.error(
      error
    );


    document.getElementById(
      'status'
    ).textContent =

      `เกิดข้อผิดพลาด: ${error.message}`;

  }

}


loadDashboard();
