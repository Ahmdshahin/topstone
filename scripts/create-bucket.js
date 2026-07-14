const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables from .env.local
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));

const supabase = createClient(
  envConfig.NEXT_PUBLIC_SUPABASE_URL,
  envConfig.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data, error } = await supabase.storage.createBucket('gallery', {
    public: true,
    fileSizeLimit: 10485760, // 10MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  });

  if (error) {
    if (error.message.includes('already exists')) {
      console.log('Bucket "gallery" already exists.');
    } else {
      console.error('Error creating bucket:', error);
    }
  } else {
    console.log('Successfully created public bucket "gallery".', data);
  }
}

main();
