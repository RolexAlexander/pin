// src/preload.ts
import { contextBridge, ipcRenderer } from 'electron';
import { Note, Tag, NotePayload } from './types';

// This is the API object that will be exposed to the renderer process
export const electronAPI = {
    // Note functions
    getNotes: (searchTerm?: string): Promise<Note[]> => ipcRenderer.invoke('get-notes', searchTerm),
    saveNote: (note: NotePayload): Promise<Note> => ipcRenderer.invoke('save-note', note),
    deleteNote: (noteId: string): Promise<void> => ipcRenderer.invoke('delete-note', noteId),

    // Tag functions
    getTags: (): Promise<Tag[]> => ipcRenderer.invoke('get-tags'),
    addTag: (tagName: string): Promise<Tag> => ipcRenderer.invoke('add-tag', tagName),
    deleteTag: (tagId: string): Promise<void> => ipcRenderer.invoke('delete-tag', tagId),
};

// Expose the API to the renderer process under the 'window.electronAPI' object
contextBridge.exposeInMainWorld('electronAPI', electronAPI);