/**
 * Deploy local dist/ to Hostinger static hosting for crm.ecomalwa.com.
 *
 * Requires:
 *   HOSTINGER_API_TOKEN  — Hostinger API token
 *   dist/                — from: VITE_API_URL=https://api.crm.ecomalwa.com/api/v1 npm run build
 *
 * Uploads into public_html/crm (subfolder of the ecomalwa.com account) by default.
 * Override with:
 *   DOMAIN=crm.ecomalwa.com   (if CRM is its own Hostinger website)
 *   REMOTE_ROOT=public_html   (document root for that website)
 */
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import * as tus from 'tus-js-client';

const TOKEN = process.env.HOSTINGER_API_TOKEN;
const BASE = 'https://developers.hostinger.com';
const USERNAME = process.env.HOSTINGER_USERNAME || 'u808821982';
const DOMAIN = process.env.DOMAIN || 'ecomalwa.com';
const REMOTE_ROOT = (process.env.REMOTE_ROOT || 'public_html/crm').replace(/^\/+|\/+$/g, '');
const DIST = path.resolve(process.env.DIST || 'dist');

const apiHeaders = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

function normalizePath(p) {
  return String(p).replace(/\\/g, '/').replace(/^\/+/, '');
}

function walkFiles(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, base, out);
    else out.push(path.relative(base, full));
  }
  return out;
}

async function uploadCredentials() {
  const url = `${BASE}/api/hosting/v1/files/upload-urls`;
  const { data, status } = await axios.post(
    url,
    { username: USERNAME, domain: DOMAIN },
    { headers: apiHeaders, validateStatus: () => true },
  );
  if (status !== 200) throw new Error(`upload-urls failed (${status}): ${JSON.stringify(data)}`);
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
      onError: (error) => reject(new Error(`Upload failed ${relativePath}: ${error.message}`)),
      onSuccess: () => resolve(),
    });
    upload.start();
  });
}

async function main() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    throw new Error(`Missing ${DIST}/index.html — run production build first`);
  }

  const files = walkFiles(DIST);
  console.log(`==> Deploy ${files.length} files from ${DIST}`);
  console.log(`==> Target ${USERNAME}@${DOMAIN}:${REMOTE_ROOT}/`);

  // Prefer pre-fetched TUS credentials (Hostinger MCP generate-upload-url).
  let uploadUrl = process.env.HOSTINGER_TUS_URL || '';
  let authRestToken = process.env.HOSTINGER_TUS_REST || '';
  let authToken = process.env.HOSTINGER_TUS_AUTH || '';
  if (!uploadUrl || !authRestToken || !authToken) {
    if (!TOKEN) throw new Error('HOSTINGER_API_TOKEN missing (or set HOSTINGER_TUS_URL/AUTH/REST)');
    const creds = await uploadCredentials();
    uploadUrl = creds.upload_url || creds.url;
    authRestToken = creds.auth_rest_token || creds.authRestToken || creds.rest_auth_key;
    authToken = creds.auth_token || creds.authToken || creds.auth_key;
  }
  if (!uploadUrl || !authRestToken || !authToken) {
    throw new Error('Missing TUS upload credentials');
  }

  let i = 0;
  for (const rel of files) {
    i += 1;
    const local = path.join(DIST, rel);
    const remote = normalizePath(`${REMOTE_ROOT}/${rel.replace(/\\/g, '/')}`);
    process.stdout.write(`[${i}/${files.length}] ${remote} ... `);
    await uploadFile(local, remote, uploadUrl, authRestToken, authToken);
    console.log('ok');
  }

  console.log('==> DONE frontend upload');
  console.log('Verify: https://crm.ecomalwa.com/ (hard refresh)');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
