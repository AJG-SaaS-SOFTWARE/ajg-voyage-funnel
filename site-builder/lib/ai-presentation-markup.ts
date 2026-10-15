// Stateless checks: every visible field must be checked independently.
const markdownMarkup = /(?:\*\*[^*\n]+\*\*|__[^_\n]+__|(?:^|\n)\s{0,3}#{1,6}\s+\S|```|!?\[[^\]\n]+\]\([^)\n]+\))/u;

// A real tag must end or have whitespace after its name. A word boundary alone
// also matches ordinary contact text such as <a@example.com>.
const htmlMarkup = /<\/?(?:strong|em|b|i|h[1-6]|p|a|ul|ol|li|div|span|br|hr|blockquote|code|pre|table|thead|tbody|tr|th|td|img|video|audio|iframe|script|style)(?:\s+[^<>]*?)?\s*\/?>/iu;

export function hasMarkdownMarkup(text: string) {
  return markdownMarkup.test(text);
}

export function hasHtmlMarkup(text: string) {
  return htmlMarkup.test(text);
}
