import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock fs and os modules
vi.mock('fs');
vi.mock('os', () => ({
  homedir: () => '/mock/home',
}));

// Import after mocks are set up
const { readPaulyConfig, getConfigValue, updateConfigValue, deleteConfigValue } = await import('./config.js');

describe('config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('readPaulyConfig', () => {
    it('returns empty object when config file does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const config = readPaulyConfig();
      expect(config).toEqual({});
    });

    it('parses config file correctly', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(`
# Comment line
EMAIL="test@example.com"
PROJECTS_DIR="/home/user/Projects"

EMPTY_VALUE=""
`);

      const config = readPaulyConfig();
      expect(config.EMAIL).toBe('test@example.com');
      expect(config.PROJECTS_DIR).toBe('/home/user/Projects');
      expect(config.EMPTY_VALUE).toBe('');
    });

    it('ignores invalid lines', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(`
EMAIL="valid@example.com"
invalid line without equals
ALSO_VALID="yes"
`);

      const config = readPaulyConfig();
      expect(config.EMAIL).toBe('valid@example.com');
      expect(config.ALSO_VALID).toBe('yes');
      expect(Object.keys(config)).toHaveLength(2);
    });

    it('handles values without quotes', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(`
NUMERIC=12345
`);

      const config = readPaulyConfig();
      expect(config.NUMERIC).toBe('12345');
    });
  });

  describe('getConfigValue', () => {
    it('returns value for existing key', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('EMAIL="test@example.com"');

      expect(getConfigValue('EMAIL')).toBe('test@example.com');
    });

    it('returns undefined for missing key', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('EMAIL="test@example.com"');

      expect(getConfigValue('NONEXISTENT')).toBeUndefined();
    });
  });

  describe('updateConfigValue', () => {
    it('creates config directory if it does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdirSync).mockReturnValue(undefined);
      vi.mocked(writeFileSync).mockReturnValue(undefined);

      updateConfigValue('NEW_KEY', 'new_value');

      expect(mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.config/pauly'),
        { recursive: true }
      );
    });

    it('updates existing key', () => {
      vi.mocked(existsSync).mockImplementation((path) => true);
      vi.mocked(readFileSync).mockReturnValue('EMAIL="old@example.com"');
      vi.mocked(writeFileSync).mockReturnValue(undefined);

      updateConfigValue('EMAIL', 'new@example.com');

      expect(writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('EMAIL="new@example.com"')
      );
    });

    it('adds new key at end', () => {
      vi.mocked(existsSync).mockImplementation((path) => true);
      vi.mocked(readFileSync).mockReturnValue('EMAIL="test@example.com"');
      vi.mocked(writeFileSync).mockReturnValue(undefined);

      updateConfigValue('NEW_KEY', 'new_value');

      expect(writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('NEW_KEY="new_value"')
      );
    });
  });

  describe('deleteConfigValue', () => {
    it('returns false when config file does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = deleteConfigValue('EMAIL');
      expect(result).toBe(false);
    });

    it('removes key from config file', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(`EMAIL="test@example.com"
PROJECTS_DIR="/home/user/Projects"`);
      vi.mocked(writeFileSync).mockReturnValue(undefined);

      const result = deleteConfigValue('EMAIL');

      expect(result).toBe(true);
      expect(writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.not.stringContaining('EMAIL=')
      );
    });

    it('returns false when key not found', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('EMAIL="test@example.com"');

      const result = deleteConfigValue('NONEXISTENT');
      expect(result).toBe(false);
    });
  });
});
