import superAdminData from './super-admin'
import hrData from './hr'
import accountsData from './accounts'
import froData from './fro'
import ngoAdminData from './ngo-admin'
import recruiterData from './recruiter'
import eventHeadData from './event-head'
import flutterAppData from './flutter-app'
import webPwaData from './web-pwa'
import databaseData from './database'
import whatsappCrmData from './whatsapp-crm'
import authData from './auth'

export const panels = [
  authData,
  superAdminData,
  hrData,
  accountsData,
  froData,
  ngoAdminData,
  recruiterData,
  eventHeadData,
  flutterAppData,
  webPwaData,
  databaseData,
  whatsappCrmData,
]

export function getPanel(id) {
  return panels.find(p => p.id === id)
}

export function searchAll(query) {
  if (!query || query.length < 2) return []
  const q = query.toLowerCase()
  const results = []
  panels.forEach(panel => {
    if (panel.noSearch) return
    if (panel.title.toLowerCase().includes(q) || panel.description?.toLowerCase().includes(q)) {
      results.push({ panel: panel.id, type: 'panel', label: panel.title, path: panel.id })
    }
    panel.screens?.forEach(screen => {
      if (screen.name.toLowerCase().includes(q) || screen.path?.toLowerCase().includes(q) || screen.logicDescription?.toLowerCase().includes(q)) {
        results.push({ panel: panel.id, type: 'screen', label: `${panel.title} → ${screen.name}`, path: `${panel.id}/${screen.path || screen.name.toLowerCase().replace(/\s+/g, '-')}` })
      }
      screen.features?.forEach(f => {
        if (f.name.toLowerCase().includes(q) || f.logicDescription?.toLowerCase().includes(q) || f.apis?.some(a => a.path?.toLowerCase().includes(q))) {
          results.push({ panel: panel.id, type: 'feature', label: `${panel.title} → ${screen.name} → ${f.name}`, path: `${panel.id}/${screen.path || screen.name.toLowerCase().replace(/\s+/g, '-')}` })
        }
      })
    })
  })
  return results.slice(0, 20)
}
