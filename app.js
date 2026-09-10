const SUPABASE_URL = 'https://hhsqijlcebaijtklskag.supabase.co';
const SUPABASE_KEY = 'sb_publishable_z5-j4hCd7dJ50-sLaUKraw_ZgM9ZA4W';

async function getDashboardData() {
  const url = `${SUPABASE_URL}/rest/v1/v_dashboard?select=*`;

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

async function testDashboard() {
  try {
    const data = await getDashboardData();

    console.log('Dashboard data:', data);

  } catch (error) {
    console.error('Dashboard error:', error);
  }
}

testDashboard();
