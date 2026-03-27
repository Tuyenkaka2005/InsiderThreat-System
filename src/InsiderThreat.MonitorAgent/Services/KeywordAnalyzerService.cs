using System.Text.RegularExpressions;
using InsiderThreat.MonitorAgent.Models;

namespace InsiderThreat.MonitorAgent.Services;

/// <summary>
/// Analyzes text buffers for sensitive Vietnamese keywords and phrases.
/// Produces a risk severity score from 1 (low) to 10 (critical) based on:
/// - Which keyword was detected
/// - The surrounding context (amplify patterns)
/// - Combination of multiple keywords in the same message
/// </summary>
public class KeywordAnalyzerService
{
    private readonly ILogger<KeywordAnalyzerService> _logger;
    private readonly List<KeywordRule> _rules;

    public KeywordAnalyzerService(ILogger<KeywordAnalyzerService> logger)
    {
        _logger = logger;
        _rules = BuildDefaultRules();
    }

    /// <summary>
    /// Analyze a piece of text for sensitive keywords.
    /// Returns a list of detected alerts with severity scores.
    /// </summary>
    public List<KeywordAlert> Analyze(string text, string windowTitle, string appName)
    {
        var alerts = new List<KeywordAlert>();
        if (string.IsNullOrWhiteSpace(text)) return alerts;

        // Normalize text: strip Telex/VNI modifiers for matching
        var normalizedText = NormalizeForMatching(text);
        _logger.LogDebug("Keyword analysis: Original='{Original}', Normalized='{Normalized}'",
            text.Length > 50 ? text[..50] : text,
            normalizedText.Length > 50 ? normalizedText[..50] : normalizedText);

        foreach (var rule in _rules)
        {
            var normalizedKeyword = NormalizeForMatching(rule.Keyword);
            
            // Check both original text and normalized text
            bool matched = false;

            // 1. Direct match on original text (works for Vietnamese with accents)
            string regexPattern = $@"(?<!\w){System.Text.RegularExpressions.Regex.Escape(rule.Keyword)}(?!\w)";
            var regex = new System.Text.RegularExpressions.Regex(regexPattern, 
                System.Text.RegularExpressions.RegexOptions.IgnoreCase | 
                System.Text.RegularExpressions.RegexOptions.CultureInvariant);
            if (regex.IsMatch(text)) matched = true;

            // 2. Normalized match (works for Telex raw keystrokes)
            if (!matched && normalizedKeyword.Length >= 2)
            {
                string normRegex = $@"(?<!\w){System.Text.RegularExpressions.Regex.Escape(normalizedKeyword)}(?!\w)";
                var normRe = new System.Text.RegularExpressions.Regex(normRegex, 
                    System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                if (normRe.IsMatch(normalizedText)) matched = true;
            }

            // 3. Simple substring match on normalized text
            if (!matched && normalizedKeyword.Length >= 3)
            {
                if (normalizedText.Contains(normalizedKeyword, StringComparison.OrdinalIgnoreCase))
                    matched = true;
            }

            // 4. Direct substring match on original text (ultimate fallback)
            if (!matched && rule.Keyword.Length >= 2)
            {
                if (text.Contains(rule.Keyword, StringComparison.OrdinalIgnoreCase))
                    matched = true;
            }

            if (matched)
            {
                int severity = rule.BaseSeverity;
                var matchedAmplifiers = new List<string>();

                // Special case for TEST_ALERT: always make it critical
                if (rule.Keyword.Equals("TEST_ALERT", StringComparison.OrdinalIgnoreCase))
                {
                    severity = 10;
                }
                else
                {
                    // Check for amplifying context patterns
                    if (rule.AmplifyPatterns != null)
                    {
                        foreach (var amp in rule.AmplifyPatterns)
                        {
                            var normAmp = NormalizeForMatching(amp);
                            if (normalizedText.Contains(normAmp, StringComparison.OrdinalIgnoreCase) ||
                                text.Contains(amp, StringComparison.OrdinalIgnoreCase))
                            {
                                severity += rule.AmplifyBonus;
                                matchedAmplifiers.Add(amp);
                            }
                        }
                    }

                    // Bonus severity if sending to external apps (Zalo, Telegram, etc.)
                    var externalApps = new[] { "zalo", "telegram", "messenger", "whatsapp", "viber", "skype" };
                    if (externalApps.Any(app => appName.ToLowerInvariant().Contains(app) || 
                                                windowTitle.ToLowerInvariant().Contains(app)))
                    {
                        severity += 2;
                    }
                }

                // Cap severity at 10
                severity = Math.Min(severity, 10);

                // Build risk assessment description
                string riskAssessment = BuildRiskAssessment(rule, severity, matchedAmplifiers, appName);

                alerts.Add(new KeywordAlert
                {
                    Keyword = rule.Keyword,
                    Category = rule.Category,
                    Severity = severity,
                    MatchedText = ExtractContext(text, rule.Keyword, 80),
                    RiskAssessment = riskAssessment
                });

                _logger.LogWarning(
                    "⚠ Keyword detected: [{Keyword}] | Severity: {Severity}/10 | App: {App} | Window: {Window}",
                    rule.Keyword, severity, appName, windowTitle);
            }
        }

        return alerts;
    }

    /// <summary>
    /// Normalize text by stripping Telex/VNI tone modifiers for matching.
    /// Telex: s=sắc, f=huyền, r=hỏi, x=ngã, j=nặng
    /// Also handles: aa=â, aw=ă, ee=ê, oo=ô, ow=ơ, uw=ư, dd=đ
    /// </summary>
    private static string NormalizeForMatching(string input)
    {
        if (string.IsNullOrEmpty(input)) return input;

        var result = input.ToLowerInvariant();

        // Remove Vietnamese diacritics (convert accented chars to base)
        result = result
            .Replace("à", "a").Replace("á", "a").Replace("ả", "a").Replace("ã", "a").Replace("ạ", "a")
            .Replace("ă", "a").Replace("ắ", "a").Replace("ằ", "a").Replace("ẳ", "a").Replace("ẵ", "a").Replace("ặ", "a")
            .Replace("â", "a").Replace("ấ", "a").Replace("ầ", "a").Replace("ẩ", "a").Replace("ẫ", "a").Replace("ậ", "a")
            .Replace("è", "e").Replace("é", "e").Replace("ẻ", "e").Replace("ẽ", "e").Replace("ẹ", "e")
            .Replace("ê", "e").Replace("ế", "e").Replace("ề", "e").Replace("ể", "e").Replace("ễ", "e").Replace("ệ", "e")
            .Replace("ì", "i").Replace("í", "i").Replace("ỉ", "i").Replace("ĩ", "i").Replace("ị", "i")
            .Replace("ò", "o").Replace("ó", "o").Replace("ỏ", "o").Replace("õ", "o").Replace("ọ", "o")
            .Replace("ô", "o").Replace("ố", "o").Replace("ồ", "o").Replace("ổ", "o").Replace("ỗ", "o").Replace("ộ", "o")
            .Replace("ơ", "o").Replace("ớ", "o").Replace("ờ", "o").Replace("ở", "o").Replace("ỡ", "o").Replace("ợ", "o")
            .Replace("ù", "u").Replace("ú", "u").Replace("ủ", "u").Replace("ũ", "u").Replace("ụ", "u")
            .Replace("ư", "u").Replace("ứ", "u").Replace("ừ", "u").Replace("ử", "u").Replace("ữ", "u").Replace("ự", "u")
            .Replace("ỳ", "y").Replace("ý", "y").Replace("ỷ", "y").Replace("ỹ", "y").Replace("ỵ", "y")
            .Replace("đ", "d");

        // Strip Telex tone marks at word boundaries (s, f, r, x, j after vowels)
        // This handles raw Telex keyboard buffer like "nghir" → "nghi", "viecj" → "viec"
        result = System.Text.RegularExpressions.Regex.Replace(result, @"([aeiouy])([sfrxj])(?=\s|$|[^a-z])", "$1");

        // Handle doubled chars from Telex: aa→a, ee→e, oo→o, dd→d
        result = System.Text.RegularExpressions.Regex.Replace(result, @"([aeioud])\1", "$1");

        // Handle aw→a, ow→o, uw→u
        result = result.Replace("aw", "a").Replace("ow", "o").Replace("uw", "u");

        return result;
    }

    /// <summary>
    /// Extract the context around a keyword match (±N characters).
    /// </summary>
    private static string ExtractContext(string text, string keyword, int contextChars)
    {
        var idx = text.IndexOf(keyword, StringComparison.OrdinalIgnoreCase);
        if (idx < 0) return text.Length > 200 ? text[..200] + "..." : text;

        int start = Math.Max(0, idx - contextChars);
        int end = Math.Min(text.Length, idx + keyword.Length + contextChars);
        var context = text[start..end];

        if (start > 0) context = "..." + context;
        if (end < text.Length) context += "...";

        return context;
    }

    /// <summary>
    /// Build a human-readable risk assessment in Vietnamese.
    /// </summary>
    private static string BuildRiskAssessment(KeywordRule rule, int severity, List<string> amplifiers, string appName)
    {
        string level = severity switch
        {
            >= 9 => "CỰC KỲ NGUY HIỂM",
            >= 7 => "NGUY HIỂM CAO",
            >= 5 => "CẢNH BÁO",
            >= 3 => "CHÚ Ý",
            _ => "THẤP"
        };

        var sb = new System.Text.StringBuilder();
        sb.Append($"[{level}] Phát hiện từ khóa nhạy cảm \"{rule.Keyword}\" (Danh mục: {rule.Category}). ");

        if (amplifiers.Count > 0)
            sb.Append($"Ngữ cảnh tăng nặng: {string.Join(", ", amplifiers)}. ");

        if (severity >= 7)
            sb.Append("Có dấu hiệu rò rỉ thông tin hoặc ý định nghỉ việc. Cần kiểm tra ngay. ");
        else if (severity >= 5)
            sb.Append("Cần theo dõi thêm hành vi của nhân viên này. ");

        sb.Append($"Ứng dụng: {appName}.");

        return sb.ToString();
    }

    /// <summary>
    /// Build the default keyword ruleset.
    /// Each rule has a base severity and optional amplification patterns.
    /// </summary>
    private static List<KeywordRule> BuildDefaultRules()
    {
        return new List<KeywordRule>
        {
            // === LƯƠNG THƯỞNG & NGHỈ VIỆC ===
            new()
            {
                Keyword = "lương",
                Category = "Lương thưởng",
                BaseSeverity = 3,
                AmplifyPatterns = new[] { "bao nhiêu", "công ty khác", "offer", "cao hơn", "thấp quá", "chuyển", "nhảy" },
                AmplifyBonus = 2
            },
            new()
            {
                Keyword = "thưởng",
                Category = "Lương thưởng",
                BaseSeverity = 3,
                AmplifyPatterns = new[] { "bao nhiêu", "ít quá", "công ty khác", "so sánh" },
                AmplifyBonus = 2
            },
            new()
            {
                Keyword = "nghỉ việc",
                Category = "Nghỉ việc",
                BaseSeverity = 6,
                AmplifyPatterns = new[] { "quyết định", "chắc chắn", "tuần sau", "tháng sau", "nộp đơn", "thôi việc" },
                AmplifyBonus = 2
            },
            new()
            {
                Keyword = "nghi viec",
                Category = "Nghỉ việc",
                BaseSeverity = 6,
                AmplifyPatterns = new[] { "quyet dinh", "chac chan", "tuan sau", "thang sau", "nop don", "thoi viec" },
                AmplifyBonus = 2
            },
            new()
            {
                Keyword = "tìm việc",
                Category = "Nghỉ việc",
                BaseSeverity = 5,
                AmplifyPatterns = new[] { "cv", "phỏng vấn", "offer", "linkedin", "headhunter" },
                AmplifyBonus = 2
            },
            new()
            {
                Keyword = "nhảy việc",
                Category = "Nghỉ việc",
                BaseSeverity = 7,
                AmplifyPatterns = new[] { "rồi", "quyết", "công ty mới", "offer" },
                AmplifyBonus = 2
            },

            // === DỮ LIỆU DỰ ÁN ===
            new()
            {
                Keyword = "hợp đồng dự án",
                Category = "Dữ liệu dự án",
                BaseSeverity = 5,
                AmplifyPatterns = new[] { "gửi", "copy", "chụp", "sao chép", "download", "bên ngoài", "đối tác" },
                AmplifyBonus = 3
            },
            new()
            {
                Keyword = "mã nguồn",
                Category = "Dữ liệu dự án",
                BaseSeverity = 6,
                AmplifyPatterns = new[] { "gửi", "copy", "github", "drive", "upload", "bên ngoài" },
                AmplifyBonus = 3
            },
            new()
            {
                Keyword = "khách hàng",
                Category = "Dữ liệu dự án",
                BaseSeverity = 4,
                AmplifyPatterns = new[] { "danh sách", "thông tin", "email", "số điện thoại", "gửi cho", "bên ngoài" },
                AmplifyBonus = 3
            },

            // === AN NINH ===
            new()
            {
                Keyword = "mật khẩu",
                Category = "An ninh",
                BaseSeverity = 7,
                AmplifyPatterns = new[] { "gửi", "cho tôi", "là gì", "công ty", "server", "admin", "root" },
                AmplifyBonus = 2
            },
            new()
            {
                Keyword = "password",
                Category = "An ninh",
                BaseSeverity = 7,
                AmplifyPatterns = new[] { "send", "give", "share", "company", "server", "admin", "root", "database" },
                AmplifyBonus = 2
            },
            new()
            {
                Keyword = "token",
                Category = "An ninh",
                BaseSeverity = 6,
                AmplifyPatterns = new[] { "api", "access", "bearer", "key", "secret", "gửi" },
                AmplifyBonus = 2
            },
            new()
            {
                Keyword = "database",
                Category = "An ninh",
                BaseSeverity = 5,
                AmplifyPatterns = new[] { "connection string", "password", "credential", "export", "dump", "backup" },
                AmplifyBonus = 3
            },

            // === CÁC TỪ KHÓA BỔ SUNG ===
            new()
            {
                Keyword = "bí mật",
                Category = "An ninh",
                BaseSeverity = 5,
                AmplifyPatterns = new[] { "công ty", "dự án", "nội bộ", "không được nói", "giữ kín" },
                AmplifyBonus = 3
            },
            new()
            {
                Keyword = "rò rỉ",
                Category = "An ninh",
                BaseSeverity = 7,
                AmplifyPatterns = new[] { "thông tin", "dữ liệu", "tài liệu", "mật" },
                AmplifyBonus = 2
            },
            new()
            {
                Keyword = "cv",
                Category = "Nghỉ việc",
                BaseSeverity = 4,
                AmplifyPatterns = new[] { "gửi", "cập nhật", "linkedin", "apply", "ứng tuyển" },
                AmplifyBonus = 2
            },
            new()
            {
                Keyword = "công việc",
                Category = "Nghỉ việc",
                BaseSeverity = 3,
                AmplifyPatterns = new[] { "mới", "khác", "tốt hơn", "phỏng vấn", "thử sức" },
                AmplifyBonus = 2
            },
            new()
            {
                Keyword = "việc làm",
                Category = "Nghỉ việc",
                BaseSeverity = 3,
                AmplifyPatterns = new[] { "mới", "tìm", "tuyển dụng", "nhanh" },
                AmplifyBonus = 2
            },
            new()
            {
                Keyword = "tuyển dụng",
                Category = "Nghỉ việc",
                BaseSeverity = 4,
                AmplifyPatterns = new[] { "tin", "thông tin", "vị trí", "apply" },
                AmplifyBonus = 2
            },
            new()
            {
                Keyword = "phỏng vấn",
                Category = "Nghỉ việc",
                BaseSeverity = 5,
                AmplifyPatterns = new[] { "ngày mai", "sắp tới", "kết quả", "đậu", "trượt" },
                AmplifyBonus = 2
            },
            new()
            {
                Keyword = "headhunter",
                Category = "Nghỉ việc",
                BaseSeverity = 5,
                AmplifyPatterns = new[] { "gọi", "liên hệ", "linkedin", "offer" },
                AmplifyBonus = 2
            },
            // === TEST KEYWORD ===
            new()
            {
                Keyword = "TEST_ALERT",
                Category = "Hệ thống",
                BaseSeverity = 1, // Will be forced to 10 in Analyze method
                AmplifyPatterns = Array.Empty<string>(),
                AmplifyBonus = 0
            }
        };
    }
}

/// <summary>
/// Represents a keyword alert produced by the analyzer.
/// </summary>
public class KeywordAlert
{
    public string Keyword { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public int Severity { get; set; }
    public string MatchedText { get; set; } = string.Empty;
    public string RiskAssessment { get; set; } = string.Empty;
}
