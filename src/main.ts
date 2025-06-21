// src/main.ts
import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import path from 'path';
import Store from 'electron-store';
import { Note, Tag, NotePayload } from './types';

// Define the shape of our database
type AppStore = {
  notes: Note[];
  tags: Tag[];
};

// Initialize the store. It will create a JSON file in the app's user data directory.
const store = new Store<AppStore>({
  defaults: {
    notes: [],
    tags: [],
  },
});

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // --- ADD THIS LINE ---
  // This removes the "File, Edit, View" etc. menu.
  Menu.setApplicationMenu(null); 
  
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
}

app.on('ready', createWindow);
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());
app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());

// =================================================================
// API DEFINITIONS
// =================================================================

// --- Notes API ---

ipcMain.handle('get-notes', (_event, searchTerm?: string): Note[] => {
  const notes = store.get('notes', []);
  if (!searchTerm) {
    return notes.sort((a, b) => b.updatedAt - a.updatedAt); // Show most recent first
  }
  return notes
    .filter(note => 
        note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.content.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
});

ipcMain.handle('save-note', (_event, notePayload: NotePayload): Note => {
  const notes = store.get('notes', []);
  const now = Date.now();

  if (notePayload.id) { // Update existing note
    const noteIndex = notes.findIndex(n => n.id === notePayload.id);
    if (noteIndex > -1) {
      const updatedNote = { ...notes[noteIndex], ...notePayload, updatedAt: now };
      notes[noteIndex] = updatedNote;
      store.set('notes', notes);
      return updatedNote;
    }
  }

  // Create new note
  const newNote: Note = {
    id: now.toString(),
    title: notePayload.title || 'Untitled Note',
    content: notePayload.content || '',
    tagIds: notePayload.tagIds || [],
    createdAt: now,
    updatedAt: now,
  };
  notes.push(newNote);
  store.set('notes', notes);
  return newNote;
});


ipcMain.handle('delete-note', (_event, noteId: string): void => {
  const notes = store.get('notes', []);
  const filteredNotes = notes.filter(n => n.id !== noteId);
  store.set('notes', filteredNotes);
});

// --- Tags API ---

ipcMain.handle('get-tags', (): Tag[] => {
  return store.get('tags', []);
});

ipcMain.handle('add-tag', (_event, tagName: string): Tag => {
  const tags = store.get('tags', []);
  const existingTag = tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
  if (existingTag) return existingTag; // Don't add duplicates

  const newTag: Tag = {
    id: Date.now().toString(),
    name: tagName,
  };
  tags.push(newTag);
  store.set('tags', tags);
  return newTag;
});

ipcMain.handle('delete-tag', (_event, tagId: string): void => {
    // 1. Delete the tag itself
    const tags = store.get('tags', []);
    const filteredTags = tags.filter(t => t.id !== tagId);
    store.set('tags', filteredTags);

    // 2. Remove the tagId from any notes that use it
    const notes = store.get('notes', []);
    const updatedNotes = notes.map(note => ({
      ...note,
      tagIds: note.tagIds.filter(id => id !== tagId)
    }));
    store.set('notes', updatedNotes);
});