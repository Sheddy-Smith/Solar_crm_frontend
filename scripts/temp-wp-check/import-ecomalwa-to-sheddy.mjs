/**
 * Import ecomalwa WP into sheddy temp site via Hostinger upload API (TUS).
 * Target ONLY: ecomalwa-migrate.hostingersite.com
 */
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import * as tus from 'tus-js-client';

const TOKEN = process.env.HOSTINGER_API_TOKEN;
const BASE = 'https://developers.hostinger.com';
const DOMAIN = 'ecomalwa-migrate.hostingersite.com';
const USERNAME = 'u808821982';
const ARCHIVE = process.env.ARCHIVE || 'C:\\Users\\shedd\\Downloads\\ecomalwa-transfer-backup\\ecomalwa_files.zip';
const SQL = process.env.SQL || 'C:\\Users\\shedd\\Downloads\\ecomalwa-transfer-backup\\db.sql';

const apiHeaders = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

function normalizePath(p) {
  return String(p).replace(/\\/g, '/').replace(/^\/+/, '');
}

async function checkEmpty() {
  const url = `${BASE}/api/hosting/v1/accounts/${USERNAME}/domains/${DOMAIN}/is-empty`;
  const { data, status } = await axios.get(url, { headers: apiHeaders, validateStatus: () => true });
  console.log('is-empty', status, JSON.stringify(data));
  if (status !== 200) throw new Error('is-empty failed: ' + JSON.stringify(data));
  if (!data.is_empty) throw new Error('Website is not empty');
}

async function uploadCredentials() {
  const url = `${BASE}/api/hosting/v1/files/upload-urls`;
  const { data, status } = await axios.post(
    url,
    { username: USERNAME, domain: DOMAIN },
    { headers: apiHeaders, validateStatus: () => true },
  );
  if (status !== 200) throw new Error('upload-urls failed: ' + JSON.stringify(data));
  return data;
}

async function uploadFile(filePath, relativePath, uploadUrl, authRestToken, authToken) {
  const stats = fs.statSync(filePath);
  const cleanUploadUrl = uploadUrl.replace(/\/$/, '');
  const uploadUrlWithFile = `${cleanUploadUrl}/${normalizePath(relativePath)}?override=true`;
  const requestHeaders = {
    'X-Auth': authToken,
    'X-Auth-Rest': authRestToken,
    'upload-length': stats.size.toString(),
    'upload-offset': '0',
  };

  console.log(`pre-upload ${relativePath} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
  await axios.post(uploadUrlWithFile, '', {
    headers: requestHeaders,
    timeout: 120000,
    validateStatus: (s) => s === 201,
  });

  const fileStream = fs.createReadStream(filePath);
  await new Promise((resolve, reject) => {
    const upload = new tus.Upload(fileStream, {
      uploadUrl: uploadUrlWithFile,
      retryDelays: [1000, 2000, 4000, 8000, 16000, 20000],
      uploadDataDuringCreation: false,
      parallelUploads: 1,
      chunkSize: 10485760,
      headers: requestHeaders,
      removeFingerprintOnSuccess: true,
      uploadSize: stats.size,
      metadata: { filename: path.basename(relativePath) },
      onError: (error) => reject(new Error(`Upload failed: ${error.message}`)),
      onProgress: (bytesUploaded, bytesTotal) => {
        const pct = ((bytesUploaded / bytesTotal) * 100).toFixed(1);
        if (bytesUploaded === bytesTotal || bytesUploaded % (50 * 1024 * 1024) < 10485760) {
          console.log(`  progress ${relativePath}: ${pct}%`);
        }
      },
      onSuccess: () => {
        console.log('uploaded OK', relativePath);
        resolve({ url: upload.url });
      },
    });
    upload.start();
  });
}

async function triggerImport(archivePath, sqlPath) {
  const url = `${BASE}/api/hosting/v1/accounts/${USERNAME}/websites/${DOMAIN}/wordpress/import`;
  const { data, status } = await axios.post(
    url,
    {
      archive_path: path.basename(archivePath),
      sql_path: path.basename(sqlPath),
    },
    { headers: apiHeaders, validateStatus: () => true, timeout: 180000 },
  );
  console.log('import trigger', status, JSON.stringify(data));
  if (status >= 400) throw new Error('import failed: ' + JSON.stringify(data));
}

async function main() {
  if (!TOKEN) throw new Error('HOSTINGER_API_TOKEN missing');
  console.log('Target:', DOMAIN);
  await checkEmpty();
  const creds = await uploadCredentials();
  const { url: uploadUrl, auth_key: authToken, rest_auth_key: authRestToken } = creds;
  if (!uploadUrl || !authToken || !authRestToken) {
    throw new Error('bad credentials: ' + JSON.stringify(creds));
  }
  console.log('upload endpoint ready');
  await uploadFile(ARCHIVE, path.basename(ARCHIVE), uploadUrl, authRestToken, authToken);
  await uploadFile(SQL, path.basename(SQL), uploadUrl, authRestToken, authToken);
  await triggerImport(ARCHIVE, SQL);
  console.log('DONE');
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
