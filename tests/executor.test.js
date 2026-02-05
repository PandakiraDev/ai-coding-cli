import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

import inquirer from 'inquirer';
import { exec } from 'child_process';
import { isDangerousCommand, executeCommand, handlePowerShellCommands } from '../src/executor.js';

describe('executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isDangerousCommand', () => {
    it('should detect Remove-Item as dangerous', () => {
      expect(isDangerousCommand('Remove-Item -Path C:\\test')).toBe(true);
    });

    it('should detect Format-Volume as dangerous', () => {
      expect(isDangerousCommand('Format-Volume -DriveLetter C')).toBe(true);
    });

    it('should detect Invoke-Expression as dangerous', () => {
      expect(isDangerousCommand('Invoke-Expression "malicious"')).toBe(true);
    });

    it('should detect rm as dangerous', () => {
      expect(isDangerousCommand('rm -rf /something')).toBe(true);
    });

    it('should detect Stop-Process as dangerous', () => {
      expect(isDangerousCommand('Stop-Process -Name notepad')).toBe(true);
    });

    it('should detect shutdown as dangerous', () => {
      expect(isDangerousCommand('shutdown /s /t 0')).toBe(true);
    });

    it('should not flag safe commands', () => {
      expect(isDangerousCommand('Get-Process')).toBe(false);
      expect(isDangerousCommand('Get-ChildItem')).toBe(false);
      expect(isDangerousCommand('Write-Host "Hello"')).toBe(false);
      expect(isDangerousCommand('dir')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(isDangerousCommand('remove-item test')).toBe(true);
      expect(isDangerousCommand('INVOKE-EXPRESSION test')).toBe(true);
    });
  });

  describe('executeCommand', () => {
    it('should not execute when user declines', async () => {
      inquirer.prompt.mockResolvedValueOnce({ confirm: false });

      await executeCommand('Get-Process');

      expect(exec).not.toHaveBeenCalled();
    });

    it('should execute when user confirms safe command', async () => {
      inquirer.prompt.mockResolvedValueOnce({ confirm: true });
      exec.mockImplementation((cmd, opts, cb) => cb(null, { stdout: 'output', stderr: '' }));

      await executeCommand('Get-Process');

      expect(exec).toHaveBeenCalledTimes(1);
    });

    it('should require double confirmation for dangerous commands', async () => {
      // First confirmation
      inquirer.prompt
        .mockResolvedValueOnce({ confirm: true })
        // Second confirmation
        .mockResolvedValueOnce({ doubleConfirm: true });

      exec.mockImplementation((cmd, opts, cb) => cb(null, { stdout: 'done', stderr: '' }));

      await executeCommand('Remove-Item -Path test');

      expect(inquirer.prompt).toHaveBeenCalledTimes(2);
      expect(exec).toHaveBeenCalledTimes(1);
    });

    it('should not execute dangerous command when second confirmation is declined', async () => {
      inquirer.prompt
        .mockResolvedValueOnce({ confirm: true })
        .mockResolvedValueOnce({ doubleConfirm: false });

      await executeCommand('Remove-Item test');

      expect(exec).not.toHaveBeenCalled();
    });
  });

  describe('handlePowerShellCommands', () => {
    it('should extract and process powershell blocks', async () => {
      inquirer.prompt.mockResolvedValue({ confirm: false });

      const response = 'Text\n```powershell\nGet-Process\n```\nMore text';
      await handlePowerShellCommands(response);

      // Should prompt for the powershell command
      expect(inquirer.prompt).toHaveBeenCalledTimes(1);
    });

    it('should process ps1 blocks too', async () => {
      inquirer.prompt.mockResolvedValue({ confirm: false });

      const response = '```ps1\nGet-Service\n```';
      await handlePowerShellCommands(response);

      expect(inquirer.prompt).toHaveBeenCalledTimes(1);
    });

    it('should not prompt for non-powershell blocks', async () => {
      const response = '```javascript\nconsole.log("hi")\n```';
      await handlePowerShellCommands(response);

      expect(inquirer.prompt).not.toHaveBeenCalled();
    });

    it('should handle response with no code blocks', async () => {
      await handlePowerShellCommands('Just plain text, no code blocks');
      expect(inquirer.prompt).not.toHaveBeenCalled();
    });

    it('should process multiple powershell blocks', async () => {
      inquirer.prompt.mockResolvedValue({ confirm: false });

      const response = '```powershell\nGet-Process\n```\n```powershell\nGet-Service\n```';
      await handlePowerShellCommands(response);

      expect(inquirer.prompt).toHaveBeenCalledTimes(2);
    });
  });
});
