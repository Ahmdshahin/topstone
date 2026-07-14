import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestUser() {
  const email = 'admin@topstone.com';
  const password = 'Password123!';

  console.log(`Attempting to create test user: ${email}...`);

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (error) {
    if (error.message.includes('already exists')) {
      console.log('User already exists! Credentials are valid.');
    } else {
      console.error('Error creating user:', error);
    }
    return;
  }

  console.log('Successfully created test user!');
  
  // Update the user's profile with a name and admin role
  if (data?.user) {
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        full_name: 'Admin User',
        role: 'admin' 
      })
      .eq('id', data.user.id);
      
    if (profileError) {
      console.error('Error updating profile role (is there a trigger?):', profileError);
    } else {
      console.log('Successfully applied admin role to profile.');
    }
  }
}

createTestUser();
