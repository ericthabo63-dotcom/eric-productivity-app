import { collection, addDoc, doc, setDoc, deleteDoc, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

export function subscribeToTasks(userId, onChange) {
  return onSnapshot(query(collection(db, 'users', userId, 'tasks'), orderBy('createdAt', 'desc')), snap => {
    onChange(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

export function subscribeToNotes(userId, onChange) {
  return onSnapshot(query(collection(db, 'users', userId, 'notes'), orderBy('createdAt', 'desc')), snap => {
    onChange(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

export async function saveTask(userId, task) {
  if (task.id) {
    const { id, ...payload } = task
    await setDoc(doc(db, 'users', userId, 'tasks', id), payload, { merge: true })
    return id
  }
  const ref = await addDoc(collection(db, 'users', userId, 'tasks'), { ...task, createdAt: serverTimestamp() })
  return ref.id
}

export async function saveNote(userId, note) {
  if (note.id) {
    const { id, ...payload } = note
    await setDoc(doc(db, 'users', userId, 'notes', id), payload, { merge: true })
    return id
  }
  const ref = await addDoc(collection(db, 'users', userId, 'notes'), { ...note, createdAt: serverTimestamp() })
  return ref.id
}

export async function removeTask(userId, id) {
  await deleteDoc(doc(db, 'users', userId, 'tasks', id))
}
