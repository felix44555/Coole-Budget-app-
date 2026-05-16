import { useState, useMemo, useEffect } from 'react'
import s from './App.module.css'

const CATEGORIES_INCOME = ['Gehalt', 'Nebenjob', 'Investments', 'Sonstiges']
const CATEGORIES_EXPENSE = ['Miete', 'Lebensmittel', 'Transport', 'Freizeit', 'Versicherung', 'Abonnements', 'Gesundheit', 'Sonstiges']

const DEFAULT_ENTRIES = [
  { id: 1, type: 'income', label: 'Gehalt', category: 'Gehalt', amount: 3200, recurring: true },
  { id: 2, type: 'expense', label: 'Miete', category: 'Miete', amount: 950, recurring: true },
  { id: 3, type: 'expense', label: 'Lebensmittel', category: 'Lebensmittel', amount: 320, recurring: false },
]

function eur(n) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

const today = new Date()
const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
const dayOfMonth = today.getDate()
const daysLeft = daysInMonth - dayOfMonth
const monthName = today.toLocaleString('de-DE', { month: 'long' })

export default function App() {
  const [entries, setEntries] = useState(() => {
    try {
      const saved = localStorage.getItem('budget-entries')
      return saved ? JSON.parse(saved) : DEFAULT_ENTRIES
    } catch { return DEFAULT_ENTRIES }
  })
  const [tab, setTab] = useState('overview')
  const [form, setForm] = useState({ type: 'expense', label: '', category: CATEGORIES_EXPENSE[0], amount: '', recurring: false })
  const [nextId, setNextId] = useState(() => {
    try {
      const saved = localStorage.getItem('budget-entries')
      const arr = saved ? JSON.parse(saved) : DEFAULT_ENTRIES
      return Math.max(...arr.map(e => e.id), 0) + 1
    } catch { return 4 }
  })
  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteId, setDeleteId] = useState(null)

  useEffect(() => {
    try { localStorage.setItem('budget-entries', JSON.stringify(entries)) } catch {}
  }, [entries])

  const totalIncome = useMemo(() => entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0), [entries])
  const totalExpense = useMemo(() => entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0), [entries])
  const balance = totalIncome - totalExpense

  const recurringDailyExpense = useMemo(() => {
    return entries.filter(e => e.type === 'expense' && e.recurring).reduce((s, e) => s + e.amount / daysInMonth, 0)
  }, [entries])

  const projectedExtra = recurringDailyExpense * daysLeft
  const forecast = totalIncome - totalExpense - projectedExtra

  const progressPct = Math.min(100, (dayOfMonth / daysInMonth) * 100)
  const burnPct = Math.min(100, totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0)

  const incomeEntries = entries.filter(e => e.type === 'income')
  const expenseEntries = entries.filter(e => e.type === 'expense')

  const catBreakdown = useMemo(() => {
    const map = {}
    expenseEntries.forEach(e => { map[e.category] = (map[e.category] || 0) + e.amount })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [expenseEntries])

  function addEntry() {
    if (!form.label.trim()) { setFormError('Bezeichnung fehlt'); return }
    const amt = parseFloat(form.amount)
    if (!amt || amt <= 0) { setFormError('Ungultiger Betrag'); return }
    setEntries(prev => [...prev, { ...form, amount: amt, id: nextId }])
    setNextId(n => n + 1)
    setForm(f => ({ ...f, label: '', amount: '', recurring: false }))
    setFormError('')
    setShowForm(false)
  }

  function removeEntry(id) {
    setEntries(prev => prev.filter(e => e.id !== id))
    setDeleteId(null)
  }

  const balColor = balance >= 0 ? '#4ade80' : '#f87171'
  const foreColor = forecast >= 0 ? '#4ade80' : '#f87171'

  return (
    <div className={s.app}>
      {/* Header */}
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
          {[['overview', 'Ubersicht'], ['eintraege', 'Eintraege'], ['analyse', 'Analyse']].map(([key, label]) => (
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
                { label: 'Einnahmen', value: totalIncome, color: '#4ade80', count: incomeEntries.length },
                { label: 'Ausgaben', value: totalExpense, color: '#f87171', count: expenseEntries.length },
                { label: 'Saldo', value: balance, color: balColor, count: null },
              ].map(c => (
                <div key={c.label} className={s.kpiCard}>
                  <div className={s.kpiLabel}>{c.label}</div>
                  <div className={s.kpiValue} style={{ color: c.color }}>{eur(c.value)}</div>
                  {c.count !== null && <div className={s.kpiSub}>{c.count} Posten</div>}
                </div>
              ))}
            </div>

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
                  { label: 'Einnahmen gesamt', val: totalIncome, c: '#4ade80', sign: '+' },
                  { label: 'Ausgaben bisher', val: totalExpense, c: '#f87171', sign: '-' },
                  { label: `Projektion (${daysLeft} Tage)`, val: projectedExtra, c: '#fbbf24', sign: '-' },
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
            <button className={s.addBtn} onClick={() => { setShowForm(v => !v); setFormError('') }}>
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
                <label className={s.checkRow}>
                  <input type='checkbox' checked={form.recurring} onChange={e => setForm(f => ({ ...f, recurring: e.target.checked }))} style={{ accentColor: '#f0b429' }} />
                  <span>Wiederkehrend (fliesst in Prognose ein)</span>
                </label>
                {formError && <div className={s.error}>{formError}</div>}
                <button className={s.submitBtn} onClick={addEntry}>Hinzufugen</button>
              </div>
            )}

            {[{ label: 'Einnahmen', data: incomeEntries, color: '#4ade80' }, { label: 'Ausgaben', data: expenseEntries, color: '#f87171' }].map(sec => (
              <div key={sec.label} className={s.section}>
                <div className={s.sectionLabel}>{sec.label}</div>
                {sec.data.length === 0 && <div className={s.emptyMsg}>Keine Eintraege</div>}
                {sec.data.map(e => (
                  <div key={e.id} className={s.entryRow}>
                    <div className={s.entryInfo}>
                      <div className={s.entryLabel}>{e.label}</div>
                      <div className={s.entrySub}>
                        {e.category}
                        {e.recurring && <span className={s.badge}>wiederk.</span>}
                      </div>
                    </div>
                    <div className={s.entryRight}>
                      <div className={s.entryAmount} style={{ color: sec.color }}>{eur(e.amount)}</div>
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
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ANALYSE */}
        {tab === 'analyse' && (
          <div className={s.fadeIn}>
            <div className={s.section}>
              <div className={s.sectionLabel}>Ausgaben nach Kategorie</div>
              {catBreakdown.length === 0 && <div className={s.emptyMsg}>Keine Ausgaben erfasst</div>}
              {catBreakdown.map(([cat, amt]) => {
                const pct = totalExpense > 0 ? (amt / totalExpense) * 100 : 0
                return (
                  <div key={cat} className={s.catRow}>
                    <div className={s.catTop}>
                      <span className={s.catName}>{cat}</span>
                      <span className={s.catAmt}>{eur(amt)} <span className={s.catPct}>({Math.round(pct)}%)</span></span>
                    </div>
                    <div className={s.track}>
                      <div className={s.trackFill} style={{ width: `${pct}%`, background: `hsl(${30 + pct * 1.2}, 80%, 55%)` }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {totalExpense > 0 && (
              <div className={s.card}>
                <div className={s.sectionLabel} style={{ marginBottom: 14 }}>Kennzahlen</div>
                {[
                  { label: 'Schnitt pro Tag (bisher)', val: eur(totalExpense / dayOfMonth) },
                  { label: 'Hochrechnung Gesamtmonat', val: eur((totalExpense / dayOfMonth) * daysInMonth) },
                  { label: 'Sparquote aktuell', val: totalIncome > 0 ? `${Math.round((balance / totalIncome) * 100)}%` : '-' },
                  { label: 'Fixkostenanteil', val: (() => { const fix = entries.filter(e => e.type === 'expense' && e.recurring).reduce((s, e) => s + e.amount, 0); return totalExpense > 0 ? `${Math.round((fix / totalExpense) * 100)}%` : '-' })() },
                ].map(r => (
                  <div key={r.label} className={s.metaRow}>
                    <span className={s.metaLabel}>{r.label}</span>
                    <span className={s.metaVal}>{r.val}</span>
                  </div>
                ))}
              </div>
            )}

            <button className={s.resetBtn} onClick={() => { if (window.confirm('Alle Eintraege zurucksetzen?')) { setEntries(DEFAULT_ENTRIES); setNextId(4) } }}>
              Zurucksetzen
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
