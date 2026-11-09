import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import tls from 'node:tls';
import https from 'node:https';
import crypto from 'node:crypto';

export interface SupabaseConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
  dbUrl: string;
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbName: string;
  configured: boolean;
}

export function getSupabaseConfig(): SupabaseConfig {
  const envPath = path.resolve(process.cwd(), '.env');
  let envText = '';
  try {
    if (fs.existsSync(envPath)) {
      envText = fs.readFileSync(envPath, 'utf8');
    }
  } catch {
    // ignore
  }

  const getVal = (key: string): string => {
    if (process.env[key]) return String(process.env[key]).trim();
    const m = envText.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+)$`, 'm'));
    return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : '';
  };

  const supabaseUrl = getVal('SUPABASE_URL');
  const serviceRoleKey = getVal('SUPABASE_SERVICE_ROLE_KEY');
  const dbUrl = getVal('SUPABASE_DB_URL');

  let dbHost = '';
  let dbPort = 6543;
  let dbUser = '';
  let dbPassword = '';
  let dbName = 'postgres';

  if (dbUrl) {
    const withoutProto = dbUrl.replace(/^postgres(?:ql)?:\/\//i, '');
    const lastAtIdx = withoutProto.lastIndexOf('@');
    if (lastAtIdx > 0) {
      const authPart = withoutProto.slice(0, lastAtIdx);
      const hostPart = withoutProto.slice(lastAtIdx + 1);
      const firstColonIdx = authPart.indexOf(':');
      dbUser = decodeURIComponent(authPart.slice(0, firstColonIdx));
      dbPassword = decodeURIComponent(authPart.slice(firstColonIdx + 1));

      const slashIdx = hostPart.indexOf('/');
      const hostPort = slashIdx >= 0 ? hostPart.slice(0, slashIdx) : hostPart;
      const pathAndQuery = slashIdx >= 0 ? hostPart.slice(slashIdx + 1) : 'postgres';
      dbName = pathAndQuery.split('?')[0] || 'postgres';

      const [h, p] = hostPort.split(':');
      dbHost = h;
      dbPort = Number(p || 6543);
    }
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    dbUrl,
    dbHost,
    dbPort,
    dbUser,
    dbPassword,
    dbName,
    configured: Boolean(supabaseUrl && serviceRoleKey && dbHost && dbPassword),
  };
}

/**
 * Supabase PostgreSQL 17 서버에 TLS + SCRAM-SHA-256 인증으로 연결한 소켓을 반환합니다.
 */
async function createAuthenticatedPgConnection(timeoutMs = 60000): Promise<tls.TLSSocket | net.Socket> {
  const cfg = getSupabaseConfig();
  if (!cfg.configured) {
    throw new Error('Supabase .env 설정이 완료되지 않았습니다.');
  }

  const conn: tls.TLSSocket | net.Socket = await new Promise((resolve, reject) => {
    const rawSocket = net.createConnection({
      host: cfg.dbHost,
      port: cfg.dbPort,
      timeout: timeoutMs,
    });

    rawSocket.on('connect', () => {
      const sslReq = Buffer.alloc(8);
      sslReq.writeInt32BE(8, 0);
      sslReq.writeInt32BE(80877103, 4);
      rawSocket.write(sslReq);
    });

    rawSocket.once('data', (chunk) => {
      const respChar = String.fromCharCode(chunk[0]);
      if (respChar === 'S') {
        const tlsSocket = tls.connect(
          {
            socket: rawSocket,
            servername: cfg.dbHost,
            rejectUnauthorized: false,
          },
          () => resolve(tlsSocket)
        );
        tlsSocket.on('error', reject);
      } else {
        resolve(rawSocket);
      }
    });

    rawSocket.on('error', reject);
  });

  // SCRAM-SHA-256 인증 수행
  await new Promise<void>((resolve, reject) => {
    const clientNonce = crypto.randomBytes(18).toString('base64');
    const clientFirstBare = `n=,r=${clientNonce}`;
    let stage = 'STARTUP';
    let buffer = Buffer.alloc(0);

    const params = `user\0${cfg.dbUser}\0database\0${cfg.dbName}\0client_encoding\0UTF8\0\0`;
    const len = 4 + 4 + Buffer.byteLength(params);
    const buf = Buffer.alloc(len);
    buf.writeInt32BE(len, 0);
    buf.writeInt32BE(196608, 4);
    buf.write(params, 8);
    conn.write(buf);

    const onData = (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 5) {
        const type = String.fromCharCode(buffer[0]);
        const msgLen = buffer.readInt32BE(1);
        if (buffer.length < 1 + msgLen) break;
        const body = buffer.subarray(5, 1 + msgLen);
        buffer = buffer.subarray(1 + msgLen);

        if (type === 'R') {
          const authCode = body.readInt32BE(0);
          if (authCode === 10 && stage === 'STARTUP') {
            stage = 'SASL_INITIAL';
            const mech = 'SCRAM-SHA-256\0';
            const initialResp = Buffer.from(`n,,${clientFirstBare}`, 'utf8');
            const mLen = 4 + Buffer.byteLength(mech) + 4 + initialResp.length;
            const out = Buffer.alloc(1 + mLen);
            out.write('p', 0);
            out.writeInt32BE(mLen, 1);
            out.write(mech, 5);
            out.writeInt32BE(initialResp.length, 5 + Buffer.byteLength(mech));
            initialResp.copy(out, 9 + Buffer.byteLength(mech));
            conn.write(out);
          } else if (authCode === 11 && stage === 'SASL_INITIAL') {
            stage = 'SASL_CONTINUE';
            const serverFirst = body.subarray(4).toString('utf8');
            const parts = Object.fromEntries(serverFirst.split(',').map((kv) => [kv[0], kv.slice(2)]));
            const r = parts.r;
            const s = Buffer.from(parts.s, 'base64');
            const i = parseInt(parts.i, 10);

            const saltedPassword = crypto.pbkdf2Sync(cfg.dbPassword, s, i, 32, 'sha256');
            const clientKey = crypto.createHmac('sha256', saltedPassword).update('Client Key').digest();
            const storedKey = crypto.createHash('sha256').update(clientKey).digest();
            const clientFinalWithoutProof = `c=biws,r=${r}`;
            const authMessage = `${clientFirstBare},${serverFirst},${clientFinalWithoutProof}`;
            const clientSignature = crypto.createHmac('sha256', storedKey).update(authMessage).digest();
            const clientProof = Buffer.alloc(clientKey.length);
            for (let k = 0; k < clientKey.length; k++) {
              clientProof[k] = clientKey[k] ^ clientSignature[k];
            }
            const finalMsg = Buffer.from(`${clientFinalWithoutProof},p=${clientProof.toString('base64')}`, 'utf8');
            const mLen = 4 + finalMsg.length;
            const out = Buffer.alloc(1 + mLen);
            out.write('p', 0);
            out.writeInt32BE(mLen, 1);
            finalMsg.copy(out, 5);
            conn.write(out);
          }
        } else if (type === 'Z') {
          conn.removeListener('data', onData);
          resolve();
          return;
        } else if (type === 'E') {
          conn.removeListener('data', onData);
          conn.destroy();
          reject(new Error(body.toString('utf8').replace(/\0/g, ' | ')));
          return;
        }
      }
    };

    conn.on('data', onData);
  });

  return conn;
}

/**
 * Supabase PostgreSQL에서 SQL(DDL/DML/SELECT)을 실행하고 결과를 반환합니다.
 */
export async function runPostgresQuery(sql: string, timeoutMs = 120000): Promise<{ rows: any[]; fields: string[] }> {
  const conn = await createAuthenticatedPgConnection(timeoutMs);

  return new Promise((resolve, reject) => {
    const fields: string[] = [];
    const rows: any[] = [];
    let buffer = Buffer.alloc(0);

    const qBytes = Buffer.from(sql + '\0', 'utf8');
    const qLen = 4 + qBytes.length;
    const qBuf = Buffer.alloc(1 + qLen);
    qBuf.write('Q', 0);
    qBuf.writeInt32BE(qLen, 1);
    qBytes.copy(qBuf, 5);
    conn.write(qBuf);

    conn.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 5) {
        const type = String.fromCharCode(buffer[0]);
        const msgLen = buffer.readInt32BE(1);
        if (buffer.length < 1 + msgLen) break;
        const body = buffer.subarray(5, 1 + msgLen);
        buffer = buffer.subarray(1 + msgLen);

        if (type === 'T') {
          fields.length = 0;
          const colCount = body.readInt16BE(0);
          let pos = 2;
          for (let c = 0; c < colCount; c++) {
            const zeroIdx = body.indexOf(0, pos);
            const colName = body.subarray(pos, zeroIdx).toString('utf8');
            fields.push(colName);
            pos = zeroIdx + 1 + 18;
          }
        } else if (type === 'D') {
          const colCount = body.readInt16BE(0);
          let pos = 2;
          const rowObj: Record<string, any> = {};
          for (let c = 0; c < colCount; c++) {
            const vLen = body.readInt32BE(pos);
            pos += 4;
            const colName = fields[c] || `col_${c}`;
            if (vLen === -1) {
              rowObj[colName] = null;
            } else {
              rowObj[colName] = body.subarray(pos, pos + vLen).toString('utf8');
              pos += vLen;
            }
          }
          rows.push(rowObj);
        } else if (type === 'E') {
          const errStr = body.toString('utf8').replace(/\0/g, ' | ');
          conn.destroy();
          reject(new Error(errStr));
          return;
        } else if (type === 'Z') {
          conn.destroy();
          resolve({ rows, fields });
          return;
        }
      }
    });

    conn.on('error', (err) => {
      conn.destroy();
      reject(err);
    });
  });
}

/**
 * Supabase PostgREST API를 통해 실시간 Upsert(INSERT OR UPDATE)를 수행합니다.
 * 대량 배열인 경우 500건 단위로 자동 분할하여 전송합니다.
 */
export async function supabaseRestUpsert(
  table: string,
  payload: Record<string, any> | Record<string, any>[],
  onConflict?: string
): Promise<boolean> {
  const cfg = getSupabaseConfig();
  if (!cfg.configured) return false;

  if (Array.isArray(payload) && payload.length > 500) {
    let allOk = true;
    for (let i = 0; i < payload.length; i += 500) {
      const slice = payload.slice(i, i + 500);
      const ok = await supabaseRestUpsert(table, slice, onConflict);
      if (!ok) allOk = false;
    }
    return allOk;
  }

  const query = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : '';
  const u = new URL(`${cfg.supabaseUrl}/rest/v1/${table}${query}`);
  const bodyStr = JSON.stringify(payload);

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: u.hostname,
        port: 443,
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          apikey: cfg.serviceRoleKey,
          Authorization: `Bearer ${cfg.serviceRoleKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
          'Content-Length': Buffer.byteLength(bodyStr),
        },
        rejectUnauthorized: false,
      },
      (res) => {
        res.on('data', () => {});
        res.on('end', () => {
          resolve(Boolean(res.statusCode && res.statusCode >= 200 && res.statusCode < 300));
        });
      }
    );
    req.on('error', () => resolve(false));
    req.write(bodyStr);
    req.end();
  });
}

/**
 * Supabase PostgREST API를 통해 원격 테이블 데이터를 실시간 조회(SELECT)합니다.
 */
export async function supabaseRestSelect(
  table: string,
  filterQuery = 'select=*'
): Promise<any[]> {
  const cfg = getSupabaseConfig();
  if (!cfg.configured) return [];

  const q = filterQuery.startsWith('?') ? filterQuery.slice(1) : filterQuery;
  const u = new URL(`${cfg.supabaseUrl}/rest/v1/${table}?${q}`);

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: u.hostname,
        port: 443,
        path: u.pathname + u.search,
        method: 'GET',
        headers: {
          apikey: cfg.serviceRoleKey,
          Authorization: `Bearer ${cfg.serviceRoleKey}`,
          Accept: 'application/json',
        },
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on('end', () => {
          try {
            if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
              resolve([]);
              return;
            }
            const raw = Buffer.concat(chunks).toString('utf8');
            const parsed = JSON.parse(raw);
            resolve(Array.isArray(parsed) ? parsed : []);
          } catch {
            resolve([]);
          }
        });
      }
    );
    req.on('error', () => resolve([]));
    req.end();
  });
}

/**
 * Supabase PostgREST API를 통해 실시간 Delete를 수행합니다.
 */
export async function supabaseRestDelete(table: string, filterQuery: string): Promise<boolean> {
  const cfg = getSupabaseConfig();
  if (!cfg.configured) return false;

  const u = new URL(`${cfg.supabaseUrl}/rest/v1/${table}?${filterQuery}`);
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: u.hostname,
        port: 443,
        path: u.pathname + u.search,
        method: 'DELETE',
        headers: {
          apikey: cfg.serviceRoleKey,
          Authorization: `Bearer ${cfg.serviceRoleKey}`,
        },
        rejectUnauthorized: false,
      },
      (res) => {
        res.on('data', () => {});
        res.on('end', () => {
          resolve(Boolean(res.statusCode && res.statusCode >= 200 && res.statusCode < 300));
        });
      }
    );
    req.on('error', () => resolve(false));
    req.end();
  });
}
