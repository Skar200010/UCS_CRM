import { useState, useRef, useEffect } from 'react'
import { Routes, Route, useLocation, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Users, Wallet, Smartphone, BookOpen, Boxes, Target, CalendarCheck, CalendarClock, CalendarDays, Unlock, Lock, MoreHorizontal } from 'lucide-react'
import { useUcs } from '../../store'
import { useSalaryPrivacy } from '../../context/SalaryPrivacyContext'
import { themes, applyTheme } from '../hr/theme'
import SettingsDrawer from '../../components/SettingsDrawer'
import NotificationDrawer from '../../components/NotificationDrawer'
import { api } from '../../api/auth'
import { requestNotifPermission, showDesktopNotification } from '../../utils/desktopNotif'
import { useRealtime } from '../../hooks/useRealtime'
import ToastContainer from '../../components/Toast'
import SpecialIncentive from '../../components/SpecialIncentive'
import LeadChampionCelebration from '../../components/LeadChampionCelebration'
import NoticePopup from '../../components/NoticePopup'
import LeadAudit from './pages/LeadAudit'
import Reports from './pages/Reports'
import IncentiveSetup from './pages/IncentiveSetup'
import IncentiveVerification from './pages/IncentiveVerification'
// Teams + FRO Targets, Donors + Address and New/Old Data are each rendered by one
// section component that owns the tab strip, so the panel itself no longer imports
// the individual pages.
import DonorSection from './components/DonorSection'
import PageTabs from './components/PageTabs'
import TeamsManageModal from './components/TeamsManageModal'
import HolidayManagerModal from './components/HolidayManagerModal'
import AssetRegister from './pages/AssetRegister'
import HistoryImport from './pages/HistoryImport'
import AttendancePage from './pages/Attendance'
import RazorpayAccountsManager from './components/RazorpayAccountsManager'
import EmailAccountsView from './components/EmailAccountsView'
import Receipts from './pages/Receipts'
import TemplateSettings from './pages/TemplateSettings'
import WhatsAppAutomation from './pages/WhatsAppAutomation'
import WhatsAppAccountsManager from './components/WhatsAppAccountsManager'
import WhatsAppBulk from './pages/WhatsAppBulk'
import WhatsAppManager from './pages/WhatsAppManager'
import BulkEmail from './pages/BulkEmail'
import OpenWAEnginePanel from '../whatsapp/OpenWAEnginePanel'
import WhatsAppOpenWADashboard from './pages/WhatsAppOpenWADashboard'
import SyncSettingsView from './components/SyncSettingsView'
import ChangeAccessCode from './components/ChangeAccessCode'
import ChangeSalaryAccessCode from '../hr/components/ChangeSalaryAccessCode'
import AccountsTickets from './pages/Tickets'
import SuperAdminTicketSection from '../../components/SuperAdminTicketSection'
import Workers from '../hr/components/Workers'
import EmployeeDetail from '../hr/components/EmployeeDetail'
import Offboarding from '../hr/components/Offboarding'
import Loans from '../hr/components/Loans'
import AudienceVoting from './pages/AudienceVoting'
import Awards from '../hr/components/Awards'
import { Trophy } from '../hr/icons'
import { fetchWorkerById } from '../hr/store'
import SimSection from './components/SimSection'
import Certificates from './pages/Certificates'
import ChatWorkspace from '../../components/chat/ChatWorkspace'
import AccountsSidebar from './sidebar/AccountsSidebar'
import BeneficiariesPanel from '../beneficiaries/BeneficiariesPanel'
import BillReminderPage from './bill-reminder/BillReminderPage'
import LeadIncentive from '../../components/LeadIncentive'
import IncentivesPage from '../super-admin/pages/IncentivesPage'
import SpecialIncentives from '../super-admin/pages/SpecialIncentives'
import SevakPanel from '../sevak-library/SevakPanel'
import MetropadPage from './metropad/MetropadPage'
import GoogleMapApi from './pages/GoogleMapApi'
import BusinessFinder from './pages/BusinessFinder'
import Extractor from './pages/Extractor'
import GooglePlacesSearch from './pages/GooglePlacesSearch'
import OsmPlacesSearch from './pages/OsmPlacesSearch'

// Dropdown row shared by the Operations actions menu.
const menuItemStyle = (color = 'var(--ink)') => ({
  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
  padding: '8px 10px', border: 'none', background: 'transparent', borderRadius: 7,
  fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, color, textAlign: 'left',
  cursor: 'pointer', whiteSpace: 'nowrap',
})

const NAV_TOP = [
  { id: 'leads', path: '/accounts/leads', label: 'Lead and Audit',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 12l2 2 4-4"/><path d="M12 2a10 10 0 1 0 10 10"/></svg> },
  { id: 'receipt-generator', path: '/accounts/receipt-generator', label: 'Receipts',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> },
]

const DONOR_NAV = {
  id: 'donors', path: '/accounts/donors', label: 'Master Data',
  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  match: (p) => p.startsWith('/accounts/donors'),
}



const NAV_GROUPS = [
  {
    title: 'Workforce',
    icon: <Users size={18} />,
    items: [
      // Teams and Target were folded into Operations — teams/targets live on
      // the Operations page's own strip. Attendance is back as its own page
      // (monthly calendar with punch in/out, day detail, selfie verification).
      { id: 'payroll', path: '/accounts/volunteers', label: 'Operations',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
        match: (p) => p.startsWith('/accounts/volunteers') || p === '/accounts/loans' },
      { id: 'attendance', path: '/accounts/attendance', label: 'Attendance',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14l2 2 4-4"/></svg> },
      // The Incentive setup page is now a tab inside Incentives below
      // ("Incentive Daily Chart"); /accounts/incentive redirects there.
      { id: 'incentives', path: '/accounts/incentives', label: 'Incentives',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
        match: (p) => p.startsWith('/accounts/incentives') || p === '/accounts/incentive' },
      // Master Data and Asset Register moved here from Finance & Records.
      DONOR_NAV,
      { id: 'asset-register', path: '/accounts/asset-register', label: 'Asset Register',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> },
      { id: 'history-import', path: '/accounts/history-import', label: 'History Import',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
        match: (p) => p.startsWith('/accounts/history-import') },
    ],
  },
  {
    title: 'Ceremony',
    icon: <Trophy size={18} />,
    items: [
      { id: 'awards', path: '/accounts/awards', label: 'Awards',
        icon: <Trophy size={18} /> },
      { id: 'audience-voting', path: '/accounts/audience-voting', label: 'Audience Voting',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v4"/><path d="M8 23h8"/></svg> },
      // Certificates moved here from Donor Management: a certificate is issued
      // for a ceremony, so it belongs with Awards and Audience Voting rather than
      // with the donor list it reads against.
      { id: 'certificates', path: '/accounts/certificates', label: 'Certificates',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="6"/><path d="M15.5 13l1.5 9-5-3-5 3 1.5-9"/></svg> },
    ],
  },
]

// Title lookup only: the Address tab is a tab, not a sidebar entry.
const DONOR_SUB_NAV = {
  id: 'address', path: '/accounts/donors/address', label: 'Donor Data Update',
  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  match: (p) => p.startsWith('/accounts/donors/address'),
}

// Beneficiaries is one sidebar item and one page. The five sections (Overview,
// All Beneficiaries, Collection OTPs, Import Members, Daily Events) are switched by
// the tab strip inside BeneficiariesPanel rather than by five separate nav entries,
// so reaching the second one no longer means going back out to the sidebar. Their
// routes still exist, so any bookmarked deep link lands on the right tab. The
// sidebar renders its copy from MODULES_NAV below, which adds the `match` that
// keeps the entry lit while a deeper tab is open.
const BENEFICIARY_NAV = [
  { id: 'bnf-overview', path: '/accounts/beneficiaries', label: 'Beneficiaries',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1"/><circle cx="17" cy="9" r="2.5"/><path d="M18 14a4 4 0 0 1 3 4v2"/></svg> },
]

const NAV_BOTTOM = [
  { id: 'reports', path: '/accounts/reports', label: 'Reports',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  { id: 'tickets', path: '/accounts/tickets', label: 'Tickets',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 5H3v14h12"/><path d="M21 12l-6-6v4H9v4h6v4l6-6z"/></svg> },
  { id: 'chat', path: '/accounts/chat', label: 'UCS Chat',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 14a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z"/></svg> },
]

// Title lookup only. The Data page and its New/Old tabs were removed, so the
// Old Data and New Data title entries went with it -- they only ever named tabs
// that no longer exist, and every /accounts/data URL now redirects to Master Data.
const DATA_SUB_NAV = [];

// Title lookup only: FRO Targets is a tab on the Teams and Target page now.
const FRO_TARGETS_NAV = {
  id: 'fro-targets', path: '/accounts/teams/targets', label: 'Target Settings',
  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  match: (p) => p === '/accounts/teams/targets' || p === '/accounts/fro-targets',
}

const SIM_GROUP_ICON = <Smartphone size={18} />

const SIM_NAV = [
  { id: 'sim-dashboard', path: '/accounts/sim/dashboard', label: 'Dashboard',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    match: (p) => p === '/accounts/sim' || p === '/accounts/sim/dashboard' },
  { id: 'sim-inventory', path: '/accounts/sim/inventory', label: 'All SIM Cards',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>,
    match: (p) => p === '/accounts/sim/inventory' },
  { id: 'sim-locker', path: '/accounts/sim/cards', label: 'SIM Locker',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    match: (p) => p === '/accounts/sim/cards' },
  { id: 'sim-owner', path: '/accounts/sim/owner', label: 'All SIM Owner',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    match: (p) => p === '/accounts/sim/owner' },
]

const SIM_NAV_ITEM = {
  id: 'sim', path: '/accounts/sim', label: 'SIM Management', icon: SIM_GROUP_ICON,
  match: (p) => p.startsWith('/accounts/sim'),
}

const MODULES_NAV = [
  { id: 'bill-reminder', path: '/accounts/bill-reminder', label: 'Bill Reminder',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
    match: (p) => p.startsWith('/accounts/bill-reminder') },
  { id: 'metropad', path: '/accounts/metropad', label: 'Metropad',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z"/></svg> },
  { id: 'library', path: '/accounts/library', label: 'Library',
    icon: <BookOpen size={18} /> },
  { id: 'bulk-email', path: '/accounts/bulk-email', label: 'Bulk Email',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/></svg> },
  { id: 'whatsapp-accounts', path: '/accounts/whatsapp', label: 'WhatsApp Bulk',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> },
  { id: 'whatsapp-dashboard', path: '/accounts/whatsapp-dashboard', label: 'WhatsApp',
    icon: <Smartphone size={18} /> },
  // Extractor sits directly below WhatsApp: the extension feeds this page.
  { id: 'extractor', path: '/accounts/extractor', label: 'Extractor',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4h18l-7 8v6l-4 2v-8L3 4z"/></svg>,
    match: (p) => p.startsWith('/accounts/extractor') },
  { ...BENEFICIARY_NAV[0], match: (p) => p.startsWith('/accounts/beneficiaries') },
  SIM_NAV_ITEM,
]

const API_NAV = [
  { id: 'business-finder', path: '/accounts/business-finder', label: 'Business Finder',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    match: (p) => p.startsWith('/accounts/business-finder') },
]

const ALL_NAV = [
  ...NAV_TOP,
  ...DATA_SUB_NAV,
  DONOR_SUB_NAV,
  FRO_TARGETS_NAV,
  ...NAV_GROUPS.flatMap(g => g.items),
  ...SIM_NAV,
  ...MODULES_NAV,
  ...API_NAV,
  ...NAV_BOTTOM,
]

const navIsActive = (n, pathname) => {
  if (n.match) return n.match(pathname)
  return pathname === n.path
}

const SIDEBAR_SECTIONS = [
  {
    id: 'main',
    heading: 'Main',
    items: [
      ...NAV_TOP,
      // Derived from NAV_GROUPS rather than hard-coded indices: groups come
      // and go (Finance & Records was merged into Workforce), and a stale
      // index crashes the whole panel on ".title of undefined".
      ...NAV_GROUPS.map((g) => ({
        id: `g-${g.title.toLowerCase().replace(/[^a-z]+/g, '-')}`,
        label: g.title,
        icon: g.icon,
        storageKey: g.title.toLowerCase().replace(/[^a-z]+/g, '_'),
        items: g.items,
      })),
      { id: 'g-modules', label: 'Modules', icon: <Boxes size={18} />, storageKey: 'modules', items: MODULES_NAV },
      { id: 'g-api-instructions', label: 'API Instructions', icon: <Boxes size={18} />, storageKey: 'api_instructions', items: API_NAV },
    ],
  },
  { id: 'settings', heading: 'Settings', items: NAV_BOTTOM },
]

const withoutHidden = (sections) => sections
  .map((s) => ({
    ...s,
    items: s.items
      .filter((i) => !i.hidden)
      .map((i) => (i.items ? { ...i, items: i.items.filter((c) => !c.hidden) } : i))
      .filter((i) => !i.items || i.items.length > 0),
  }))
  .filter((s) => s.items.length > 0)

const settingsViews = [
  { key: 'razorpay', label: 'Razorpay Accounts', width: 420,
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
    content: <RazorpayAccountsManager /> },
  { key: 'email-import', label: 'Email Accounts', width: 420,
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
    content: <EmailAccountsView /> },
  { key: 'sync-settings', label: 'Sync & Imports', width: 380,
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.4-3.4L23 10M1 14l5.1 4.4A9 9 0 0 0 20.5 15"/></svg>,
    content: <SyncSettingsView /> },
  { key: 'template-settings', label: 'Template Settings', width: 460,
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    content: <TemplateSettings /> },
  { key: 'whatsapp-accounts', label: 'WhatsApp Accounts', width: 560,
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
    content: <WhatsAppAccountsManager /> },
  { key: 'whatsapp-automation', label: 'WhatsApp Automations', width: 520,
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
    content: <WhatsAppAutomation /> },
  { key: 'access-code', label: 'Change Access Code', width: 380,
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    content: <ChangeAccessCode /> },
  { key: 'salary-access-code', label: 'Change Salary Access Code', width: 380,
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    content: <ChangeSalaryAccessCode /> },
]

function hrScopeStyle(theme) {
  if (!theme) return undefined
  const style = {}
  for (const [k, v] of Object.entries(theme)) {
    if (k === 'name') continue
    style['--' + k] = v
  }
  return style
}

function VolunteersListPage({ theme, onWorkersAction }) {
  const navigate = useNavigate()
  return (
    <div className="panel-hr" style={hrScopeStyle(theme)}>
      <Workers showAddForm={false} showNgoSalary={false} showBulkPrint={false} title="Volunteers" showPagarExport={true} showPayExports={false} salaryMode
        onActionsReady={onWorkersAction}
        onSelect={(w) => navigate(`/accounts/volunteers/${w.id}`)}
        onOffboard={(w) => navigate(`/accounts/volunteers/${w.id}/offboard`)} />
    </div>
  )
}

function VolunteerDetailPage({ theme }) {
  const { id } = useParams()
  const navigate = useNavigate()
  return (
    <div className="panel-hr" style={hrScopeStyle(theme)}>
      <EmployeeDetail worker={{ id }} accountsMode onBack={() => navigate('/accounts/volunteers')} onOffboard={() => navigate(`/accounts/volunteers/${id}/offboard`)} />
    </div>
  )
}

function VolunteerOffboardPage({ theme }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [worker, setWorker] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWorkerById(id).then(w => { setWorker(w); setLoading(false) }).catch(() => setLoading(false))
  }, [id])

  return (
    <div className="panel-hr" style={hrScopeStyle(theme)}>
      {loading ? <div className="empty">Loading...</div>
        : !worker ? <div className="empty">Attendance not found.</div>
        : <Offboarding worker={worker} onBack={() => navigate('/accounts/volunteers')} />}
    </div>
  )
}

function PayrollSection({ theme }) {
  const { pathname } = useLocation()
  const [teamsOpen, setTeamsOpen] = useState(false)
  // Holidays are declared company-wide. The row lands in the shared `holidays`
  // table, so payroll's existing holiday handling (paid day, never absent)
  // applies without changing any salary maths.
  const [holidayOpen, setHolidayOpen] = useState(false)
  // Export/manage actions the Workers table owns (targets, attendance Excel,
  // Salary File, Compensations). It hands them up once so the top strip can
  // render the buttons next to Manage Teams while the list page is mounted.
  const [workersActions, setWorkersActions] = useState(null)
  // All Operations actions live behind one menu so the header stays one line
  // instead of six buttons that overflow on smaller screens.
  const [actionsOpen, setActionsOpen] = useState(false)
  const actionsRef = useRef(null)
  useEffect(() => {
    if (!actionsOpen) return
    const onDown = (e) => { if (actionsRef.current && !actionsRef.current.contains(e.target)) setActionsOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [actionsOpen])
  const { isSalaryUnlocked, promptUnlock, lockSalary } = useSalaryPrivacy()
  // Loan & Advance is a full page in this strip again — Accounts reconciles
  // those deductions here, not inside a volunteer's detail view.
  const tabs = [
    { label: 'Salary', path: '/accounts/volunteers' },
    { label: 'Loan & Advance', path: '/accounts/volunteers/loans' },
  ]
  const here = pathname.replace(/\/$/, '')
  const onDetail = here.startsWith('/accounts/volunteers')
    && here !== '/accounts/volunteers'
    && here !== '/accounts/volunteers/loans'
  return (
    <>
      {!onDetail && (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <PageTabs tabs={tabs} ariaLabel="Operations" />
          <div style={{ position: 'relative', marginTop: 6, flexShrink: 0 }} ref={actionsRef}>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => setActionsOpen(o => !o)}
              aria-label="Operations actions"
              aria-haspopup="menu"
              aria-expanded={actionsOpen}
              title="Actions"
              style={{ width: 34, height: 34, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <MoreHorizontal size={16} />
            </button>
            {actionsOpen && (
              <div
                role="menu"
                className="actions-menu"
                style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 300,
                  minWidth: 224, background: '#fff', border: '1px solid var(--line, #e5e7eb)',
                  borderRadius: 10, boxShadow: '0 10px 28px rgba(15,23,42,.16)', padding: 4, overflow: 'hidden',
                }}
              >
                <style>{`.actions-menu button:hover{background:#f8fafc}`}</style>
                {workersActions && (
                  <>
                    <button
                      role="menuitem"
                      onClick={() => { setActionsOpen(false); if (isSalaryUnlocked) lockSalary(); else promptUnlock(); }}
                      title={isSalaryUnlocked ? 'Hide salary figures again' : 'Enter your access code to view salary figures'}
                      style={menuItemStyle(isSalaryUnlocked ? 'var(--ink)' : '#1d4ed8')}
                    >
                      {isSalaryUnlocked ? <Lock size={14} /> : <Unlock size={14} />}
                      {isSalaryUnlocked ? 'Hide Salary' : 'Unlock Salary'}
                    </button>
                    <button role="menuitem" onClick={() => { setActionsOpen(false); workersActions.downloadFroTargets(); }}
                      title="Download this month's FRO targets (FRO department only) as Excel" style={menuItemStyle()}>
                      <Target size={14} /> Targets
                    </button>
                    <button role="menuitem" onClick={() => { setActionsOpen(false); workersActions.openAttExport(); }}
                      title="Export a month's attendance sheet (In/Out per day) to Excel" style={menuItemStyle()}>
                      <CalendarCheck size={14} /> Attendance
                    </button>
                    <button role="menuitem" onClick={() => { setActionsOpen(false); workersActions.openPagar(); }}
                      title="Download Salary File (July format)" style={menuItemStyle()}>
                      <Wallet size={14} /> Salary
                    </button>
                    <button role="menuitem" onClick={() => { setActionsOpen(false); workersActions.openCompensations(); }}
                      title="Manage compensatory Sundays and holidays" style={menuItemStyle()}>
                      <CalendarClock size={14} /> Compensations
                    </button>
                    <div style={{ height: 1, background: 'var(--line, #e5e7eb)', margin: '4px 0' }} />
                  </>
                )}
                <button role="menuitem" onClick={() => { setActionsOpen(false); setHolidayOpen(true); }}
                  title="Declare a company-wide holiday. That day is paid and is never marked absent." style={menuItemStyle()}>
                  <CalendarDays size={14} /> Add Holiday
                </button>
                <button role="menuitem" onClick={() => { setActionsOpen(false); setTeamsOpen(true); }}
                  title="Add, rename or remove teams" style={menuItemStyle()}>
                  <Users size={14} /> Manage Teams
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      <Routes>
        <Route index element={<VolunteersListPage theme={theme} onWorkersAction={setWorkersActions} />} />
        <Route path="loans" element={<Loans />} />
        <Route path=":id" element={<VolunteerDetailPage theme={theme} />} />
        <Route path=":id/offboard" element={<VolunteerOffboardPage theme={theme} />} />
      </Routes>
      {teamsOpen && <TeamsManageModal onClose={() => setTeamsOpen(false)} />}
      {holidayOpen && <HolidayManagerModal onClose={() => setHolidayOpen(false)} />}
    </>
  )
}

function AwardsPage({ theme }) {
  return (
    <div className="panel-hr" style={hrScopeStyle(theme)}>
      <Awards />
    </div>
  )
}

export default function AccountsPanel() {
  const rightDrawerWidth = 460
  const { user, logout } = useUcs()
  const [showMenu, setShowMenu] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [themeName, setThemeName] = useState(() => localStorage.getItem('accounts_theme') || 'sky')
  const [allNotifs, setAllNotifs] = useState([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const menuRef = useRef(null)
  let _initSeenNotifs = []; try { _initSeenNotifs = JSON.parse(localStorage.getItem('accounts_seen_notifs') || '[]'); } catch { /* corrupted */ }
  const seenNotifIds = useRef(new Set(_initSeenNotifs))
  const location = useLocation()

  const loadNotifications = () => {
    const uid = user?.id;
    if (!uid) return;
    api(`/notifications/${uid}`, { _prefix: 'ucs' })
      .then(data => {
        const all = data || [];
        const unread = all.filter(n => !n.read_at);
        setAllNotifs(unread);
        unread.forEach(n => {
          if (!seenNotifIds.current.has(n.id)) {
            seenNotifIds.current.add(n.id);
            localStorage.setItem('accounts_seen_notifs', JSON.stringify([...seenNotifIds.current]));
            showDesktopNotification(n.title, n.body);
          }
        });
      })
      .catch((err) => { console.error('Error:', err.message); });
  };

  useEffect(() => {
    loadNotifications();
    requestNotifPermission();
  }, [user?.id]);

  useEffect(() => {
    if (themes[themeName]) {
      applyTheme(themes[themeName], '.panel-accounts')
      const t = themes[themeName]
      const el = document.querySelector('.panel-accounts') || document.documentElement
      el.style.setProperty('--bg', t.sand); el.style.setProperty('--card-bg', t.paper); el.style.setProperty('--sage-light', t['sage-soft'])
    }
    localStorage.setItem('accounts_theme', themeName)
  }, [themeName])

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false) }
    if (showMenu) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMenu])

  const meta = ALL_NAV.find(n => navIsActive(n, location.pathname))
  const simMeta = SIM_NAV.some(n => n.match(location.pathname))
  const bnfMeta = location.pathname.startsWith('/accounts/beneficiaries')
  const userName = user?.name || 'User'
  const initials = userName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const drawerSections = [
    { label: 'Notifications', type: 'notifications', items: allNotifs },
  ];

  return (
    <div className={`app${sidebarOpen ? ' sidebar-open' : ''}`}>
      <AccountsSidebar
        sections={withoutHidden(SIDEBAR_SECTIONS)}
        isActive={navIsActive}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="main">
        <header className="topbar">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button className="hamburger" onClick={() => setSidebarOpen(true)} aria-label="Toggle sidebar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div>
              <div className="eyebrow">{bnfMeta ? 'Beneficiaries' : simMeta ? 'SIM Management' : 'Accounts'}</div>
              <h2>{meta?.label || 'Accounts'}</h2>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <div className="topbar-user" ref={menuRef} onClick={() => setShowMenu(!showMenu)}>
            <div className="avatar">{initials}</div>
            {showMenu && (
              <div className="user-menu">
                <div className="user-menu-item" style={{flexDirection:'column', alignItems:'flex-start', gap:2, cursor:'default'}}>
                  <div style={{fontWeight:600, fontSize:13}}>{userName}</div>
                  <div style={{fontSize:11, color:'var(--ink-soft)'}}>Accounts</div>
                </div>
                <div className="user-menu-divider" />
                <div className="user-menu-item" onClick={() => { setShowMenu(false); setShowSettings(true); }} style={{cursor:'pointer'}}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  Settings
                </div>
                <div className="user-menu-divider" />
                <button className="user-menu-item" onClick={() => { setShowMenu(false); logout() }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
          </div>
          <NotificationDrawer topOffset={56}
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            sections={drawerSections}
            onItemClick={() => setDrawerOpen(false)}
          />
          <SettingsDrawer
            open={showSettings}
            onClose={() => setShowSettings(false)}
            themes={themes}
            themeName={themeName}
            onThemeChange={(key) => setThemeName(key)}
            views={settingsViews}
          />
        </header>
        <div className={`content-body${location.pathname.endsWith('/tickets') ? ' content-body-tickets' : ''}`} style={{ marginRight: drawerOpen ? rightDrawerWidth : 0, transition: 'margin-right .25s ease' }}>
          <Routes>
            <Route index element={<Navigate to="leads" replace />} />
            <Route path="leads" element={<LeadAudit />} />
            <Route path="receipts" element={<Navigate to="/accounts/receipt-generator" replace />} />
            <Route path="donors/*" element={<DonorSection />} />
            {/* Old standalone Address URL -> the Address tab of the Donors page. */}
            <Route path="address" element={<Navigate to="/accounts/donors/address" replace />} />
            <Route path="receipt-history" element={<Navigate to="/accounts/receipt-generator" replace />} />
            <Route path="receipt-generator" element={<Receipts />} />
            <Route path="volunteers/*" element={<PayrollSection theme={themes[themeName]} />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="tickets" element={<AccountsTickets />} />
            <Route path="to-super-admin" element={<SuperAdminTicketSection panel="accounts" />} />
            <Route path="chat" element={<ChatWorkspace />} />
            <Route path="loans" element={<Navigate to="/accounts/volunteers/loans" replace />} />
            <Route path="awards" element={<AwardsPage theme={themes[themeName]} />} />
            <Route path="audience-voting" element={<AudienceVoting />} />
            <Route path="certificates" element={<Certificates />} />
            <Route path="template-settings" element={<TemplateSettings />} />
            <Route path="asset-register" element={<AssetRegister />} />
            <Route path="history-import" element={<HistoryImport />} />
            <Route path="reports" element={<Reports />} />
            <Route path="teams/*" element={<Navigate to="/accounts/volunteers" replace />} />
            {/* FRO Targets moved into Teams as a tab; the old URL redirects. */}
            <Route path="fro-targets" element={<Navigate to="/accounts/volunteers" replace />} />
            {/* The standalone Incentive page moved into the Incentives page as
                the "Incentive Daily Chart" tab; old URL redirects. */}
            <Route path="incentive" element={<Navigate to="/accounts/incentives/setup" replace />} />
            <Route path="incentive-verify" element={<IncentiveVerification />} />
            <Route path="incentives" element={<IncentivesPage />}>
              <Route index element={<Navigate to="sir" replace />} />
              <Route path="sir" element={<SpecialIncentives />} />
              <Route path="lead" element={<LeadIncentive />} />
              <Route path="setup" element={<IncentiveSetup />} />
            </Route>
            {/* The Data page was removed from this panel. The routes below now
                redirect rather than 404: the links are plain URLs that old
                bookmarks, exports and cross-panel links may still carry, and a
                redirect is cheaper than a dead end for whoever follows one. */}
            <Route path="data/*" element={<Navigate to="/accounts/donors" replace />} />
            <Route path="new-data" element={<Navigate to="/accounts/donors" replace />} />
            <Route path="old-data" element={<Navigate to="/accounts/donors" replace />} />
            <Route path="sim/*" element={<SimSection />} />
            <Route path="beneficiaries/*" element={<BeneficiariesPanel base="/accounts/beneficiaries" />} />
            <Route path="bill-reminder/*" element={<BillReminderPage />} />
            <Route path="library" element={<SevakPanel />} />
            {/* Metropad moved here from the super-admin panel. A plain path, not a splat:
                MetropadPage renders its dashboard directly and has no routes of
                its own (the standalone build in metropad/App.jsx owns those). */}
            <Route path="metropad" element={<MetropadPage />} />
            <Route path="business-finder" element={<BusinessFinder />} />
            <Route path="extractor" element={<Extractor />} />
            <Route path="google-map-api" element={<GoogleMapApi />} />
            <Route path="google-places-search" element={<GooglePlacesSearch />} />
            <Route path="osm-places-search" element={<OsmPlacesSearch />} />

            <Route path="bulk-email" element={<BulkEmail />} />
            <Route path="whatsapp" element={<WhatsAppManager />} />
            <Route path="whatsapp/bulk" element={<WhatsAppBulk />} />
            <Route path="whatsapp-dashboard" element={<WhatsAppOpenWADashboard />} />
            <Route path="openwa-engine" element={<OpenWAEnginePanel />} />
            <Route path="*" element={<Navigate to="leads" replace />} />
          </Routes>
        </div>
      </div>
      <SpecialIncentive />
      <LeadChampionCelebration />
      <NoticePopup />
      <ToastContainer />
    </div>
  )
}
