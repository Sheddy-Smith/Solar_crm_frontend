/**
 * Deploy local dist/ to Hostinger static hosting for crm.ecomalwa.com.
 *
 * Requires:
 *   dist/  — from: VITE_API_URL=https://api.crm.ecomalwa.com/api/v1 npm run build
 *
 * Auth (either):
 *   HOSTINGER_TUS_URL + HOSTINGER_TUS_AUTH + HOSTINGER_TUS_REST
 *   or HOSTINGER_API_TOKEN (falls back to Hostinger upload-urls API)
 *
 * TUS base URL already ends at public_html — set REMOTE_ROOT=crm (default when
 * HOSTINGER_TUS_URL is set). Without TUS env, default REMOTE_ROOT=public_html/crm.
 */
import fs from 'fs';
import path from 'path';

const TOKEN = process.env.HOSTINGER_API_TOKEN;
const BASE = 'https://developers.hostinger.com';
const USERNAME = process.env.HOSTINGER_USERNAME || 'u808821982';
const DOMAIN = process.env.DOMAIN || 'ecomalwa.com';
const hasPrefetchedTus = Boolean(
  process.env.HOSTINGER_TUS_URL && process.env.HOSTINGER_TUS_AUTH && process.env.HOSTINGER_TUS_REST,
);
const REMOTE_ROOT = (
  process.env.REMOTE_ROOT || (hasPrefetchedTus ? 'crm' : 'public_html/crm')
).replace(/^\/+|\/+$/g, '');
const DIST = path.resolve(process.env.DIST || 'dist');

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
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username: USERNAME, domain: DOMAIN }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`upload-urls failed (${res.status}): ${JSON.stringify(data)}`);
  return data;
}

async function createTusUpload(uploadUrlWithFile, authHeaders, size) {
  const res = await fetch(uploadUrlWithFile, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Tus-Resumable': '1.0.0',
      'Upload-Length': String(size),
      'Upload-Offset': '0',
    },
  });
  if (res.status !== 201 && res.status !== 204) {
    const text = await res.text().catch(() => '');
    throw new Error(`TUS create failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

async function patchTusUpload(uploadUrlWithFile, authHeaders, filePath, size) {
  const buf = fs.readFileSync(filePath);
  const chunkSize = 10 * 1024 * 1024;
  let offset = 0;
  while (offset < size) {
    const end = Math.min(offset + chunkSize, size);
    const chunk = buf.subarray(offset, end);
    const res = await fetch(uploadUrlWithFile, {
      method: 'PATCH',
      headers: {
        ...authHeaders,
        'Tus-Resumable': '1.0.0',
        'Content-Type': 'application/offset+octet-stream',
        'Upload-Offset': String(offset),
        'Content-Length': String(chunk.length),
      },
      body: chunk,
    });
    if (res.status !== 204 && res.status !== 200) {
      const text = await res.text().catch(() => '');
      throw new Error(`TUS patch failed at ${offset} (${res.status}): ${text.slice(0, 200)}`);
    }
    const next = res.headers.get('Upload-Offset');
    offset = next ? Number(next) : end;
  }
}

async function uploadFile(filePath, relativePath, uploadUrl, authRestToken, authToken) {
  const stats = fs.statSync(filePath);
  const cleanUploadUrl = uploadUrl.replace(/\/$/, '');
  const uploadUrlWithFile = `${cleanUploadUrl}/${normalizePath(relativePath)}?override=true`;
  const authHeaders = {
    'X-Auth': authToken,
    'X-Auth-Rest': authRestToken,
  };

  await createTusUpload(uploadUrlWithFile, authHeaders, stats.size);

  // Prefer tus-js-client when installed; otherwise native PATCH chunks.
  try {
    const tus = await import('tus-js-client');
    const fileStream = fs.createReadStream(filePath);
    await new Promise((resolve, reject) => {
      const upload = new tus.Upload(fileStream, {
        uploadUrl: uploadUrlWithFile,
        retryDelays: [1000, 2000, 4000, 8000, 16000, 20000],
        uploadDataDuringCreation: false,
        parallelUploads: 1,
        chunkSize: 10485760,
        headers: {
          ...authHeaders,
          'upload-length': stats.size.toString(),
          'upload-offset': '0',
        },
        removeFingerprintOnSuccess: true,
        uploadSize: stats.size,
        metadata: { filename: path.basename(relativePath) },
        onError: (error) => reject(new Error(`Upload failed ${relativePath}: ${error.message}`)),
        onSuccess: () => resolve(),
      });
      upload.start();
    });
  } catch (err) {
    if (err && err.code === 'ERR_MODULE_NOT_FOUND') {
      await patchTusUpload(uploadUrlWithFile, authHeaders, filePath, stats.size);
      return;
    }
    // If tus client started then failed mid-upload, fall back once.
    if (String(err.message || err).includes('Upload failed')) {
      await patchTusUpload(uploadUrlWithFile, authHeaders, filePath, stats.size);
      return;
    }
    throw err;
  }
}

async function main() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    throw new Error(`Missing ${DIST}/index.html — run production build first`);
  }

  const files = walkFiles(DIST);
  console.log(`==> Deploy ${files.length} files from ${DIST}`);
  console.log(`==> Target ${USERNAME}@${DOMAIN}:${REMOTE_ROOT}/`);

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
