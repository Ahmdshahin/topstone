const https = require('https');
const fs = require('fs');
const path = require('path');

const url = 'https://topstone.ae/wp-content/uploads/2020/04/top-stone-square-logo-60.png';
const dest = path.join(__dirname, 'src', 'app', 'favicon.ico');

const file = fs.createWriteStream(dest);

https.get(url, (response) => {
  response.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('Favicon downloaded successfully!');
  });
}).on('error', (err) => {
  fs.unlink(dest);
  console.error('Error downloading favicon:', err.message);
});
