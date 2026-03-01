/**
 * Passbolt REST API client
 *
 * Thin fetch wrapper that handles:
 * - Authorization header injection (JWT Bearer)
 * - JSON parsing with Passbolt envelope unwrapping
 * - Error handling
 */

import type { PassboltAuth } from '../auth/jwt.js'

export interface PassboltResource {
  id: string
  name: string
  username?: string
  uri?: string
  description?: string
  folder_parent_id?: string | null
  resource_type_id: string
  created: string
  modified: string
}

export interface PassboltSecret {
  resource_id: string
  user_id: string
  data: string // ASCII-armored PGP blob
}

export interface PassboltFolder {
  id: string
  name: string
  folder_parent_id?: string | null
  created: string
  modified: string
}

export interface PassboltUser {
  id: string
  username: string
  profile: {
    first_name: string
    last_name: string
  }
  gpgkey?: {
    armored_key: string
    fingerprint: string
  }
}

export interface PassboltGroup {
  id: string
  name: string
}

export interface PassboltPermission {
  id: string
  aro: 'User' | 'Group'
  aro_foreign_key: string
  type: 1 | 7 | 15 // 1=Read, 7=Update, 15=Owner
}

export class PassboltClient {
  private readonly baseUrl: string
  private readonly auth: PassboltAuth

  constructor(baseUrl: string, auth: PassboltAuth) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.auth = auth
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.auth.getAccessToken()
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.headers as Record<string, string>),
      },
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Passbolt API error ${res.status} ${path}: ${body}`)
    }
    const json = (await res.json()) as { body: T }
    return json.body
  }

  // ─── Resources ──────────────────────────────────────────────────────────────

  async listResources(folderId?: string): Promise<PassboltResource[]> {
    const params = new URLSearchParams({
      'contain[secret]': '0',
      'contain[resource_type]': '1',
    })
    if (folderId) params.set('filter[has-parent]', folderId)
    return this.request<PassboltResource[]>(`/resources.json?${params}`)
  }

  async getResource(id: string): Promise<PassboltResource> {
    return this.request<PassboltResource>(`/resources/${id}.json`)
  }

  async getSecret(resourceId: string): Promise<PassboltSecret> {
    return this.request<PassboltSecret>(`/secrets/resource/${resourceId}.json`)
  }

  async createResource(data: {
    name: string
    username?: string
    uri?: string
    description?: string
    resource_type_id: string
    folder_parent_id?: string
    secrets: Array<{ user_id: string; data: string }>
  }): Promise<PassboltResource> {
    return this.request<PassboltResource>('/resources.json', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateResource(
    id: string,
    data: Partial<{
      name: string
      username: string
      uri: string
      description: string
      secrets: Array<{ user_id: string; data: string }>
    }>,
  ): Promise<PassboltResource> {
    return this.request<PassboltResource>(`/resources/${id}.json`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteResource(id: string): Promise<void> {
    await this.request<unknown>(`/resources/${id}.json`, { method: 'DELETE' })
  }

  // ─── Folders ────────────────────────────────────────────────────────────────

  async listFolders(): Promise<PassboltFolder[]> {
    return this.request<PassboltFolder[]>('/folders.json')
  }

  async createFolder(name: string, folderParentId?: string): Promise<PassboltFolder> {
    return this.request<PassboltFolder>('/folders.json', {
      method: 'POST',
      body: JSON.stringify({ name, folder_parent_id: folderParentId ?? null }),
    })
  }

  async updateFolder(id: string, name: string): Promise<PassboltFolder> {
    return this.request<PassboltFolder>(`/folders/${id}.json`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    })
  }

  async deleteFolder(id: string): Promise<void> {
    await this.request<unknown>(`/folders/${id}.json`, { method: 'DELETE' })
  }

  async moveResource(resourceId: string, folderParentId: string | null): Promise<void> {
    await this.request<unknown>(`/move/resource/${resourceId}.json`, {
      method: 'POST',
      body: JSON.stringify({ folder_parent_id: folderParentId }),
    })
  }

  // ─── Users / Groups ─────────────────────────────────────────────────────────

  async listUsers(): Promise<PassboltUser[]> {
    return this.request<PassboltUser[]>('/users.json?contain[gpgkey]=1')
  }

  async getUser(id: string): Promise<PassboltUser> {
    return this.request<PassboltUser>(`/users/${id}.json?contain[gpgkey]=1`)
  }

  async listGroups(): Promise<PassboltGroup[]> {
    return this.request<PassboltGroup[]>('/groups.json')
  }

  // ─── Permissions / Sharing ──────────────────────────────────────────────────

  async getResourcePermissions(resourceId: string): Promise<PassboltPermission[]> {
    return this.request<PassboltPermission[]>(`/permissions/resource/${resourceId}.json`)
  }

  async shareResource(
    resourceId: string,
    permissions: Array<{
      aro: 'User' | 'Group'
      aro_foreign_key: string
      type: 1 | 7 | 15
    }>,
    secrets: Array<{ user_id: string; data: string }>,
  ): Promise<void> {
    await this.request<unknown>(`/share/resource/${resourceId}.json`, {
      method: 'PUT',
      body: JSON.stringify({ permissions, secrets }),
    })
  }

  // ─── Status ─────────────────────────────────────────────────────────────────

  async getStatus(): Promise<{ version: string }> {
    return this.request<{ version: string }>('/healthcheck/status.json')
  }
}
