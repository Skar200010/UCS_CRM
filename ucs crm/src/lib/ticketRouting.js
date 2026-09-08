export const TICKET_ROUTES = {
  suspense:       { system: 'regular',   department: 'accounts' },
  payment_issue:  { system: 'regular',   department: 'accounts' },
  receipt_issue:  { system: 'regular',   department: 'accounts' },
  technical:      { system: 'regular',   department: 'event_head' },
  hr_issue:       { system: 'regular',   department: 'hr' },
  other:          { system: 'developer', department: 'developers' },
}

const ROUTE_LABELS = {
  accounts:   'Accounts',
  event_head: 'All Tickets',
  hr:         'HR',
  developers: 'Developers',
}

export function routeFor(category) {
  return TICKET_ROUTES[category] || TICKET_ROUTES.other
}

export function routeLabel(category) {
  return ROUTE_LABELS[routeFor(category).department] || 'Developers'
}