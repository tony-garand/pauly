import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  fetchApi,
  fetchHealth,
  fetchProjects,
  fetchProjectDetail,
  addProjectTask,
  deleteProject,
} from './api';

describe('api', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('fetchApi', () => {
    it('returns data on successful response', async () => {
      const mockData = { status: 'ok' };
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      } as Response);

      const result = await fetchApi('/test');
      expect(result).toEqual(mockData);
    });

    it('throws error on non-ok response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      await expect(fetchApi('/test')).rejects.toThrow('API error: 404');
    });
  });

  describe('fetchHealth', () => {
    it('fetches health status', async () => {
      const mockHealth = { status: 'healthy' };
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockHealth),
      } as Response);

      const result = await fetchHealth();
      expect(result).toEqual(mockHealth);
      expect(fetch).toHaveBeenCalledWith('/api/health');
    });
  });

  describe('fetchProjects', () => {
    it('fetches project list', async () => {
      const mockProjects = {
        projects: [
          { name: 'project1', path: '/path/1', hasGit: true, hasContextMd: false },
        ],
      };
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProjects),
      } as Response);

      const result = await fetchProjects();
      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].name).toBe('project1');
    });
  });

  describe('fetchProjectDetail', () => {
    it('fetches project detail and returns project object', async () => {
      const mockProject = {
        project: {
          name: 'test-project',
          path: '/path/to/project',
          hasGit: true,
          hasContextMd: true,
          gitBranch: 'main',
        },
      };
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProject),
      } as Response);

      const result = await fetchProjectDetail('test-project');
      expect(result.name).toBe('test-project');
      expect(result.gitBranch).toBe('main');
    });

    it('encodes project name in URL', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ project: { name: 'my project' } }),
      } as Response);

      await fetchProjectDetail('my project');
      expect(fetch).toHaveBeenCalledWith('/api/projects/my%20project');
    });
  });

  describe('addProjectTask', () => {
    it('sends POST request with task text', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response);

      await addProjectTask('test-project', 'New task');

      expect(fetch).toHaveBeenCalledWith(
        '/api/projects/test-project/tasks',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: 'New task' }),
        })
      );
    });

    it('throws error on failure', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Task creation failed' }),
      } as Response);

      await expect(addProjectTask('test', 'task')).rejects.toThrow('Task creation failed');
    });
  });

  describe('deleteProject', () => {
    it('sends DELETE request', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response);

      await deleteProject('test-project');

      expect(fetch).toHaveBeenCalledWith(
        '/api/projects/test-project',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('encodes project name in URL', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response);

      await deleteProject('project with spaces');

      expect(fetch).toHaveBeenCalledWith(
        '/api/projects/project%20with%20spaces',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });
});
