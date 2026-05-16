import { useState, useMemo, useEffect, useRef } from 'react'
import s from './App.module.css'

const CATEGORIES_INCOME = ['Gehalt', 'Nebenjob', 'Investments', 'Sonstiges']
const CATEGORIES_EXPENSE = ['Miete', 'Lebensmittel', 'Transport', 'Freizeit', 'Versicherung', 'Abonnements', 'Gesundheit', 'Sonstiges']

const INTERVALS = [
  { key: 'none', label: 'Einmalig', perMonth: 0 },
  { key: 'weekly', label: 'Woechentlich', perMonth: 52 / 12 },
  { key: 'monthly', label: 'Monatlich', perMonth: 1 },
  { key: 'quarterly', label: 'Quartalsweise', perMonth: 1 / 3 },
  { key: 'yearly', label: 'Jaehrlich', perMonth: 1 / 12 },
]

const CAT_COLORS = {
  'Miete': '#f0b429',
  'Lebensmittel': '#4ade80',
  'Transport': '#60a5fa',
  'Freizeit': '#c084fc',
  'Versicherung': '#fbbf24',
  'Abonnements': '#f472b6',
  'Gesundheit': '#34d399',
  'Sonstiges': '#94a3b8',
  'Gehalt': '#4ade80',
  'Nebenjob': '#34d399',
  'Investments': '#60a5fa',
}

const KEYWORD_MAP = [
  { keywords: ['miete', 'kaltmiete', 'warmmiete', 'nebenkosten', 'vermieter'], cat: 'Miete' },
  { keywords: ['rewe', 'edeka', 'aldi', 'lidl', 'netto', 'kaufland', 'penny', 'dm-drogerie', 'rossmann', 'supermarkt'], cat: 'Lebensmittel' },
  { keywords: ['db vertrieb', 'bahn', 'bvg', 'mvg', 'hvv', 'tankstelle', 'shell', 'aral', 'esso', 'uber', 'taxi', 'flixbus'], cat: 'Transport' },
  { keywords: ['netflix', 'spotify', 'amazon prime', 'disney', 'youtube', 'apple.com/bill', 'icloud', 'patreon', 'adobe'], cat: 'Abonnements' },
  { keywords: ['versicher', 'allianz', 'huk', 'axa', 'debeka', 'devk', 'gothaer'], cat: 'Versicherung' },
  { keywords: ['apotheke', 'arzt', 'praxis', 'klinik', 'physio', 'optiker'], cat: 'Gesundheit' },
  { keywords: ['kino', 'restaurant', 'cafe', 'bar', 'club', 'mcdonald', 'burger', 'steam', 'playstation'], cat: 'Freizeit' },
  { keywords: ['gehalt', 'lohn', 'salary', 'arbeitgeber'], cat: 'Gehalt', type: 'income' },
]

const DEFAULT_ENTRIES = [
  { id: 1, type: 'income', label: 'Gehalt', category: 'Gehalt', amount: 3200, interval: 'monthly' },
  { id: 2, type: 'expense', label: 'Miete', category: 'Miete', amount: 950, interval: 'monthly' },
  { id: 3, type: 'expense', label: 'Spotify', category: 'Abonnements', amount: 10.99, interval: 'monthly' },
  { id: 4, type: 'expense', label: 'KFZ-Versicherung', category: 'Versicherung', amount: 480, interval: 'yearly' },
  { id: 5, type: 'expense', label: 'Lebensmittel', category: 'Lebensmittel', amount: 320, interval: 'none' },
]

function eur(n) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function eurShort(n) {
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'k'
  return Math.round(n).toString()
}

const today = new Date()
const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
const dayOfMonth = today.getDate()
const daysLeft = daysInMonth - dayOfMonth
const monthName = today.toLocaleString('de-DE', { month: 'long' })

function intervalPerMonth(key) {
  const i = INTERVALS.find(x => x.key === key)
  return i ? i.perMonth : 0
}

function monthlyEquivalent(entry) {
  if (entry.interval === 'none') return 0
  return entry.amount * intervalPerMonth(entry.interval)
}

function autoCategorize(text, amount) {
  const lower = text.toLowerCase()
  for (const m of KEYWORD_MAP) {
    if (m.keywords.some(k => lower.includes(k))) {
      return { category: m.cat, type: m.type || 'expense' }
    }
  }
  return { category: 'Sonstiges', type: amount > 0 ? 'income' : 'expense' }
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length === 0) return []

  let delim = ';'
  if (lines[0].split(',').length > lines[0].split(';').length) delim = ','

  const splitLine = (line) => {
    const cells = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') { inQuotes = !inQuotes; continue }
      if (c === delim && !inQuotes) { cells.push(cur); cur = ''; continue }
      cur += c
    }
    cells.push(cur)
    return cells.map(c => c.trim())
  }

  const header = splitLine(lines[0]).map(h => h.toLowerCase())
  const findCol = (names) => header.findIndex(h => names.some(n => h.includes(n)))

  const dateIdx = findCol(['datum', 'buchungstag', 'date', 'wertstellung'])
  const descIdx = findCol(['verwendung', 'beschreibung', 'buchungstext', 'empfaenger', 'auftraggeber', 'description', 'name', 'gegenkonto'])
  const amtIdx = findCol(['betrag', 'amount', 'wert', 'umsatz'])

  if (amtIdx === -1) return []

  const txs = []
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i])
    const rawAmt = (cells[amtIdx] || '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-]/g, '')
    const amt = parseFloat(rawAmt)
    if (isNaN(amt) || amt === 0) continue
    const desc = descIdx >= 0 ? (cells[descIdx] || '') : 'Buchung'
    const date = dateIdx >= 0 ? (cells[dateIdx] || '') : ''
    txs.push({ date, desc: desc.slice(0, 80), amount: amt })
  }
  return txs
}

// SVG DONUT
function Donut({ data, total, size = 180 }) {
  const radius = size / 2 - 12
  const inner = radius * 0.62
  const cx = size / 2
  const cy = size / 2

  let acc = 0
  const segments = data.map(([label, value], i) => {
    const frac = total > 0 ? value / total : 0
    const start = acc * Math.PI * 2 - Math.PI / 2
    acc += frac
    const end = acc * Math.PI * 2 - Math.PI / 2
    const large = frac > 0.5 ? 1 : 0
    const x1 = cx + radius * Math.cos(start)
    const y1 = cy + radius * Math.sin(start)
    const x2 = cx + radius * Math.cos(end)
    const y2 = cy + radius * Math.sin(end)
    const xi1 = cx + inner * Math.cos(end)
    const yi1 = cy + inner * Math.sin(end)
    const xi2 = cx + inner * Math.cos(start)
    const yi2 = cy + inner * Math.sin(start)
    const path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${inner} ${inner} 0 ${large} 0 ${xi2} ${yi2} Z`
    return { path, color: CAT_COLORS[label] || `hsl(${i * 47}, 70%, 60%)`, label, value, frac }
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg, i) => (
        <path key={i} d={seg.path} fill={seg.color} />
      ))}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="11" fill="#444" fontFamily="DM Mono">GESAMT</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="14" fill="#e8e6e0" fontFamily="Syne" fontWeight="700">{eurShort(total)} EUR</text>
    </svg>
  )
}

// SVG BAR CHART (horizontal)
function HBars({ data, max }) {
  return (
    <div className={s.hbars}>
      {data.map(([label, value], i) => {
        const pct = max > 0 ? (value / max) * 100 : 0
        const color = CAT_COLORS[label] || `hsl(${i * 47}, 70%, 60%)`
        return (
          <div key={label} className={s.hbar}>
            <div className={s.hbarLabel}>
              <span className={s.hbarDot} style={{ background: color }} />
              <span>{label}</span>
              <span className={s.hbarVal}>{eur(value)}</span>
            </div>
            <div className={s.track}>
              <div className={s.trackFill} style={{ width: `${pct}%`, background: color }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// MONTHLY TREND (Bar chart vergleich Einnahmen/Ausgaben + saldo)
function MonthBars({ income, expense }) {
  const max = Math.max(income, expense, 1)
  const ih = (income / max) * 110
  const eh = (expense / max) * 110
  const saldo = income - expense
  const sh = (Math.abs(saldo) / max) * 110
  const sCol = saldo >= 0 ? '#4ade80' : '#f87171'

  const bars = [
    { label: 'Einnahmen', h: ih, color: '#4ade80', value: income },
    { label: 'Ausgaben', h: eh, color: '#f87171', value: expense },
    { label: 'Saldo', h: sh, color: sCol, value: saldo },
  ]

  return (
    <div className={s.monthBars}>
      {bars.map(b => (
        <div key={b.label} className={s.monthBar}>
          <div className={s.monthBarValue}>{eurShort(b.value)}</div>
          <div className={s.monthBarTrack}>
            <div className={s.monthBarFill} style={{ height: `${b.h}px`, background: b.color }} />
          </div>
          <div className={s.monthBarLabel}>{b.label}</div>
        </div>
      ))}
    </div>
  )
}

// MIGRATION: alte recurring:bool zu interval
function migrate(arr) {
  return arr.map(e => {
    if (e.interval) return e
    return { ...e, interval: e.recurring ? 'monthly' : 'none' }
  })
}

export default function App() {
  const [entries, setEntries] = useState(() => {
    try {
      const saved = localStorage.getItem('budget-entries')
      return saved ? migrate(JSON.parse(saved)) : DEFAULT_ENTRIES
    } catch { return DEFAULT_ENTRIES }
  })
  const [tab, setTab] = useState('overview')
  const [form, setForm] = useState({ type: 'expense', label: '', category: CATEGORIES_EXPENSE[0], amount: '', interval: 'none' })
  const [editId, setEditId] = useState(null)
  const [nextId, setNextId] = useState(() => {
    try {
      const saved = localStorage.getItem('budget-entries')
      const arr = saved ? JSON.parse(saved) : DEFAULT_ENTRIES
      return Math.max(...arr.map(e => e.id), 0) + 1
    } catch { return 6 }
  })
  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteId, setDeleteId] = useState(null)

  // Import state
  const [importTxs, setImportTxs] = useState([])
  const [importError, setImportError] = useState('')
  const fileRef = useRef(null)

  useEffect(() => {
    try { localStorage.setItem('budget-entries', JSON.stringify(entries)) } catch {}
  }, [entries])

  // Wirksame monatliche Beträge (alle wiederkehrenden Eintraege auf Monat umgerechnet, einmalige bleiben einmalig)
  const monthlyIncome = useMemo(() =>
    entries.filter(e => e.type === 'income').reduce((sum, e) =>
      sum + (e.interval === 'none' ? e.amount : monthlyEquivalent(e))
    , 0), [entries])

  const monthlyExpense = useMemo(() =>
    entries.filter(e => e.type === 'expense').reduce((sum, e) =>
      sum + (e.interval === 'none' ? e.amount : monthlyEquivalent(e))
    , 0), [entries])

  const balance = monthlyIncome - monthlyExpense

  // Fixkosten (wiederkehrend) und variable
  const fixedExpense = useMemo(() =>
    entries.filter(e => e.type === 'expense' && e.interval !== 'none').reduce((s, e) => s + monthlyEquivalent(e), 0), [entries])
  const variableExpense = useMemo(() =>
    entries.filter(e => e.type === 'expense' && e.interval === 'none').reduce((s, e) => s + e.amount, 0), [entries])

  // Prognose: Fixkosten anteilig fuer restliche Tage, variable bisher
  const fixedDaily = fixedExpense / daysInMonth
  const projectedFixedRest = fixedDaily * daysLeft
  const forecast = monthlyIncome - variableExpense - fixedExpense

  const progressPct = Math.min(100, (dayOfMonth / daysInMonth) * 100)
  const burnPct = Math.min(100, monthlyIncome > 0 ? (monthlyExpense / monthlyIncome) * 100 : 0)

  const incomeEntries = entries.filter(e => e.type === 'income')
  const expenseEntries = entries.filter(e => e.type === 'expense')

  const catBreakdown = useMemo(() => {
    const map = {}
    expenseEntries.forEach(e => {
      const monthly = e.interval === 'none' ? e.amount : monthlyEquivalent(e)
      map[e.category] = (map[e.category] || 0) + monthly
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [expenseEntries])

  function openNewForm() {
    setEditId(null)
    setForm({ type: 'expense', label: '', category: CATEGORIES_EXPENSE[0], amount: '', interval: 'none' })
    setShowForm(true)
    setFormError('')
  }

  function openEditForm(entry) {
    setEditId(entry.id)
    setForm({
      type: entry.type,
      label: entry.label,
      category: entry.category,
      amount: String(entry.amount),
      interval: entry.interval || 'none'
    })
    setShowForm(true)
    setFormError('')
  }

  function saveEntry() {
    if (!form.label.trim()) { setFormError('Bezeichnung fehlt'); return }
    const amt = parseFloat(form.amount)
    if (!amt || amt <= 0) { setFormError('Ungultiger Betrag'); return }

    if (editId !== null) {
      setEntries(prev => prev.map(e => e.id === editId ? { ...e, ...form, amount: amt } : e))
    } else {
      setEntries(prev => [...prev, { ...form, amount: amt, id: nextId }])
      setNextId(n => n + 1)
    }
    setForm({ type: 'expense', label: '', category: CATEGORIES_EXPENSE[0], amount: '', interval: 'none' })
    setFormError('')
    setShowForm(false)
    setEditId(null)
  }

  function removeEntry(id) {
    setEntries(prev => prev.filter(e => e.id !== id))
    setDeleteId(null)
  }

  function handleFile(ev) {
    const file = ev.target.files[0]
    if (!file) return
    setImportError('')
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = String(reader.result)
        const txs = parseCSV(text)
        if (txs.length === 0) {
          setImportError('Keine Buchungen erkannt. Erwartet werden Spalten wie "Datum, Verwendungszweck, Betrag".')
          setImportTxs([])
          return
        }
        const annotated = txs.map((t, i) => {
          const cat = autoCategorize(t.desc, t.amount)
          return { ...t, id: i, type: t.amount > 0 ? 'income' : 'expense', category: cat.category, selected: true }
        })
        setImportTxs(annotated)
      } catch (e) {
        setImportError('Fehler beim Lesen der Datei.')
      }
    }
    reader.readAsText(file, 'utf-8')
    ev.target.value = ''
  }

  function toggleImportTx(id) {
    setImportTxs(prev => prev.map(t => t.id === id ? { ...t, selected: !t.selected } : t))
  }

  function importSelected() {
    const selected = importTxs.filter(t => t.selected)
    let id = nextId
    const newEntries = selected.map(t => {
      const e = {
        id: id++,
        type: t.type,
        label: t.desc.slice(0, 40),
        category: t.category,
        amount: Math.abs(t.amount),
        interval: 'none'
      }
      return e
    })
    setEntries(prev => [...prev, ...newEntries])
    setNextId(id)
    setImportTxs([])
  }

  const balColor = balance >= 0 ? '#4ade80' : '#f87171'
  const foreColor = forecast >= 0 ? '#4ade80' : '#f87171'

  const importSum = importTxs.filter(t => t.selected).reduce((s, t) => s + t.amount, 0)
  const importCount = importTxs.filter(t => t.selected).length

  return (
    <div className={s.app}>
      <header className={s.header}>
        <div className={s.headerTop}>
          <div>
            <div className={s.eyebrow}>Haushaltsrechner</div>
            <div className={s.logo}>Budget<span className={s.dot}>.</span></div>
          </div>
          <div className={s.headerDate}>
            <div className={s.dateMain}>{monthName} {today.getFullYear()}</div>
            <div className={s.dateSub}>Tag {dayOfMonth} / {daysInMonth} &mdash; noch {daysLeft}d</div>
          </div>
        </div>
        <nav className={s.tabs}>
          {[['overview', 'Ubersicht'], ['eintraege', 'Eintraege'], ['analyse', 'Analyse'], ['import', 'Import']].map(([key, label]) => (
            <button key={key} className={`${s.tab} ${tab === key ? s.tabActive : ''}`} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className={s.main}>

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div className={s.fadeIn}>
            <div className={s.kpiGrid}>
              {[
                { label: 'Einnahmen/Mon.', value: monthlyIncome, color: '#4ade80', count: incomeEntries.length },
                { label: 'Ausgaben/Mon.', value: monthlyExpense, color: '#f87171', count: expenseEntries.length },
                { label: 'Saldo/Mon.', value: balance, color: balColor, count: null },
              ].map(c => (
                <div key={c.label} className={s.kpiCard}>
                  <div className={s.kpiLabel}>{c.label}</div>
                  <div className={s.kpiValue} style={{ color: c.color }}>{eur(c.value)}</div>
                  {c.count !== null && <div className={s.kpiSub}>{c.count} Posten</div>}
                </div>
              ))}
            </div>

            {/* Month Bar Chart */}
            <div className={s.card}>
              <div className={s.sectionLabel} style={{ marginBottom: 14 }}>Monatsvergleich</div>
              <MonthBars income={monthlyIncome} expense={monthlyExpense} />
            </div>

            {/* Donut */}
            {catBreakdown.length > 0 && (
              <div className={s.card}>
                <div className={s.sectionLabel} style={{ marginBottom: 14 }}>Ausgabenverteilung</div>
                <div className={s.donutWrap}>
                  <Donut data={catBreakdown} total={monthlyExpense} />
                  <div className={s.donutLegend}>
                    {catBreakdown.slice(0, 6).map(([cat, val], i) => (
                      <div key={cat} className={s.legendRow}>
                        <span className={s.legendDot} style={{ background: CAT_COLORS[cat] || `hsl(${i * 47}, 70%, 60%)` }} />
                        <span className={s.legendLabel}>{cat}</span>
                        <span className={s.legendVal}>{Math.round(monthlyExpense > 0 ? (val / monthlyExpense) * 100 : 0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className={s.card}>
              <div className={s.progressRow}>
                <span className={s.progressLabel}>Monatsfortschritt</span>
                <span className={s.progressPct}>{Math.round(progressPct)}%</span>
              </div>
              <div className={s.track}><div className={s.trackFill} style={{ width: `${progressPct}%`, background: '#f0b429' }} /></div>
              <div className={s.progressRow} style={{ marginTop: 14 }}>
                <span className={s.progressLabel}>Ausgabenquote</span>
                <span className={s.progressPct} style={{ color: burnPct > 90 ? '#f87171' : burnPct > 70 ? '#fbbf24' : '#4ade80' }}>{Math.round(burnPct)}%</span>
              </div>
              <div className={s.track}><div className={s.trackFill} style={{ width: `${burnPct}%`, background: burnPct > 90 ? '#f87171' : burnPct > 70 ? '#fbbf24' : '#4ade80' }} /></div>
            </div>

            <div className={s.forecastCard} style={{ borderColor: forecast >= 0 ? '#1a2e1a' : '#2e1a1a' }}>
              <div className={s.kpiLabel}>Prognose Monatsende</div>
              <div className={s.forecastAmount} style={{ color: foreColor }}>{eur(forecast)}</div>
              <div className={s.forecastSub}>{forecast >= 0 ? 'voraussichtlich verfugbar' : 'voraussichtliches Defizit'}</div>
              <div className={s.forecastRows}>
                {[
                  { label: 'Einnahmen (Monat)', val: monthlyIncome, c: '#4ade80', sign: '+' },
                  { label: 'Fixkosten (Monat)', val: fixedExpense, c: '#f87171', sign: '-' },
                  { label: 'Variable Ausgaben', val: variableExpense, c: '#fbbf24', sign: '-' },
                ].map(r => (
                  <div key={r.label} className={s.forecastRow}>
                    <span className={s.forecastRowLabel}>{r.label}</span>
                    <span style={{ color: r.c, fontWeight: 500 }}>{r.sign}{eur(r.val)}</span>
                  </div>
                ))}
                <div className={s.forecastRowTotal}>
                  <span>Ergebnis</span>
                  <span style={{ color: foreColor, fontWeight: 700 }}>{eur(forecast)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* EINTRAEGE */}
        {tab === 'eintraege' && (
          <div className={s.fadeIn}>
            <button className={s.addBtn} onClick={() => { if (showForm) { setShowForm(false); setEditId(null) } else openNewForm() }}>
              {showForm ? 'Abbrechen' : '+ Neuer Eintrag'}
            </button>

            {showForm && (
              <div className={s.formCard}>
                <div className={s.formRow}>
                  <label className={s.formLabel}>Typ</label>
                  <select
                    className={s.select}
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value, category: e.target.value === 'income' ? CATEGORIES_INCOME[0] : CATEGORIES_EXPENSE[0] }))}
                  >
                    <option value='income'>Einnahme</option>
                    <option value='expense'>Ausgabe</option>
                  </select>
                </div>
                <div className={s.formRow}>
                  <label className={s.formLabel}>Bezeichnung</label>
                  <input
                    className={s.input}
                    value={form.label}
                    onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                    placeholder='z.B. Spotify'
                    inputMode='text'
                  />
                </div>
                <div className={s.formRow}>
                  <label className={s.formLabel}>Kategorie</label>
                  <select
                    className={s.select}
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  >
                    {(form.type === 'income' ? CATEGORIES_INCOME : CATEGORIES_EXPENSE).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className={s.formRow}>
                  <label className={s.formLabel}>Betrag (EUR)</label>
                  <input
                    className={s.input}
                    type='number'
                    inputMode='decimal'
                    min='0'
                    step='0.01'
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder='0.00'
                  />
                </div>
                <div className={s.formRow}>
                  <label className={s.formLabel}>Intervall</label>
                  <select
                    className={s.select}
                    value={form.interval}
                    onChange={e => setForm(f => ({ ...f, interval: e.target.value }))}
                  >
                    {INTERVALS.map(i => <option key={i.key} value={i.key}>{i.label}</option>)}
                  </select>
                  {form.interval !== 'none' && form.amount && (
                    <div className={s.hint}>
                      = {eur(parseFloat(form.amount || 0) * intervalPerMonth(form.interval))} pro Monat
                    </div>
                  )}
                </div>
                {formError && <div className={s.error}>{formError}</div>}
                <button className={s.submitBtn} onClick={saveEntry}>{editId !== null ? 'Aktualisieren' : 'Hinzufugen'}</button>
              </div>
            )}

            {[{ label: 'Einnahmen', data: incomeEntries, color: '#4ade80' }, { label: 'Ausgaben', data: expenseEntries, color: '#f87171' }].map(sec => (
              <div key={sec.label} className={s.section}>
                <div className={s.sectionLabel}>{sec.label}</div>
                {sec.data.length === 0 && <div className={s.emptyMsg}>Keine Eintraege</div>}
                {sec.data.map(e => {
                  const intervalLabel = INTERVALS.find(i => i.key === e.interval)?.label || 'Einmalig'
                  const monthly = e.interval !== 'none' ? monthlyEquivalent(e) : null
                  return (
                    <div key={e.id} className={s.entryRow}>
                      <div className={s.entryInfo} onClick={() => openEditForm(e)}>
                        <div className={s.entryLabel}>{e.label}</div>
                        <div className={s.entrySub}>
                          {e.category}
                          {e.interval !== 'none' && <span className={s.badge}>{intervalLabel}</span>}
                        </div>
                      </div>
                      <div className={s.entryRight}>
                        <div className={s.entryAmount} style={{ color: sec.color }}>{eur(e.amount)}</div>
                        {monthly !== null && <div className={s.entrySub2}>= {eur(monthly)}/M</div>}
                        {deleteId === e.id ? (
                          <div className={s.confirmRow}>
                            <button className={s.confirmYes} onClick={() => removeEntry(e.id)}>Loschen</button>
                            <button className={s.confirmNo} onClick={() => setDeleteId(null)}>Nein</button>
                          </div>
                        ) : (
                          <button className={s.deleteBtn} onClick={() => setDeleteId(e.id)}>x</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {/* ANALYSE */}
        {tab === 'analyse' && (
          <div className={s.fadeIn}>
            {/* Bar Chart Kategorien */}
            <div className={s.section}>
              <div className={s.sectionLabel}>Ausgaben nach Kategorie (Monat)</div>
              {catBreakdown.length === 0 && <div className={s.emptyMsg}>Keine Ausgaben erfasst</div>}
              {catBreakdown.length > 0 && (
                <HBars data={catBreakdown} max={catBreakdown[0][1]} />
              )}
            </div>

            {monthlyExpense > 0 && (
              <div className={s.card}>
                <div className={s.sectionLabel} style={{ marginBottom: 14 }}>Kennzahlen</div>
                {[
                  { label: 'Schnitt pro Tag', val: eur(monthlyExpense / daysInMonth) },
                  { label: 'Schnitt pro Woche', val: eur(monthlyExpense / 4.345) },
                  { label: 'Jahres-Hochrechnung', val: eur(monthlyExpense * 12) },
                  { label: 'Sparquote', val: monthlyIncome > 0 ? `${Math.round((balance / monthlyIncome) * 100)}%` : '-' },
                  { label: 'Fixkostenanteil', val: monthlyExpense > 0 ? `${Math.round((fixedExpense / monthlyExpense) * 100)}%` : '-' },
                  { label: 'Fixkosten/Monat', val: eur(fixedExpense) },
                  { label: 'Variable/Monat', val: eur(variableExpense) },
                ].map(r => (
                  <div key={r.label} className={s.metaRow}>
                    <span className={s.metaLabel}>{r.label}</span>
                    <span className={s.metaVal}>{r.val}</span>
                  </div>
                ))}
              </div>
            )}

            <button className={s.resetBtn} onClick={() => { if (window.confirm('Alle Eintraege zurucksetzen?')) { setEntries(DEFAULT_ENTRIES); setNextId(6) } }}>
              Zurucksetzen
            </button>
          </div>
        )}

        {/* IMPORT */}
        {tab === 'import' && (
          <div className={s.fadeIn}>
            <div className={s.card}>
              <div className={s.sectionLabel} style={{ marginBottom: 10 }}>Kontoauszug importieren</div>
              <div className={s.importText}>
                Lade eine CSV-Datei deiner Bank hoch. Die App erkennt automatisch Datum, Verwendungszweck und Betrag und kategorisiert die Buchungen.
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFile}
                style={{ display: 'none' }}
              />
              <button className={s.addBtn} onClick={() => fileRef.current?.click()} style={{ marginTop: 14, marginBottom: 0 }}>
                CSV-Datei waehlen
              </button>
              {importError && <div className={s.error} style={{ marginTop: 12 }}>{importError}</div>}
            </div>

            {importTxs.length > 0 && (
              <>
                <div className={s.importSummary}>
                  <div>
                    <div className={s.importSummaryLabel}>{importCount} von {importTxs.length} ausgewaehlt</div>
                    <div className={s.importSummaryVal}>{eur(importSum)} Summe</div>
                  </div>
                  <button className={s.submitBtn} style={{ width: 'auto', padding: '10px 16px' }} onClick={importSelected} disabled={importCount === 0}>
                    Uebernehmen
                  </button>
                </div>

                <div className={s.section}>
                  <div className={s.sectionLabel}>Erkannte Buchungen</div>
                  {importTxs.map(t => (
                    <label key={t.id} className={s.importRow}>
                      <input
                        type="checkbox"
                        checked={t.selected}
                        onChange={() => toggleImportTx(t.id)}
                        style={{ accentColor: '#f0b429', marginRight: 10 }}
                      />
                      <div className={s.entryInfo}>
                        <div className={s.entryLabel}>{t.desc}</div>
                        <div className={s.entrySub}>
                          {t.date} <span className={s.badge}>{t.category}</span>
                        </div>
                      </div>
                      <div className={s.entryAmount} style={{ color: t.amount > 0 ? '#4ade80' : '#f87171' }}>
                        {t.amount > 0 ? '+' : ''}{eur(t.amount)}
                      </div>
                    </label>
                  ))}
                </div>
              </>
            )}

            <div className={s.card} style={{ marginTop: 16 }}>
              <div className={s.sectionLabel} style={{ marginBottom: 10 }}>Hinweis zum CSV-Format</div>
              <div className={s.importText}>
                Funktioniert mit den meisten deutschen Banken (Sparkasse, DKB, ING, Comdirect, N26, etc.). Erwartet werden Spalten fuer Datum, Verwendung/Empfaenger und Betrag. Trennzeichen Komma oder Semikolon. Beim Betrag werden deutsche Format-Zahlen (z.B. -1.234,56) korrekt gelesen.
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
