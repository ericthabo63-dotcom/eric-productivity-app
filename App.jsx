import React, { useEffect, useMemo, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { hasFirebaseConfig, auth } from './firebase'
import { removeTask, saveNote, saveTask, subscribeToNotes, subscribeToTasks } from './firestoreService'

const STORAGE_KEY = 'eric_suite_v1'
const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
const emptyTask = { id: '', title: '', notes: '', dueDate: '', priority: 'Medium', category: 'Personal', completed: false, subtasks: [], createdAt: '' }

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { tasks: [], notes: [], darkMode: true }
    return JSON.parse(raw)
  } catch {
    return { tasks: [], notes: [], darkMode: true }
  }
}
function saveLocalData(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
function isToday(dateString) {
  if (!dateString) return false
  const d = new Date(dateString), now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}
function downloadFile(name, content, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
function normalizeTimestamp(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (value?.toDate) return value.toDate().toISOString()
  return ''
}

export default function App() {
  const [data, setData] = useState(loadData)
  const [tab, setTab] = useState('tasks')
  const [taskForm, setTaskForm] = useState(emptyTask)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [noteForm, setNoteForm] = useState({ title: '', body: '', image: '' })
  const [viewDate, setViewDate] = useState(new Date().toISOString().slice(0, 10))
  const [authForm, setAuthForm] = useState({ email: '', password: '' })
  const [user, setUser] = useState(null)
  const [authError, setAuthError] = useState('')

  useEffect(() => { saveLocalData(data) }, [data])
  useEffect(() => { document.documentElement.dataset.theme = data.darkMode ? 'dark' : 'light' }, [data.darkMode])

  useEffect(() => {
    if (!hasFirebaseConfig || !auth) return
    return onAuthStateChanged(auth, setUser)
  }, [])

  useEffect(() => {
    if (!hasFirebaseConfig || !user) return
    const unsubTasks = subscribeToTasks(user.uid, tasks => setData(prev => ({ ...prev, tasks: tasks.map(task => ({ ...task, createdAt: normalizeTimestamp(task.createdAt), completedAt: normalizeTimestamp(task.completedAt) })) })))
    const unsubNotes = subscribeToNotes(user.uid, notes => setData(prev => ({ ...prev, notes: notes.map(note => ({ ...note, createdAt: normalizeTimestamp(note.createdAt) })) })))
    return () => { unsubTasks(); unsubNotes() }
  }, [user])

  const filteredTasks = useMemo(() => data.tasks.filter(task => (task.title.toLowerCase().includes(search.toLowerCase()) || task.notes.toLowerCase().includes(search.toLowerCase())) && (categoryFilter === 'All' || task.category === categoryFilter)), [data.tasks, search, categoryFilter])
  const completedToday = data.tasks.filter(t => t.completed && isToday(t.completedAt)).length
  const categoryStats = Object.entries(data.tasks.reduce((acc, task) => { acc[task.category] = (acc[task.category] || 0) + 1; return acc }, {})).map(([name, value]) => ({ name, value }))
  const weeklyStats = Array.from({ length: 7 }).map((_, idx) => { const d = new Date(); d.setDate(d.getDate() - (6 - idx)); return { label: d.toLocaleDateString(undefined, { weekday: 'short' }), value: data.tasks.filter(t => t.completedAt && new Date(t.completedAt).toDateString() === d.toDateString()).length } })
  const upcomingTasks = [...data.tasks].filter(t => t.dueDate).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
  const selectedDateTasks = data.tasks.filter(t => t.dueDate === viewDate)

  async function addTask(e) {
    e.preventDefault()
    if (!taskForm.title.trim()) return
    const task = { ...taskForm, completed: false, completedAt: '', createdAt: new Date().toISOString(), subtasks: taskForm.subtasks.length ? taskForm.subtasks : [] }
    if (user && hasFirebaseConfig) await saveTask(user.uid, task)
    else setData(prev => ({ ...prev, tasks: [{ ...task, id: crypto.randomUUID() }, ...prev.tasks] }))
    setTaskForm(emptyTask)
  }
  async function toggleTask(id) {
    const task = data.tasks.find(t => t.id === id)
    if (!task) return
    const updated = { ...task, completed: !task.completed, completedAt: !task.completed ? new Date().toISOString() : '' }
    if (user && hasFirebaseConfig) await saveTask(user.uid, updated)
    else setData(prev => ({ ...prev, tasks: prev.tasks.map(task => task.id === id ? updated : task) }))
  }
  async function deleteTask(id) {
    if (user && hasFirebaseConfig) await removeTask(user.uid, id)
    else setData(prev => ({ ...prev, tasks: prev.tasks.filter(task => task.id !== id) }))
  }
  function addSubtaskInput() { setTaskForm(prev => ({ ...prev, subtasks: [...prev.subtasks, { id: crypto.randomUUID(), title: '', done: false }] })) }
  function updateSubtask(index, value) { const subtasks = [...taskForm.subtasks]; subtasks[index] = { ...subtasks[index], title: value }; setTaskForm(prev => ({ ...prev, subtasks })) }
  async function addNote(e) {
    e.preventDefault()
    if (!noteForm.title.trim()) return
    const note = { ...noteForm, createdAt: new Date().toISOString() }
    if (user && hasFirebaseConfig) await saveNote(user.uid, note)
    else setData(prev => ({ ...prev, notes: [{ ...note, id: crypto.randomUUID() }, ...prev.notes] }))
    setNoteForm({ title: '', body: '', image: '' })
  }
  function handleImage(file) { if (!file) return; const reader = new FileReader(); reader.onload = () => setNoteForm(prev => ({ ...prev, image: reader.result })); reader.readAsDataURL(file) }
  function exportCSV() { const rows = [['Title','Completed','Priority','Category','Due Date','Notes'], ...data.tasks.map(t => [t.title, t.completed ? 'Yes' : 'No', t.priority, t.category, t.dueDate || '', t.notes.replaceAll(',', ';')])]; downloadFile('erics_tasks.csv', rows.map(r => r.join(',')).join('\n'), 'text/csv') }
  function exportJSON() { downloadFile('erics_productivity_backup.json', JSON.stringify(data, null, 2), 'application/json') }
  async function signUp() { try { setAuthError(''); await createUserWithEmailAndPassword(auth, authForm.email, authForm.password) } catch (e) { setAuthError(e.message) } }
  async function signIn() { try { setAuthError(''); await signInWithEmailAndPassword(auth, authForm.email, authForm.password) } catch (e) { setAuthError(e.message) } }
  async function logOut() { await signOut(auth) }

  return <div className="app-shell">
    <header className="topbar glass"><div><h1>Eric's Productivity Suite</h1><p>{user ? `Synced with Firebase as ${user.email}` : hasFirebaseConfig ? 'Firebase ready — sign in to sync' : 'Local mode — add Firebase env vars to sync'}</p></div><button className="ghost-btn" onClick={() => setData(prev => ({ ...prev, darkMode: !prev.darkMode }))}>{data.darkMode ? 'Light' : 'Dark'} mode</button></header>

    {hasFirebaseConfig && <section className="panel glass auth-panel"><div className="row wrap gap-sm"><input placeholder="Email" value={authForm.email} onChange={e => setAuthForm(prev => ({ ...prev, email: e.target.value }))} /><input type="password" placeholder="Password" value={authForm.password} onChange={e => setAuthForm(prev => ({ ...prev, password: e.target.value }))} />{!user ? <><button className="primary-btn" onClick={signUp}>Sign up</button><button className="ghost-btn" onClick={signIn}>Sign in</button></> : <button className="ghost-btn" onClick={logOut}>Sign out</button>}</div>{authError && <p className="muted">{authError}</p>}</section>}

    <nav className="tabs glass">{['tasks', 'calendar', 'dashboard', 'notes', 'export'].map(name => <button key={name} className={tab === name ? 'tab active' : 'tab'} onClick={() => setTab(name)}>{name}</button>)}</nav>

    {tab === 'tasks' && <section className="grid two-col"><div className="panel glass"><h2>New Task</h2><form onSubmit={addTask} className="stack gap-sm"><input value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Task title" /><textarea value={taskForm.notes} onChange={e => setTaskForm({ ...taskForm, notes: e.target.value })} placeholder="Notes" rows="4" /><div className="row"><input type="date" value={taskForm.dueDate} onChange={e => setTaskForm({ ...taskForm, dueDate: e.target.value })} /><select value={taskForm.priority} onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select><select value={taskForm.category} onChange={e => setTaskForm({ ...taskForm, category: e.target.value })}><option>Personal</option><option>Work</option><option>Health</option><option>Finance</option><option>Learning</option><option>Errands</option></select></div><div className="subtasks"><div className="row between"><strong>Subtasks</strong><button type="button" className="ghost-btn small" onClick={addSubtaskInput}>+ Add subtask</button></div>{taskForm.subtasks.map((sub, index) => <input key={sub.id} value={sub.title} onChange={e => updateSubtask(index, e.target.value)} placeholder={`Subtask ${index + 1}`} />)}</div><button className="primary-btn" type="submit">Add task</button></form></div><div className="panel glass"><div className="row wrap gap-sm"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks" /><select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option>All</option><option>Personal</option><option>Work</option><option>Health</option><option>Finance</option><option>Learning</option><option>Errands</option></select></div><div className="task-list">{filteredTasks.length === 0 && <p className="muted">No tasks yet.</p>}{filteredTasks.map(task => <article key={task.id} className="task-card"><div className="row between start"><div><h3 className={task.completed ? 'done' : ''}>{task.title}</h3><p className="muted">{task.category} • {task.priority}{task.dueDate ? ` • Due ${task.dueDate}` : ''}</p></div><div className="row gap-xs"><button className="ghost-btn small" onClick={() => toggleTask(task.id)}>{task.completed ? 'Undo' : 'Done'}</button><button className="danger-btn small" onClick={() => deleteTask(task.id)}>Delete</button></div></div>{task.notes && <p>{task.notes}</p>}{task.subtasks?.filter(s => s.title?.trim()).length > 0 && <ul>{task.subtasks.filter(s => s.title?.trim()).map(s => <li key={s.id}>{s.title}</li>)}</ul>}</article>)}</div></div></section>}

    {tab === 'calendar' && <section className="grid two-col"><div className="panel glass"><h2>Agenda</h2><input type="date" value={viewDate} onChange={e => setViewDate(e.target.value)} /><div className="task-list">{selectedDateTasks.length === 0 ? <p className="muted">No tasks due on this date.</p> : selectedDateTasks.map(task => <div className="task-card" key={task.id}><strong>{task.title}</strong><p className="muted">{task.category} • {task.priority}</p></div>)}</div></div><div className="panel glass"><h2>Upcoming deadlines</h2><div className="task-list">{upcomingTasks.slice(0, 10).map(task => <div className="task-card" key={task.id}><strong>{task.title}</strong><p className="muted">{task.dueDate || 'No date'} • {task.category}</p></div>)}{upcomingTasks.length === 0 && <p className="muted">Nothing scheduled yet.</p>}</div></div></section>}

    {tab === 'dashboard' && <section className="stack gap-lg"><div className="grid stats-grid"><div className="panel glass stat"><span>Tasks completed today</span><strong>{completedToday}</strong></div><div className="panel glass stat"><span>Total tasks</span><strong>{data.tasks.length}</strong></div><div className="panel glass stat"><span>Open tasks</span><strong>{data.tasks.filter(t => !t.completed).length}</strong></div><div className="panel glass stat"><span>Notes</span><strong>{data.notes.length}</strong></div></div><div className="grid two-col charts"><div className="panel glass chart-panel"><h2>Completion trend</h2><ResponsiveContainer width="100%" height={280}><BarChart data={weeklyStats}><CartesianGrid strokeDasharray="3 3" opacity={0.2} /><XAxis dataKey="label" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#3b82f6" radius={[8,8,0,0]} /></BarChart></ResponsiveContainer></div><div className="panel glass chart-panel"><h2>Category breakdown</h2><ResponsiveContainer width="100%" height={280}><PieChart><Pie data={categoryStats} dataKey="value" nameKey="name" outerRadius={95}>{categoryStats.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div></div></section>}

    {tab === 'notes' && <section className="grid two-col"><div className="panel glass"><h2>New Note</h2><form onSubmit={addNote} className="stack gap-sm"><input value={noteForm.title} onChange={e => setNoteForm({ ...noteForm, title: e.target.value })} placeholder="Note title" /><textarea value={noteForm.body} onChange={e => setNoteForm({ ...noteForm, body: e.target.value })} placeholder="Write your note" rows="6" /><input type="file" accept="image/*" onChange={e => handleImage(e.target.files?.[0])} /><button className="primary-btn" type="submit">Save note</button></form></div><div className="panel glass"><h2>Saved Notes</h2><div className="task-list">{data.notes.length === 0 && <p className="muted">No notes yet.</p>}{data.notes.map(note => <article key={note.id} className="task-card"><strong>{note.title}</strong><p>{note.body}</p>{note.image && <img className="note-image" src={note.image} alt={note.title} />}</article>)}</div></div></section>}

    {tab === 'export' && <section className="grid two-col"><div className="panel glass stack gap-sm"><h2>Export</h2><button className="primary-btn" onClick={exportCSV}>Export CSV</button><button className="ghost-btn" onClick={exportJSON}>Download backup JSON</button><button className="ghost-btn" onClick={() => window.print()}>Print / Save as PDF</button></div><div className="panel glass stack gap-sm"><h2>Sync status</h2><p>{hasFirebaseConfig ? 'Firebase code is connected. Sign in to sync Firestore data.' : 'Firebase env vars are missing, so the app is still using local browser storage.'}</p></div></section>}
  </div>
}
