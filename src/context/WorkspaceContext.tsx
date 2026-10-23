import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { apiFetch } from '../utils/api';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

export interface Workspace {
  id: string;
  userId: string;
  name: string;
  industry: string;
  currency: string;
  createdAt: string;
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  isLoading: boolean;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  createWorkspace: (data: { name: string; industry: string; currency?: string }) => Promise<Workspace>;
  updateWorkspace: (id: string, data: { name?: string; industry?: string; currency?: string }) => Promise<Workspace>;
  deleteWorkspace: (id: string) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshWorkspaces = useCallback(async () => {
    if (!user) {
      setWorkspaces([]);
      setActiveWorkspace(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const res = await apiFetch<{ workspaces: Workspace[] }>('/api/workspaces');
      const wsList = res?.workspaces || [];
      setWorkspaces(wsList);

      if (wsList.length > 0) {
        const storedId = localStorage.getItem('trackwise_active_workspace');
        const matched = wsList.find((w) => w.id === storedId);

        if (matched) {
          setActiveWorkspace(matched);
        } else {
          setActiveWorkspace(wsList[0]);
          localStorage.setItem('trackwise_active_workspace', wsList[0].id);
        }
      } else {
        setActiveWorkspace(null);
      }
    } catch (err: any) {
      console.warn('Failed to load workspaces:', err?.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshWorkspaces();
  }, [refreshWorkspaces]);

  const switchWorkspace = async (workspaceId: string) => {
    const target = workspaces.find((w) => w.id === workspaceId);
    if (!target) return;

    setActiveWorkspace(target);
    localStorage.setItem('trackwise_active_workspace', target.id);
    window.dispatchEvent(
      new CustomEvent('trackwise-workspace-changed', {
        detail: { workspaceId: target.id, workspace: target },
      })
    );
    toast.success(`Switched active workspace to "${target.name}"`);
  };

  const createNewWorkspace = async (data: { name: string; industry: string; currency?: string }): Promise<Workspace> => {
    try {
      const res = await apiFetch<{ workspace: Workspace }>('/api/workspaces', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      const newWs = res.workspace;
      const updatedList = [...workspaces, newWs];
      setWorkspaces(updatedList);
      setActiveWorkspace(newWs);
      localStorage.setItem('trackwise_active_workspace', newWs.id);

      window.dispatchEvent(
        new CustomEvent('trackwise-workspace-changed', {
          detail: { workspaceId: newWs.id, workspace: newWs },
        })
      );
      toast.success(`Created and switched to workspace "${newWs.name}"`);
      return newWs;
    } catch (err: any) {
      toast.error(err.message || 'Failed to create workspace');
      throw err;
    }
  };

  const updateExistingWorkspace = async (
    id: string,
    data: { name?: string; industry?: string; currency?: string }
  ): Promise<Workspace> => {
    try {
      const res = await apiFetch<{ workspace: Workspace }>(`/api/workspaces/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      const updated = res.workspace;
      setWorkspaces((prev) => prev.map((w) => (w.id === id ? updated : w)));
      if (activeWorkspace?.id === id) {
        setActiveWorkspace(updated);
      }
      toast.success(`Workspace "${updated.name}" updated`);
      return updated;
    } catch (err: any) {
      toast.error(err.message || 'Failed to update workspace');
      throw err;
    }
  };

  const removeWorkspace = async (id: string) => {
    try {
      await apiFetch(`/api/workspaces/${id}`, { method: 'DELETE' });
      const remaining = workspaces.filter((w) => w.id !== id);
      setWorkspaces(remaining);

      if (activeWorkspace?.id === id && remaining.length > 0) {
        const nextWs = remaining[0];
        setActiveWorkspace(nextWs);
        localStorage.setItem('trackwise_active_workspace', nextWs.id);
        window.dispatchEvent(
          new CustomEvent('trackwise-workspace-changed', {
            detail: { workspaceId: nextWs.id, workspace: nextWs },
          })
        );
      }
      toast.success('Workspace deleted successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete workspace');
      throw err;
    }
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        isLoading,
        switchWorkspace,
        createWorkspace: createNewWorkspace,
        updateWorkspace: updateExistingWorkspace,
        deleteWorkspace: removeWorkspace,
        refreshWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
