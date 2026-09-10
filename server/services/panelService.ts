/**
 * Panel Service
 * -------------
 * Thin client for the external game-server hosting panel's Application API.
 *
 * This targets the Pterodactyl Application API v1 shape, which is also what
 * Pelican Panel (the actively-maintained Pterodactyl-compatible fork) speaks.
 * That's the "panel" this project connects to via an admin-configured API
 * key ("Link your panel" in Admin -> Platform Settings): the site itself
 * only handles marketing/billing/checkout, and delegates actually creating
 * accounts + game servers to that panel.
 *
 * Nothing in here ever runs in the browser — this is server-side only, and
 * the Application API key is never sent to the frontend in plaintext
 * (see admin.ts's /panel-settings routes for the masking convention).
 */

import crypto from 'crypto';

export interface PanelConfig {
  panelUrl: string;
  apiKey: string;
}

export class PanelApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string = 'PANEL_API_ERROR') {
    super(message);
    this.name = 'PanelApiError';
    this.status = status;
    this.code = code;
  }
}

function normalizeBaseUrl(panelUrl: string): string {
  return panelUrl.trim().replace(/\/+$/, '');
}

async function pterodactylFetch<T = any>(
  config: PanelConfig,
  path: string,
  options: { method?: string; body?: any } = {}
): Promise<T> {
  if (!config.panelUrl || !config.apiKey) {
    throw new PanelApiError('Panel is not configured. Set the panel URL and API key in Admin -> Platform Settings -> Link your panel.', 400, 'PANEL_NOT_CONFIGURED');
  }

  const base = normalizeBaseUrl(config.panelUrl);
  const url = `${base}/api/application${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Accept': 'Application/vnd.pterodactyl.v1+json',
        'Content-Type': 'application/json'
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });
  } catch (err: any) {
    throw new PanelApiError(`Could not reach the panel at ${base}: ${err.message || 'network error'}`, 502, 'PANEL_UNREACHABLE');
  }

  if (res.status === 204) {
    return {} as T;
  }

  let payload: any = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      // Non-JSON body (e.g. an HTML error page from a misconfigured URL/reverse proxy)
      throw new PanelApiError(
        `Panel returned a non-JSON response (HTTP ${res.status}). Double-check the panel URL.`,
        res.status,
        'PANEL_INVALID_RESPONSE'
      );
    }
  }

  if (!res.ok) {
    const firstError = payload?.errors?.[0];
    const message = firstError?.detail || firstError?.code || `Panel API request failed with HTTP ${res.status}`;
    throw new PanelApiError(message, res.status, firstError?.code || 'PANEL_REQUEST_FAILED');
  }

  return payload as T;
}

/** Verifies the panel URL + API key actually work. */
export async function testPanelConnection(config: PanelConfig): Promise<{ ok: true; userCount?: number }> {
  const data = await pterodactylFetch<any>(config, '/users?per_page=1');
  return { ok: true, userCount: data?.meta?.pagination?.total };
}

export interface PanelUserInput {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  password: string;
}

export interface PanelUserResult {
  id: number;
  username: string;
  email: string;
}

/** Looks up an existing panel account by email, so repeat purchases reuse the same account. */
export async function findPanelUserByEmail(config: PanelConfig, email: string): Promise<PanelUserResult | null> {
  const data = await pterodactylFetch<any>(config, `/users?filter[email]=${encodeURIComponent(email)}`);
  const match = data?.data?.[0]?.attributes;
  if (!match) return null;
  return { id: match.id, username: match.username, email: match.email };
}

export async function createPanelUser(config: PanelConfig, input: PanelUserInput): Promise<PanelUserResult> {
  const data = await pterodactylFetch<any>(config, '/users', {
    method: 'POST',
    body: {
      email: input.email,
      username: input.username,
      first_name: input.firstName || input.username,
      last_name: input.lastName || 'Customer',
      password: input.password
    }
  });
  const attrs = data?.attributes;
  if (!attrs?.id) {
    throw new PanelApiError('Panel did not return a valid user record.', 502, 'PANEL_INVALID_RESPONSE');
  }
  return { id: attrs.id, username: attrs.username, email: attrs.email };
}

export interface EggDetails {
  id: number;
  nestId: number;
  name: string;
  dockerImage: string;
  startup: string;
  environment: Record<string, string>;
}

/** Confirms the mapped egg actually exists in the panel and returns its defaults. */
export async function getEgg(config: PanelConfig, nestId: number, eggId: number): Promise<EggDetails | null> {
  try {
    const data = await pterodactylFetch<any>(config, `/nests/${nestId}/eggs/${eggId}?include=variables`);
    const attrs = data?.attributes;
    if (!attrs) return null;

    const environment: Record<string, string> = {};
    const variables = attrs?.relationships?.variables?.data || [];
    for (const v of variables) {
      const va = v?.attributes;
      if (va?.env_variable) environment[va.env_variable] = va.default_value ?? '';
    }

    return {
      id: attrs.id,
      nestId,
      name: attrs.name,
      dockerImage: attrs.docker_image,
      startup: attrs.startup,
      environment
    };
  } catch (err: any) {
    if (err instanceof PanelApiError && err.status === 404) return null;
    throw err;
  }
}

export interface CreateServerInput {
  name: string;
  userId: number;
  eggId: number;
  dockerImage: string;
  startup: string;
  environment: Record<string, string>;
  memoryMB: number;
  diskMB: number;
  cpuPercent: number;
  swapMB?: number;
  ioWeight?: number;
  databases: number;
  backups: number;
  allocations?: number;
  locationIds: number[];
  startOnCompletion?: boolean;
}

export interface CreateServerResult {
  id: number;
  identifier: string;
  name: string;
}

export async function createPanelServer(config: PanelConfig, input: CreateServerInput): Promise<CreateServerResult> {
  const data = await pterodactylFetch<any>(config, '/servers', {
    method: 'POST',
    body: {
      name: input.name,
      user: input.userId,
      egg: input.eggId,
      docker_image: input.dockerImage,
      startup: input.startup,
      environment: input.environment,
      limits: {
        memory: input.memoryMB,
        swap: input.swapMB ?? 0,
        disk: input.diskMB,
        io: input.ioWeight ?? 500,
        cpu: input.cpuPercent
      },
      feature_limits: {
        databases: input.databases,
        backups: input.backups,
        allocations: input.allocations ?? 1
      },
      deploy: {
        locations: input.locationIds,
        dedicated_ip: false,
        port_range: []
      },
      start_on_completion: input.startOnCompletion !== false
    }
  });

  const attrs = data?.attributes;
  if (!attrs?.id) {
    throw new PanelApiError('Panel did not return a valid server record.', 502, 'PANEL_INVALID_RESPONSE');
  }
  return { id: attrs.id, identifier: attrs.identifier, name: attrs.name };
}

/** Pterodactyl/Pelican usernames only allow letters, numbers, underscores, dots and dashes. */
export function sanitizePanelUsername(raw: string): string {
  let cleaned = (raw || '').toLowerCase().replace(/[^a-z0-9_.-]/g, '');
  if (cleaned.length < 3) cleaned = `${cleaned}${crypto.randomBytes(2).toString('hex')}`;
  return cleaned.slice(0, 32);
}

export function generateSecurePassword(): string {
  // 20 chars, mixed classes, URL/shell-safe — never persisted to disk (see ephemeralSecrets.ts)
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#%*-_=+';
  const all = upper + lower + digits + symbols;

  const pick = (set: string) => set[crypto.randomInt(0, set.length)];
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (chars.length < 20) chars.push(pick(all));

  // Shuffle (Fisher-Yates) so the fixed-position guarantees above aren't predictable
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
