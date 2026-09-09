import { api, apiGet, apiPost, apiPut, apiPatch, apiDelete } from './auth'

// Certificate template management & generator — mirrors the /certificates routes
// mounted on the backend (paths below are relative to the /api base).
export const certificateApi = {
  listTemplates: (status = '') => apiGet(`/certificates/templates${status ? `?status=${status}` : ''}`),
  getNgoOptions: () => apiGet(`/certificates/templates/ngos-options`),
  getTemplate: (id) => apiGet(`/certificates/templates/${id}`),
  getTemplateFile: (id) =>
    api(`/certificates/templates/${id}/file`, { method: 'GET', _prefix: 'ucs', raw: true, timeout: 60000 }),
  createTemplate: (formData) => apiPost(`/certificates/templates`, formData, 60000),
  updateTemplate: (id, body) => apiPut(`/certificates/templates/${id}`, { ...body, fields: body.fields }),

  // Re-upload the immutable template file (creates a new version snapshot).
  reuploadTemplate: (id, formData) => apiPost(`/certificates/templates/${id}/file`, formData, 60000),
  setTemplatePreview: (id, formData) => apiPost(`/certificates/templates/${id}/preview`, formData, 60000),
  snapshotAllTemplates: () => apiPost(`/certificates/templates/snapshot-all`, {}),
  duplicateTemplate: (id) => apiPost(`/certificates/templates/${id}/duplicate`, {}),
  setStatus: (id, status) => apiPatch(`/certificates/templates/${id}/status`, { status }),
  deleteTemplate: (id) => apiDelete(`/certificates/templates/${id}`),

  // Live preview returns the raw (unpersisted) filled file blob.
  preview: (payload) =>
    api(`/certificates/certificates/preview`, {
      method: 'POST',
      body: JSON.stringify(payload),
      _prefix: 'ucs',
      raw: true,
      timeout: 40000,
    }),

  generate: (payload) => apiPost(`/certificates/certificates/generate`, payload, 90000),
  bulkGenerate: (payload) => apiPost(`/certificates/certificates/bulk`, payload, 180000),
  listCertificates: (q = '') => apiGet(`/certificates/certificates${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getCertificate: (id) => apiGet(`/certificates/certificates/${id}`),
}