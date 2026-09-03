#!/usr/bin/env node
/**
 * Smoke: register → RR + SE + DE + GK (group stage → seed KO)
 */
const API = process.env.API_URL || 'http://localhost:3001';

async function req(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return data;
}

async function main() {
  const email = `smoke_${Date.now()}@example.com`;
  console.log('1. Register', email);
  const auth = await req('/auth/register', {
    method: 'POST',
    body: { email, password: 'password123', name: 'Smoke Tester' },
  });
  const token = auth.accessToken;

  console.log('2. /auth/me');
  const me = await req('/auth/me', { token });
  if (me.user.email !== email) throw new Error('me mismatch');

  console.log('3. ROUND_ROBIN');
  let t = await req('/tournaments', {
    method: 'POST',
    token,
    body: { name: 'Smoke RR' },
  });
  await req(`/tournaments/${t.id}/teams`, {
    method: 'POST',
    token,
    body: {
      teams: [
        { name: 'Alpha' },
        { name: 'Bravo' },
        { name: 'Charlie' },
        { name: 'Delta' },
      ],
    },
  });
  t = await req(`/tournaments/${t.id}/generate`, {
    method: 'POST',
    token,
    body: { format: 'ROUND_ROBIN' },
  });
  console.log('   matches:', t.matches.length);
  await req(`/matches/${t.matches[0].id}/result`, {
    method: 'PATCH',
    token,
    body: { homeScore: 3, awayScore: 1, homePercent: 70, awayPercent: 40 },
  });
  const pub = await req(`/t/${t.slug}`);
  console.log('   standings:', pub.standings.length);

  console.log('4. SINGLE_ELIMINATION');
  t = await req('/tournaments', {
    method: 'POST',
    token,
    body: { name: 'Smoke SE' },
  });
  await req(`/tournaments/${t.id}/teams`, {
    method: 'POST',
    token,
    body: {
      teams: [{ name: 'W' }, { name: 'X' }, { name: 'Y' }, { name: 'Z' }],
    },
  });
  t = await req(`/tournaments/${t.id}/generate`, {
    method: 'POST',
    token,
    body: { format: 'SINGLE_ELIMINATION' },
  });
  console.log('   SE matches:', t.matches.length);

  console.log('5. DOUBLE_ELIMINATION');
  t = await req('/tournaments', {
    method: 'POST',
    token,
    body: { name: 'Smoke DE' },
  });
  await req(`/tournaments/${t.id}/teams`, {
    method: 'POST',
    token,
    body: {
      teams: [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }],
    },
  });
  t = await req(`/tournaments/${t.id}/generate`, {
    method: 'POST',
    token,
    body: { format: 'DOUBLE_ELIMINATION' },
  });
  console.log(
    '   DE matches:',
    t.matches.length,
    'GF:',
    t.matches.some((m) => m.key === 'de-gf'),
  );

  console.log('6. GROUPS_KNOCKOUT + seed');
  t = await req('/tournaments', {
    method: 'POST',
    token,
    body: { name: 'Smoke GK' },
  });
  await req(`/tournaments/${t.id}/teams`, {
    method: 'POST',
    token,
    body: {
      teams: [
        { name: 'A1', groupName: 'Group A' },
        { name: 'A2', groupName: 'Group A' },
        { name: 'B1', groupName: 'Group B' },
        { name: 'B2', groupName: 'Group B' },
      ],
    },
  });
  t = await req(`/tournaments/${t.id}/generate`, {
    method: 'POST',
    token,
    body: { format: 'GROUPS_KNOCKOUT', advancePerGroup: 1 },
  });
  const groupMatches = t.matches.filter((m) => m.bracketSide === 'GROUP');
  for (const m of groupMatches) {
    await req(`/matches/${m.id}/result`, {
      method: 'PATCH',
      token,
      body: { homeScore: 2, awayScore: 0 },
    });
  }
  const after = await req(`/t/${t.slug}`, { token });
  const koR1 = after.matches.filter(
    (m) => m.key.startsWith('gk-') && m.round === 1,
  );
  const seeded = koR1.every((m) => m.homeTeamId && m.awayTeamId);
  console.log('   KO seeded:', seeded, 'r1 teams:', koR1.map((m) => `${m.homeTeam?.name} vs ${m.awayTeam?.name}`).join(', '));
  if (!seeded) throw new Error('KO not seeded after group stage');

  console.log('7. Health');
  const health = await req('/health');
  console.log('  ', health);

  console.log('\nSmoke OK (web-only complete path)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
