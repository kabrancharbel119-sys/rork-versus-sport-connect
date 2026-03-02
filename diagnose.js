const { createClient } = require('@supabase/supabase-js');

// Config Supabase
const supabaseUrl = 'https://vzycjpbrwwpvnypwzfrw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6eWNqcGJyd3dwdm55cHd6ZnJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNDY2MTAsImV4cCI6MjA4NDgyMjYxMH0.uu18NzjRGiPCMEAOVY3MFiV2V_5EY34okl_v7Fnw2io';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log('=== DIAGNOSTIC VS SPORT ===\n');

  // 1. Test connexion
  console.log('1. Test connexion Supabase...');
  const { data: testData, error: testError } = await supabase.from('users').select('count').limit(1);
  if (testError) {
    console.log('❌ Erreur connexion:', testError.message);
    return;
  }
  console.log('✅ Connexion OK\n');

  // 2. Compte les équipes
  console.log('2. Équipes dans la DB...');
  const { data: teams, error: teamsError } = await supabase.from('teams').select('*');
  if (teamsError) {
    console.log('❌ Erreur teams:', teamsError.message);
  } else {
    console.log(`✅ Nombre d'équipes: ${teams.length}`);
    if (teams.length > 0) {
      console.log('Équipes:', teams.map(t => `- ${t.name} (captain: ${t.captain_id})`).join('\n'));
    }
  }
  console.log('');

  // 3. Compte les terrains
  console.log('3. Terrains dans la DB...');
  const { data: venues, error: venuesError } = await supabase.from('venues').select('*');
  if (venuesError) {
    console.log('❌ Erreur venues:', venuesError.message);
  } else {
    console.log(`✅ Nombre de terrains: ${venues.length}`);
    if (venues.length > 0) {
      console.log('Terrains:', venues.map(v => `- ${v.name} (${v.city})`).join('\n'));
    } else {
      console.log('⚠️  Aucun terrain dans la DB !');
    }
  }
  console.log('');

  // 4. Vérifie les permissions RLS
  console.log('4. Test création équipe...');
  const testTeam = {
    name: 'Test Diagnostic',
    sport: 'Football',
    captain_id: '00000000-0000-0000-0000-000000000000',
    max_members: 15,
    city: 'Abidjan',
    is_recruiting: true
  };
  const { data: createData, error: createError } = await supabase.from('teams').insert(testTeam).select();
  if (createError) {
    console.log('❌ Impossible de créer équipe:', createError.message);
    console.log('Code:', createError.code);
    console.log('Details:', createError.details);
  } else {
    console.log('✅ Création équipe OK');
    // Supprime l'équipe de test
    await supabase.from('teams').delete().eq('id', createData[0].id);
  }
  console.log('');

  // 5. Vérifie users
  console.log('5. Utilisateurs dans la DB...');
  const { data: users, error: usersError } = await supabase.from('users').select('id, email, full_name').limit(5);
  if (usersError) {
    console.log('❌ Erreur users:', usersError.message);
  } else {
    console.log(`✅ Nombre d'utilisateurs: ${users.length}`);
  }

  console.log('\n=== FIN DIAGNOSTIC ===');
}

diagnose().catch(console.error);