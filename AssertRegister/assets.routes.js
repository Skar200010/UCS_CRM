// ============================================
// ASSET REGISTER ROUTES (Node/Express + Supabase)
// File: routes/assets.js
//
// Server mein mount karo (apne baaki routes ki tarah):
//   import assetsRoutes from './routes/assets.js'
//   app.use('/assets', assetsRoutes)          // auth middleware ke saath, e.g.:
//   app.use('/assets', requireAuth, assetsRoutes)
//
// NOTE: Agar aapka backend CommonJS hai (require wala), toh upar-niche ke
// import/export ko require/module.exports mein badal lena:
//   const express = require('express')
//   const { supabase } = require('../supabaseClient')
//   ...
//   module.exports = router
// ============================================

import express from 'express'
import { supabase } from '../supabaseClient.js' // <-- apne supabase client ka sahi path daalo

const router = express.Router()

/* ---------- helpers ---------- */

// empty string ko null bana do (date/numeric columns ke liye zaroori)
const DATE_FIELDS = ['purchase_date', 'warranty_expiry', 'assigned_date', 'repair_date']
const NUM_FIELDS = ['purchase_price', 'sim_plan', 'repair_cost', 'total_repair_cost']

function sanitize(body) {
  const b = { ...body }
  delete b.id            // id kabhi client se accept mat karo
  delete b.created_at
  DATE_FIELDS.forEach(k => { if (b[k] === '' || b[k] === undefined) delete b[k]; if (b[k] === null) b[k] = null })
  NUM_FIELDS.forEach(k => { if (b[k] === '') b[k] = null })
  return b
}

// next asset code nikalo: AST-001, AST-002...
async function nextCode() {
  const { data } = await supabase.from('assets').select('code')
  const max = (data || []).reduce((m, r) => {
    const n = parseInt(String(r.code || '').replace(/\D/g, ''), 10)
    return isNaN(n) ? m : Math.max(m, n)
  }, 0)
  return `AST-${String(max + 1).padStart(3, '0')}`
}

/* ---------- GET /assets — pura register ---------- */
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

/* ---------- GET /assets/:id — ek asset ---------- */
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('id', req.params.id)
    .single()
  if (error) return res.status(404).json({ error: 'Asset not found' })
  res.json(data)
})

/* ---------- POST /assets — naya asset add ---------- */
router.post('/', async (req, res) => {
  const body = sanitize(req.body)

  if (!body.name || !String(body.name).trim()) {
    return res.status(400).json({ error: 'Asset name is required' })
  }

  // code auto-generate agar nahi bheja
  if (!body.code) body.code = await nextCode()

  // pehli history entry
  if (!Array.isArray(body.history) || body.history.length === 0) {
    body.history = [{ date: new Date().toISOString().slice(0, 10), text: 'Asset registered' }]
  }
  if (!body.status) body.status = 'available'

  const { data, error } = await supabase
    .from('assets')
    .insert(body)
    .select()
    .single()

  if (error) {
    // duplicate code ka case — ek baar aur try karo naye code se
    if (String(error.message).includes('duplicate')) {
      body.code = await nextCode()
      const retry = await supabase.from('assets').insert(body).select().single()
      if (retry.error) return res.status(500).json({ error: retry.error.message })
      return res.status(201).json(retry.data)
    }
    return res.status(500).json({ error: error.message })
  }
  res.status(201).json(data)
})

/* ---------- PUT /assets/:id — update (assign / return / repair / edit sab isi se) ---------- */
router.put('/:id', async (req, res) => {
  const changes = sanitize(req.body)
  changes.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('assets')
    .update(changes)
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

/* ---------- DELETE /assets/:id — (optional) galti se bani entry hatane ke liye ---------- */
router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('assets').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ deleted: true })
})

export default router
