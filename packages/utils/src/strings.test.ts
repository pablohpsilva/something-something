import { describe, it, expect } from "vitest";
import {
  capitalize,
  capitalizeWords,
  toCamelCase,
  toPascalCase,
  toKebabCase,
  toSnakeCase,
  toConstantCase,
  truncate,
  truncateWords,
  normalizeWhitespace,
  removeWhitespace,
  padString,
  slugify,
  getInitials,
  countWords,
  countCharacters,
  reverse,
  isPalindrome,
  randomString,
  escapeHtml,
  unescapeHtml,
  extractEmailDomain,
  maskEmail,
  formatPhoneNumber,
  generateExcerpt,
} from "./strings";

describe("String utilities", () => {
  describe("capitalize", () => {
    it("should capitalize first letter", () => {
      expect(capitalize("hello")).toBe("Hello");
      expect(capitalize("world")).toBe("World");
    });

    it("should handle already capitalized strings", () => {
      expect(capitalize("Hello")).toBe("Hello");
      expect(capitalize("HELLO")).toBe("Hello");
    });

    it("should handle empty string", () => {
      expect(capitalize("")).toBe("");
    });

    it("should handle single character", () => {
      expect(capitalize("a")).toBe("A");
      expect(capitalize("A")).toBe("A");
    });

    it("should lowercase the rest", () => {
      expect(capitalize("hELLO")).toBe("Hello");
      expect(capitalize("WoRlD")).toBe("World");
    });

    it("should handle special characters", () => {
      expect(capitalize("123abc")).toBe("123abc");
      expect(capitalize("!hello")).toBe("!hello");
    });
  });

  describe("capitalizeWords", () => {
    it("should capitalize each word", () => {
      expect(capitalizeWords("hello world")).toBe("Hello World");
      expect(capitalizeWords("the quick brown fox")).toBe(
        "The Quick Brown Fox"
      );
    });

    it("should handle single word", () => {
      expect(capitalizeWords("hello")).toBe("Hello");
    });

    it("should handle empty string", () => {
      expect(capitalizeWords("")).toBe("");
    });

    it("should handle multiple spaces", () => {
      expect(capitalizeWords("hello  world")).toBe("Hello  World");
    });

    it("should handle special characters", () => {
      expect(capitalizeWords("hello-world_test")).toBe("Hello-World_Test");
      expect(capitalizeWords("a-b c-d")).toBe("A-B C-D");
    });

    it("should handle numbers", () => {
      expect(capitalizeWords("hello 123 world")).toBe("Hello 123 World");
    });
  });

  describe("toCamelCase", () => {
    it("should convert to camelCase", () => {
      expect(toCamelCase("hello world")).toBe("helloWorld");
      expect(toCamelCase("the quick brown fox")).toBe("theQuickBrownFox");
    });

    it("should handle PascalCase input", () => {
      expect(toCamelCase("HelloWorld")).toBe("helloWorld");
    });

    it("should handle kebab-case input", () => {
      expect(toCamelCase("hello-world-test")).toBe("helloWorldTest");
    });

    it("should handle snake_case input", () => {
      expect(toCamelCase("hello_world_test")).toBe("helloWorldTest");
    });

    it("should handle single word", () => {
      expect(toCamelCase("hello")).toBe("hello");
      expect(toCamelCase("Hello")).toBe("hello");
    });

    it("should handle empty string", () => {
      expect(toCamelCase("")).toBe("");
    });

    it("should remove spaces", () => {
      expect(toCamelCase("hello world test")).toBe("helloWorldTest");
    });
  });

  describe("toPascalCase", () => {
    it("should convert to PascalCase", () => {
      expect(toPascalCase("hello world")).toBe("HelloWorld");
      expect(toPascalCase("the quick brown fox")).toBe("TheQuickBrownFox");
    });

    it("should handle camelCase input", () => {
      expect(toPascalCase("helloWorld")).toBe("HelloWorld");
    });

    it("should handle kebab-case input", () => {
      expect(toPascalCase("hello-world-test")).toBe("HelloWorldTest");
    });

    it("should handle single word", () => {
      expect(toPascalCase("hello")).toBe("Hello");
    });

    it("should handle empty string", () => {
      expect(toPascalCase("")).toBe("");
    });

    it("should remove spaces", () => {
      expect(toPascalCase("hello world test")).toBe("HelloWorldTest");
    });
  });

  describe("toKebabCase", () => {
    it("should convert to kebab-case", () => {
      expect(toKebabCase("hello world")).toBe("hello-world");
      expect(toKebabCase("the quick brown fox")).toBe("the-quick-brown-fox");
    });

    it("should handle camelCase input", () => {
      expect(toKebabCase("helloWorld")).toBe("hello-world");
      expect(toKebabCase("theQuickBrownFox")).toBe("the-quick-brown-fox");
    });

    it("should handle PascalCase input", () => {
      expect(toKebabCase("HelloWorld")).toBe("hello-world");
    });

    it("should handle snake_case input", () => {
      expect(toKebabCase("hello_world")).toBe("hello-world");
    });

    it("should handle existing kebab-case", () => {
      expect(toKebabCase("hello-world")).toBe("hello-world");
    });

    it("should handle single word", () => {
      expect(toKebabCase("hello")).toBe("hello");
    });

    it("should handle empty string", () => {
      expect(toKebabCase("")).toBe("");
    });
  });

  describe("toSnakeCase", () => {
    it("should convert to snake_case", () => {
      expect(toSnakeCase("hello world")).toBe("hello_world");
      expect(toSnakeCase("the quick brown fox")).toBe("the_quick_brown_fox");
    });

    it("should handle camelCase input", () => {
      expect(toSnakeCase("helloWorld")).toBe("hello_world");
    });

    it("should handle PascalCase input", () => {
      expect(toSnakeCase("HelloWorld")).toBe("hello_world");
    });

    it("should handle kebab-case input", () => {
      expect(toSnakeCase("hello-world")).toBe("hello_world");
    });

    it("should handle existing snake_case", () => {
      expect(toSnakeCase("hello_world")).toBe("hello_world");
    });

    it("should handle single word", () => {
      expect(toSnakeCase("hello")).toBe("hello");
    });

    it("should handle empty string", () => {
      expect(toSnakeCase("")).toBe("");
    });
  });

  describe("toConstantCase", () => {
    it("should convert to CONSTANT_CASE", () => {
      expect(toConstantCase("hello world")).toBe("HELLO_WORLD");
      expect(toConstantCase("the quick brown fox")).toBe("THE_QUICK_BROWN_FOX");
    });

    it("should handle camelCase input", () => {
      expect(toConstantCase("helloWorld")).toBe("HELLO_WORLD");
    });

    it("should handle existing CONSTANT_CASE", () => {
      expect(toConstantCase("HELLO_WORLD")).toBe("HELLO_WORLD");
    });

    it("should handle mixed cases", () => {
      expect(toConstantCase("helloWorldTest")).toBe("HELLO_WORLD_TEST");
    });
  });

  describe("truncate", () => {
    it("should truncate long strings", () => {
      const longString = "This is a very long string that should be truncated";
      expect(truncate(longString, 20)).toBe("This is a very lo...");
    });

    it("should not truncate short strings", () => {
      expect(truncate("short", 10)).toBe("short");
    });

    it("should use custom suffix", () => {
      expect(truncate("hello world", 8, "---")).toBe("hello---");
    });

    it("should handle empty string", () => {
      expect(truncate("", 10)).toBe("");
    });

    it("should handle zero length", () => {
      expect(truncate("hello", 0)).toBe("...");
    });

    it("should handle length equal to string length", () => {
      expect(truncate("hello", 5)).toBe("hello");
    });

    it("should account for suffix length", () => {
      expect(truncate("hello world", 8)).toBe("hello...");
      expect(truncate("hello world", 8, "")).toBe("hello wo");
    });
  });

  describe("truncateWords", () => {
    it("should truncate by word count", () => {
      expect(truncateWords("one two three four five", 3)).toBe(
        "one two three..."
      );
    });

    it("should not truncate if within limit", () => {
      expect(truncateWords("one two three", 5)).toBe("one two three");
    });

    it("should use custom suffix", () => {
      expect(truncateWords("one two three four", 2, "---")).toBe("one two---");
    });

    it("should handle single word", () => {
      expect(truncateWords("hello", 1)).toBe("hello");
      expect(truncateWords("hello", 0)).toBe("...");
    });

    it("should handle empty string", () => {
      expect(truncateWords("", 3)).toBe("");
    });

    it("should handle multiple spaces", () => {
      expect(truncateWords("one  two   three", 2)).toBe("one two...");
    });
  });

  describe("normalizeWhitespace", () => {
    it("should normalize multiple spaces", () => {
      expect(normalizeWhitespace("hello    world")).toBe("hello world");
    });

    it("should normalize tabs and newlines", () => {
      expect(normalizeWhitespace("hello\t\nworld")).toBe("hello world");
    });

    it("should trim leading and trailing whitespace", () => {
      expect(normalizeWhitespace("  hello world  ")).toBe("hello world");
    });

    it("should handle empty string", () => {
      expect(normalizeWhitespace("")).toBe("");
    });

    it("should handle only whitespace", () => {
      expect(normalizeWhitespace("   \t\n   ")).toBe("");
    });

    it("should preserve single spaces", () => {
      expect(normalizeWhitespace("hello world")).toBe("hello world");
    });
  });

  describe("removeWhitespace", () => {
    it("should remove all whitespace", () => {
      expect(removeWhitespace("hello world")).toBe("helloworld");
    });

    it("should remove tabs and newlines", () => {
      expect(removeWhitespace("hello\t\nworld")).toBe("helloworld");
    });

    it("should handle empty string", () => {
      expect(removeWhitespace("")).toBe("");
    });

    it("should handle only whitespace", () => {
      expect(removeWhitespace("   \t\n   ")).toBe("");
    });
  });

  describe("padString", () => {
    it("should pad right by default", () => {
      expect(padString("hello", 10)).toBe("hello     ");
    });

    it("should pad left when specified", () => {
      expect(padString("hello", 10, " ", true)).toBe("     hello");
    });

    it("should use custom padding character", () => {
      expect(padString("hello", 10, "*")).toBe("hello*****");
    });

    it("should not pad if string is already long enough", () => {
      expect(padString("hello", 5)).toBe("hello");
      expect(padString("hello world", 5)).toBe("hello world");
    });

    it("should handle empty string", () => {
      expect(padString("", 5)).toBe("     ");
    });

    it("should handle zero length", () => {
      expect(padString("hello", 0)).toBe("hello");
    });
  });

  describe("slugify", () => {
    it("should create slug from string", () => {
      expect(slugify("Hello World")).toBe("hello-world");
    });

    it("should remove special characters", () => {
      expect(slugify("Hello! @#$ World?")).toBe("hello-world");
    });

    it("should handle multiple spaces", () => {
      expect(slugify("hello    world")).toBe("hello-world");
    });

    it("should handle underscores", () => {
      expect(slugify("hello_world_test")).toBe("hello-world-test");
    });

    it("should trim hyphens", () => {
      expect(slugify("-hello world-")).toBe("hello-world");
    });

    it("should handle empty string", () => {
      expect(slugify("")).toBe("");
    });

    it("should handle only special characters", () => {
      expect(slugify("!@#$%^&*()")).toBe("");
    });

    it("should handle mixed content", () => {
      expect(slugify("The Quick! Brown Fox (2023)")).toBe(
        "the-quick-brown-fox-2023"
      );
    });
  });

  describe("getInitials", () => {
    it("should get initials from name", () => {
      expect(getInitials("John Doe")).toBe("JD");
    });

    it("should handle single name", () => {
      expect(getInitials("John")).toBe("J");
    });

    it("should handle multiple names", () => {
      expect(getInitials("John Michael Doe")).toBe("JM");
    });

    it("should respect maxInitials parameter", () => {
      expect(getInitials("John Michael Doe Smith", 3)).toBe("JMD");
      expect(getInitials("John Michael Doe Smith", 1)).toBe("J");
    });

    it("should handle empty string", () => {
      expect(getInitials("")).toBe("");
    });

    it("should handle extra spaces", () => {
      expect(getInitials("  John   Doe  ")).toBe("JD");
    });

    it("should uppercase initials", () => {
      expect(getInitials("john doe")).toBe("JD");
    });
  });

  describe("countWords", () => {
    it("should count words correctly", () => {
      expect(countWords("hello world")).toBe(2);
      expect(countWords("the quick brown fox")).toBe(4);
    });

    it("should handle single word", () => {
      expect(countWords("hello")).toBe(1);
    });

    it("should handle empty string", () => {
      expect(countWords("")).toBe(0);
    });

    it("should handle multiple spaces", () => {
      expect(countWords("hello    world")).toBe(2);
    });

    it("should handle leading/trailing spaces", () => {
      expect(countWords("  hello world  ")).toBe(2);
    });

    it("should handle only spaces", () => {
      expect(countWords("    ")).toBe(0);
    });
  });

  describe("countCharacters", () => {
    it("should count characters including spaces by default", () => {
      expect(countCharacters("hello world")).toBe(11);
    });

    it("should count characters excluding spaces when specified", () => {
      expect(countCharacters("hello world", false)).toBe(10);
    });

    it("should handle empty string", () => {
      expect(countCharacters("")).toBe(0);
      expect(countCharacters("", false)).toBe(0);
    });

    it("should handle only spaces", () => {
      expect(countCharacters("   ")).toBe(3);
      expect(countCharacters("   ", false)).toBe(0);
    });

    it("should handle special characters", () => {
      expect(countCharacters("hello! world?")).toBe(13);
      expect(countCharacters("hello! world?", false)).toBe(12);
    });
  });

  describe("reverse", () => {
    it("should reverse string", () => {
      expect(reverse("hello")).toBe("olleh");
      expect(reverse("world")).toBe("dlrow");
    });

    it("should handle empty string", () => {
      expect(reverse("")).toBe("");
    });

    it("should handle single character", () => {
      expect(reverse("a")).toBe("a");
    });

    it("should handle palindromes", () => {
      expect(reverse("racecar")).toBe("racecar");
    });

    it("should handle special characters", () => {
      expect(reverse("hello!")).toBe("!olleh");
    });
  });

  describe("isPalindrome", () => {
    it("should detect palindromes", () => {
      expect(isPalindrome("racecar")).toBe(true);
      expect(isPalindrome("A man a plan a canal Panama")).toBe(true);
    });

    it("should detect non-palindromes", () => {
      expect(isPalindrome("hello")).toBe(false);
      expect(isPalindrome("world")).toBe(false);
    });

    it("should ignore case and punctuation", () => {
      expect(isPalindrome("Racecar")).toBe(true);
      expect(isPalindrome("race a car")).toBe(false); // This is not a palindrome
      expect(isPalindrome("race car")).toBe(false);
    });

    it("should handle empty string", () => {
      expect(isPalindrome("")).toBe(true);
    });

    it("should handle single character", () => {
      expect(isPalindrome("a")).toBe(true);
    });

    it("should handle numbers", () => {
      expect(isPalindrome("12321")).toBe(true);
      expect(isPalindrome("12345")).toBe(false);
    });
  });

  describe("randomString", () => {
    it("should generate string of correct length", () => {
      expect(randomString(10)).toHaveLength(10);
      expect(randomString(5)).toHaveLength(5);
    });

    it("should use default charset", () => {
      const str = randomString(100);
      expect(str).toMatch(/^[A-Za-z0-9]+$/);
    });

    it("should use custom charset", () => {
      const str = randomString(10, "abc");
      expect(str).toMatch(/^[abc]+$/);
    });

    it("should generate different strings", () => {
      const str1 = randomString(20);
      const str2 = randomString(20);
      expect(str1).not.toBe(str2);
    });

    it("should handle empty charset", () => {
      const str = randomString(5, "");
      expect(str).toBe(""); // Would be empty due to no characters to choose from
    });

    it("should handle zero length", () => {
      expect(randomString(0)).toBe("");
    });
  });

  describe("escapeHtml", () => {
    it("should escape HTML characters", () => {
      expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
      expect(escapeHtml("Hello & goodbye")).toBe("Hello &amp; goodbye");
    });

    it("should escape quotes", () => {
      expect(escapeHtml('Say "hello"')).toBe("Say &quot;hello&quot;");
      expect(escapeHtml("Say 'hello'")).toBe("Say &#x27;hello&#x27;");
    });

    it("should escape slashes", () => {
      expect(escapeHtml("</script>")).toBe("&lt;&#x2F;script&gt;");
    });

    it("should handle empty string", () => {
      expect(escapeHtml("")).toBe("");
    });

    it("should handle string without HTML", () => {
      expect(escapeHtml("hello world")).toBe("hello world");
    });

    it("should escape all dangerous characters", () => {
      expect(escapeHtml("<>&\"'/")).toBe("&lt;&gt;&amp;&quot;&#x27;&#x2F;");
    });
  });

  describe("unescapeHtml", () => {
    it("should unescape HTML entities", () => {
      expect(unescapeHtml("&lt;script&gt;")).toBe("<script>");
      expect(unescapeHtml("Hello &amp; goodbye")).toBe("Hello & goodbye");
    });

    it("should unescape quotes", () => {
      expect(unescapeHtml("Say &quot;hello&quot;")).toBe('Say "hello"');
      expect(unescapeHtml("Say &#x27;hello&#x27;")).toBe("Say 'hello'");
    });

    it("should unescape slashes", () => {
      expect(unescapeHtml("&lt;&#x2F;script&gt;")).toBe("</script>");
    });

    it("should handle empty string", () => {
      expect(unescapeHtml("")).toBe("");
    });

    it("should handle string without entities", () => {
      expect(unescapeHtml("hello world")).toBe("hello world");
    });

    it("should be inverse of escapeHtml", () => {
      const original = '<script>alert("Hello & goodbye");</script>';
      const escaped = escapeHtml(original);
      const unescaped = unescapeHtml(escaped);
      expect(unescaped).toBe(original);
    });
  });

  describe("extractEmailDomain", () => {
    it("should extract domain from email", () => {
      expect(extractEmailDomain("user@example.com")).toBe("example.com");
      expect(extractEmailDomain("test@gmail.com")).toBe("gmail.com");
    });

    it("should handle subdomains", () => {
      expect(extractEmailDomain("user@mail.google.com")).toBe(
        "mail.google.com"
      );
    });

    it("should handle invalid emails", () => {
      expect(extractEmailDomain("invalid-email")).toBe("");
      expect(extractEmailDomain("user@")).toBe("");
      expect(extractEmailDomain("@domain.com")).toBe("domain.com");
    });

    it("should handle empty string", () => {
      expect(extractEmailDomain("")).toBe("");
    });

    it("should handle multiple @ symbols", () => {
      expect(extractEmailDomain("user@@domain.com")).toBe("@domain.com");
    });
  });

  describe("maskEmail", () => {
    it("should mask email username", () => {
      expect(maskEmail("user@example.com")).toBe("u**r@example.com");
      expect(maskEmail("test@gmail.com")).toBe("t**t@gmail.com");
    });

    it("should handle short usernames", () => {
      expect(maskEmail("ab@example.com")).toBe("**@example.com");
      expect(maskEmail("a@example.com")).toBe("*@example.com");
    });

    it("should handle long usernames", () => {
      expect(maskEmail("verylongusername@example.com")).toBe(
        "v**************e@example.com"
      );
    });

    it("should handle invalid emails", () => {
      expect(maskEmail("invalid-email")).toBe("invalid-email");
      expect(maskEmail("")).toBe("");
    });

    it("should preserve domain", () => {
      expect(maskEmail("user@subdomain.example.com")).toBe(
        "u**r@subdomain.example.com"
      );
    });
  });

  describe("formatPhoneNumber", () => {
    it("should format US 10-digit number", () => {
      expect(formatPhoneNumber("1234567890")).toBe("(123) 456-7890");
    });

    it("should format US 11-digit number", () => {
      expect(formatPhoneNumber("11234567890")).toBe("+1 (123) 456-7890");
    });

    it("should handle numbers with existing formatting", () => {
      expect(formatPhoneNumber("(123) 456-7890")).toBe("(123) 456-7890");
      expect(formatPhoneNumber("123-456-7890")).toBe("(123) 456-7890");
    });

    it("should return original for invalid lengths", () => {
      expect(formatPhoneNumber("123")).toBe("123");
      expect(formatPhoneNumber("123456789012")).toBe("123456789012");
    });

    it("should handle international format", () => {
      expect(formatPhoneNumber("1234567890", "international")).toBe(
        "(123) 456-7890"
      );
    });

    it("should handle empty string", () => {
      expect(formatPhoneNumber("")).toBe("");
    });

    it("should remove non-digits", () => {
      expect(formatPhoneNumber("abc123def456ghi7890")).toBe("(123) 456-7890");
    });
  });

  describe("generateExcerpt", () => {
    it("should return full text if within limit", () => {
      const text = "Short text.";
      expect(generateExcerpt(text, 150)).toBe(text);
    });

    it("should break at sentence boundary", () => {
      const text = "First sentence. Second sentence. Third sentence.";
      const excerpt = generateExcerpt(text, 30);
      expect(excerpt).toBe("First sentence. Second sentence.");
    });

    it("should use default max length", () => {
      const longText = "a".repeat(200);
      const excerpt = generateExcerpt(longText);
      expect(excerpt.length).toBeLessThanOrEqual(153); // 150 + "..."
    });

    it("should fallback to word boundary if no sentence boundary", () => {
      const text =
        "This is a very long text without any sentence endings that should be truncated";
      const excerpt = generateExcerpt(text, 30);
      expect(excerpt.length).toBeLessThanOrEqual(33); // 30 + "..."
      expect(excerpt.endsWith("...")).toBe(true);
    });

    it("should handle text with only one sentence", () => {
      const text = "This is one long sentence without any breaks at all.";
      const excerpt = generateExcerpt(text, 20);
      expect(excerpt).toBe("This is one long...");
    });

    it("should handle empty string", () => {
      expect(generateExcerpt("")).toBe("");
    });

    it("should handle text with multiple sentence endings", () => {
      const text = "First! Second? Third. Fourth sentence.";
      const excerpt = generateExcerpt(text, 25);
      expect(excerpt).toBe("First! Second? Third.");
    });

    it("should trim whitespace", () => {
      const text = "First sentence.   Second sentence.";
      const excerpt = generateExcerpt(text, 20);
      expect(excerpt).toBe("First sentence.");
    });
  });

  describe("Integration and edge cases", () => {
    it("should handle case conversion chain", () => {
      const original = "Hello World Test";

      const camel = toCamelCase(original);
      const pascal = toPascalCase(camel);
      const kebab = toKebabCase(pascal);
      const snake = toSnakeCase(kebab);
      const constant = toConstantCase(snake);

      expect(camel).toBe("helloWorldTest");
      expect(pascal).toBe("HelloWorldTest");
      expect(kebab).toBe("hello-world-test");
      expect(snake).toBe("hello_world_test");
      expect(constant).toBe("HELLO_WORLD_TEST");
    });

    it("should handle unicode characters", () => {
      expect(capitalize("üñíçødé")).toBe("Üñíçødé");
      expect(slugify("café münü")).toBe("caf-mn");
      expect(reverse("café")).toBe("éfac");
    });

    it("should handle very long strings", () => {
      const veryLong = "a".repeat(10000);

      expect(reverse(veryLong)).toHaveLength(10000);
      expect(truncate(veryLong, 100)).toHaveLength(103); // 100 + "..."
      expect(countCharacters(veryLong)).toBe(10000);
    });

    it("should handle null-like values gracefully", () => {
      // These should be handled by TypeScript, but testing runtime behavior
      expect(capitalize("" as any)).toBe("");
      expect(slugify("" as any)).toBe("");
      expect(countWords("" as any)).toBe(0);
    });

    it("should maintain consistency in text processing", () => {
      const text = "The Quick Brown Fox Jumps!";

      const normalized = normalizeWhitespace(text);
      const slug = slugify(normalized);
      const words = countWords(normalized);

      expect(normalized).toBe("The Quick Brown Fox Jumps!");
      expect(slug).toBe("the-quick-brown-fox-jumps");
      expect(words).toBe(5);
    });

    it("should handle HTML and email processing", () => {
      const htmlEmail = '<script>alert("user@evil.com")</script>';
      const escaped = escapeHtml(htmlEmail);
      const domain = extractEmailDomain(htmlEmail);

      expect(escaped).toBe(
        "&lt;script&gt;alert(&quot;user@evil.com&quot;)&lt;&#x2F;script&gt;"
      );
      expect(domain).toBe("evil.com");
    });
  });
});
