import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

// Mock input.js (readConfirm)
vi.mock('../src/input.js', () => ({
  readConfirm: vi.fn(),
  readInput: vi.fn(),
  loadCommandHistory: vi.fn(),
  saveCommandHistory: vi.fn(),
}));

// Helper: tworzy mock ChildProcess ze streamami stdout/stderr
// Używa setTimeout(0) aby zdarzenia emitowały się PO podpięciu listenerów
function createMockChild(code = 0, stdoutData = '', stderrData = '') {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();

  setTimeout(() => {
    if (stdoutData) child.stdout.emit('data', stdoutData);
    if (stderrData) child.stderr.emit('data', stderrData);
    child.emit('close', code);
  }, 0);

  return child;
}

// Mock child_process - domyślna implementacja
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

import { readConfirm } from '../src/input.js';
import { exec } from 'child_process';
import { isDangerousCommand, executeCommand, handlePowerShellCommands, classifyError, truncateOutput, isFileModifyingCommand, formatResultsForFeedback } from '../src/executor.js';

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
      readConfirm.mockResolvedValueOnce(false);

      const result = await executeCommand('Get-Process');

      expect(exec).not.toHaveBeenCalled();
      expect(result.skipped).toBe(true);
    });

    it('should execute when user confirms safe command', async () => {
      readConfirm.mockResolvedValueOnce(true);
      exec.mockImplementationOnce(() => createMockChild(0, 'output', ''));

      const result = await executeCommand('Get-Process');

      expect(exec).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
      expect(result.stdout).toBe('output');
    });

    it('should capture stderr in real-time', async () => {
      readConfirm.mockResolvedValueOnce(true);
      exec.mockImplementationOnce(() => createMockChild(0, 'ok', 'warning'));

      const result = await executeCommand('Get-Process');

      expect(result.success).toBe(true);
      expect(result.stdout).toBe('ok');
      expect(result.stderr).toBe('warning');
    });

    it('should report failure on non-zero exit code', async () => {
      readConfirm.mockResolvedValueOnce(true);
      exec.mockImplementationOnce(() => createMockChild(1, '', 'error msg'));

      const result = await executeCommand('bad-command');

      expect(result.success).toBe(false);
      expect(result.error).toContain('1');
    });

    it('should require double confirmation for dangerous commands', async () => {
      readConfirm
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      exec.mockImplementationOnce(() => createMockChild(0, 'done', ''));

      const result = await executeCommand('Remove-Item -Path test');

      expect(readConfirm).toHaveBeenCalledTimes(2);
      expect(exec).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
    });

    it('should not execute dangerous command when second confirmation is declined', async () => {
      readConfirm
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const result = await executeCommand('Remove-Item test');

      expect(exec).not.toHaveBeenCalled();
      expect(result.skipped).toBe(true);
    });

    it('should auto-execute safe commands when autoExecute is true', async () => {
      exec.mockImplementationOnce(() => createMockChild(0, 'auto-output', ''));

      const result = await executeCommand('Get-Process', true);

      expect(readConfirm).not.toHaveBeenCalled();
      expect(exec).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
    });

    it('should require one confirmation for dangerous commands in autoExecute mode', async () => {
      readConfirm.mockResolvedValueOnce(true);
      exec.mockImplementationOnce(() => createMockChild(0, 'done', ''));

      const result = await executeCommand('Remove-Item test', true);

      expect(readConfirm).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
    });
  });

  describe('classifyError', () => {
    it('should classify path not found errors', () => {
      const result = classifyError('cannot find path', '', 'Get-Content missing.txt');
      expect(result.type).toBe('PATH_NOT_FOUND');
      expect(result.hint).toContain('Test-Path');
    });

    it('should classify command not found errors', () => {
      const result = classifyError('is not recognized as the name of a cmdlet', '', 'fakecmd');
      expect(result.type).toBe('COMMAND_NOT_FOUND');
    });

    it('should classify permission denied errors', () => {
      const result = classifyError('Access is denied', '', 'Remove-Item system32');
      expect(result.type).toBe('PERMISSION_DENIED');
    });

    it('should classify syntax errors', () => {
      const result = classifyError('unexpected token', '', 'bad {{ syntax');
      expect(result.type).toBe('SYNTAX_ERROR');
    });

    it('should classify timeout errors', () => {
      const result = classifyError('', 'Timeout po 30s', 'long-cmd');
      expect(result.type).toBe('TIMEOUT');
    });

    it('should classify invalid parameter errors', () => {
      const result = classifyError('A parameter cannot be found that matches', '', 'cmd -BadParam');
      expect(result.type).toBe('INVALID_PARAMETER');
    });

    it('should return UNKNOWN for unrecognized errors', () => {
      const result = classifyError('something weird happened', '', 'cmd');
      expect(result.type).toBe('UNKNOWN');
      expect(result.hint).toBeTruthy();
    });
  });

  describe('truncateOutput', () => {
    it('should return text unchanged when under maxLines', () => {
      const text = 'line1\nline2\nline3';
      expect(truncateOutput(text, 10)).toBe(text);
    });

    it('should truncate long output preserving head and tail', () => {
      const lines = Array.from({ length: 100 }, (_, i) => `line ${i}`);
      const text = lines.join('\n');
      const result = truncateOutput(text, 50);
      expect(result).toContain('line 0');
      expect(result).toContain('line 99');
      expect(result).toContain('pominięto');
    });

    it('should return empty string for empty input', () => {
      expect(truncateOutput('')).toBe('');
      expect(truncateOutput(null)).toBe('');
    });

    it('should use 60/40 split', () => {
      const lines = Array.from({ length: 100 }, (_, i) => `L${i}`);
      const result = truncateOutput(lines.join('\n'), 50);
      // 30 head lines (60% of 50), 20 tail lines (40% of 50)
      expect(result).toContain('L0');
      expect(result).toContain('L29');
      expect(result).toContain('L80');
      expect(result).toContain('L99');
    });
  });

  describe('isFileModifyingCommand', () => {
    it('should detect Out-File commands', () => {
      expect(isFileModifyingCommand('"test" | Out-File -FilePath "file.txt"')).toBe(true);
    });

    it('should detect Set-Content commands', () => {
      expect(isFileModifyingCommand('Set-Content -Path "file.txt" -Value "data"')).toBe(true);
    });

    it('should detect New-Item commands', () => {
      expect(isFileModifyingCommand('New-Item -ItemType File -Path "test.js"')).toBe(true);
    });

    it('should detect npm init', () => {
      expect(isFileModifyingCommand('npm init -y')).toBe(true);
    });

    it('should detect git clone', () => {
      expect(isFileModifyingCommand('git clone https://github.com/user/repo')).toBe(true);
    });

    it('should not flag read-only commands', () => {
      expect(isFileModifyingCommand('Get-Content file.txt')).toBe(false);
      expect(isFileModifyingCommand('Get-ChildItem')).toBe(false);
      expect(isFileModifyingCommand('Test-Path file.txt')).toBe(false);
    });
  });

  describe('formatResultsForFeedback', () => {
    it('should return null for empty results', () => {
      expect(formatResultsForFeedback([])).toBeNull();
      expect(formatResultsForFeedback(null)).toBeNull();
    });

    it('should return null when all commands were skipped', () => {
      expect(formatResultsForFeedback([{ skipped: true }])).toBeNull();
    });

    it('should format successful results with truncated output', () => {
      const results = [{
        command: 'Get-Process',
        success: true,
        stdout: 'process list here',
        stderr: '',
      }];
      const feedback = formatResultsForFeedback(results);
      expect(feedback).toContain('SUKCES');
      expect(feedback).toContain('Get-Process');
      expect(feedback).toContain('Katalog roboczy');
    });

    it('should format error results with classification and diagnostics', () => {
      const results = [{
        command: 'Get-Content missing.txt',
        success: false,
        stdout: '',
        stderr: 'cannot find path',
        error: 'Proces zakończony z kodem 1',
      }];
      const feedback = formatResultsForFeedback(results);
      expect(feedback).toContain('BŁĄD');
      expect(feedback).toContain('PATH_NOT_FOUND');
      expect(feedback).toContain('Diagnostyka');
      expect(feedback).toContain('NIE powtarzaj');
    });
  });

  describe('handlePowerShellCommands', () => {
    it('should extract and process powershell blocks', async () => {
      readConfirm.mockResolvedValue(false);

      const response = 'Text\n```powershell\nGet-Process\n```\nMore text';
      const results = await handlePowerShellCommands(response);

      expect(readConfirm).toHaveBeenCalledTimes(1);
      expect(results.length).toBe(1);
    });

    it('should process ps1 blocks too', async () => {
      readConfirm.mockResolvedValue(false);

      const response = '```ps1\nGet-Service\n```';
      const results = await handlePowerShellCommands(response);

      expect(readConfirm).toHaveBeenCalledTimes(1);
      expect(results.length).toBe(1);
    });

    it('should not prompt for non-powershell blocks', async () => {
      const response = '```javascript\nconsole.log("hi")\n```';
      const results = await handlePowerShellCommands(response);

      expect(readConfirm).not.toHaveBeenCalled();
      expect(results.length).toBe(0);
    });

    it('should handle response with no code blocks', async () => {
      const results = await handlePowerShellCommands('Just plain text, no code blocks');
      expect(readConfirm).not.toHaveBeenCalled();
      expect(results.length).toBe(0);
    });

    it('should stop after first failed command', async () => {
      readConfirm.mockResolvedValue(true);

      exec
        .mockImplementationOnce(() => createMockChild(1, '', 'error'))
        .mockImplementationOnce(() => createMockChild(0, 'ok', ''));

      const response = '```powershell\nbad-command\n```\n```powershell\nGet-Process\n```';
      const results = await handlePowerShellCommands(response);

      // Powinien wykonać tylko pierwszą komendę i zatrzymać się
      expect(exec).toHaveBeenCalledTimes(1);
      expect(results.length).toBe(1);
      expect(results[0].success).toBe(false);
    });

    it('should continue after skipped commands', async () => {
      readConfirm
        .mockResolvedValueOnce(false) // skip first
        .mockResolvedValueOnce(true); // confirm second

      exec.mockImplementationOnce(() => createMockChild(0, 'ok', ''));

      const response = '```powershell\ncmd1\n```\n```powershell\ncmd2\n```';
      const results = await handlePowerShellCommands(response);

      expect(results.length).toBe(2);
      expect(results[0].skipped).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should process all blocks when all succeed', async () => {
      readConfirm.mockResolvedValue(true);

      exec
        .mockImplementationOnce(() => createMockChild(0, 'out1', ''))
        .mockImplementationOnce(() => createMockChild(0, 'out2', ''));

      const response = '```powershell\ncmd1\n```\n```powershell\ncmd2\n```';
      const results = await handlePowerShellCommands(response);

      expect(exec).toHaveBeenCalledTimes(2);
      expect(results.length).toBe(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });
  });
});
