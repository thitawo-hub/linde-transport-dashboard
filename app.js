const SUPABASE_URL = 'https://hhsqijlcebaijtklskag.supabase.co';
const SUPABASE_KEY = 'sb_publishable_z5-j4hCd7dJ50-sLaUKraw_ZgM9ZA4W';

let dashboardData = [];


/* =========================
   SUPABASE
========================= */

async function fetchDashboard() {

  const url =
    `${SUPABASE_URL}/rest/v1/v_dashboard?select=*`;

  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase Error ${response.status}`);
  }

  return await response.json();
}


/* =========================
   BILLING CYCLE 26 - 25
========================= */

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


function formatDateInput(date) {

  const year = date.getFullYear();

  const month =
    String(date.getMonth() + 1).padStart(2, '0');

  const day =
    String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}


/* =========================
   DATE FILTER
========================= */

function getSelectedDateRange() {

  const start =
    document.getElementById('startDate').value;

  const end =
    document.getElementById('endDate').value;

  return {
    start,
    end
  };
}


/* =========================
   BRANCH
========================= */

function setupBranchFilter(data) {

  const select =
    document.getElementById('branchFilter');

  const branches = [
    ...new Set(
      data
        .map(row => row.branch)
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


/* =========================
   MASTER DATA
========================= */

function getBranchMasterData(data) {

  const map = new Map();

  data.forEach(row => {

    if (!row.branch) return;

    if (!map.has(row.branch)) {

      map.set(row.branch, {

        branch: row.branch,

        actual_coco_cars:
          Number(row.actual_coco_cars || 0),

        actual_coco_drivers:
          Number(row.actual_coco_drivers || 0),

        actual_driver_ratio:
          Number(row.actual_driver_ratio || 0),

        target_km_per_car:
          Number(row.target_km_per_car || 0)
      });
    }
  });

  return [...map.values()];
}


/* =========================
   FILTER DATA
========================= */

function getFilteredData(data) {

  const {
    start,
    end
  } = getSelectedDateRange();

  const selectedBranch =
    document.getElementById('branchFilter').value;

  return data.filter(row => {

    /* Branch */

    if (
      selectedBranch &&
      row.branch !== selectedBranch
    ) {
      return false;
    }


    /* Date */

    if (row.work_date) {

      const date =
        String(row.work_date).substring(0, 10);

      if (start && date < start) {
        return false;
      }

      if (end && date > end) {
        return false;
      }
    }

    return true;
  });
}


/* =========================
   GET COCO KM
========================= */

function getCocoKm(row) {

  /*
   * v_dashboard ใช้ค่า COCO KM
   * ถ้าชื่อ field ต่างกัน ให้ fallback
   */

  const candidates = [
    row.coco_km,
    row.total_coco_km,
    row.daily_coco_km,
    row.actual_coco_km
  ];

  for (const value of candidates) {

    if (
      value !== null &&
      value !== undefined &&
      value !== ''
    ) {
      return Number(value) || 0;
    }
  }

  return 0;
}


/* =========================
   UPDATE DASHBOARD
========================= */

function updateDashboard(data) {

  const selectedBranch =
    document.getElementById('branchFilter').value;


  /* =========================
     MASTER
  ========================= */

  const masterData =
    getBranchMasterData(data);

  const filteredMaster =
    selectedBranch
      ? masterData.filter(
          x => x.branch === selectedBranch
        )
      : masterData;


  /* =========================
     CAR
  ========================= */

  const totalCars =
    filteredMaster.reduce(
      (sum, x) =>
        sum +
        Number(x.actual_coco_cars || 0),
      0
    );


  /* =========================
     DRIVER
  ========================= */

  const totalDrivers =
    filteredMaster.reduce(
      (sum, x) =>
        sum +
        Number(x.actual_coco_drivers || 0),
      0
    );


  /* =========================
     DRIVER RATIO
  ========================= */

  const ratio =
    totalCars > 0
      ? totalDrivers / totalCars
      : 0;


  /* =========================
     TARGET KM
  ========================= */

  let targetKm = '-';

  if (selectedBranch) {

    const branch =
      filteredMaster[0];

    if (
      branch &&
      branch.target_km_per_car
    ) {

      targetKm =
        Number(
          branch.target_km_per_car
        ).toLocaleString();
    }
  }


  /* =========================
     FILTERED DATA
  ========================= */

  const filteredData =
    getFilteredData(data);


  /* =========================
     TOTAL COCO KM
  ========================= */

  const totalKm =
    filteredData.reduce(
      (sum, row) =>
        sum + getCocoKm(row),
      0
    );


  /* =========================
     WORKING DAYS
  ========================= */

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
        String(row.work_date)
          .substring(0, 10)
      );
    }
  });

  const workingDays =
    workingDates.size;


  /* =========================
     AVG KM / DAY
  ========================= */

  const avgKmDay =
    workingDays > 0
      ? totalKm / workingDays
      : 0;


  /* =========================
     AVG KM / CAR
  ========================= */

  const avgKmCar =
    totalCars > 0
      ? totalKm / totalCars
      : 0;


  /* =========================
     ACHIEVEMENT
  ========================= */

  let achievement = 0;

  if (
    totalCars > 0 &&
    selectedBranch &&
    filteredMaster[0] &&
    Number(
      filteredMaster[0].target_km_per_car
    ) > 0
  ) {

    achievement =
      (
        avgKmCar /
        Number(
          filteredMaster[0].target_km_per_car
        )
      ) * 100;
  }


  /* =========================
     UPDATE OLD KPI
  ========================= */

  document.getElementById('cocoCars').textContent =
    totalCars.toLocaleString();

  document.getElementById('cocoDrivers').textContent =
    totalDrivers.toLocaleString();

  document.getElementById('driverRatio').textContent =
    ratio.toFixed(2);

  document.getElementById('targetKm').textContent =
    targetKm;


  /* =========================
     UPDATE KM KPI
  ========================= */

  document.getElementById('totalKm').textContent =
    Math.round(totalKm).toLocaleString();

  document.getElementById('avgKmDay').textContent =
    Math.round(avgKmDay).toLocaleString();

  document.getElementById('avgKmCar').textContent =
    Math.round(avgKmCar).toLocaleString();

  document.getElementById('kmAchievement').textContent =
    selectedBranch
      ? achievement.toFixed(1) + '%'
      : '-';


  /* =========================
     STATUS
  ========================= */

  document.getElementById('status').textContent =
    `ข้อมูล ${filteredData.length.toLocaleString()} รายการ`;
}


/* =========================
   EVENTS
========================= */

function setupEvents(data) {

  document
    .getElementById('branchFilter')
    .addEventListener(
      'change',
      () => updateDashboard(data)
    );

  document
    .getElementById('startDate')
    .addEventListener(
      'change',
      () => updateDashboard(data)
    );

  document
    .getElementById('endDate')
    .addEventListener(
      'change',
      () => updateDashboard(data)
    );
}


/* =========================
   LOAD
========================= */

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

    console.error(error);

    document.getElementById('status').textContent =
      `เกิดข้อผิดพลาด: ${error.message}`;
  }
}


loadDashboard();
