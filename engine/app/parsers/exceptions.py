class ParseError(Exception): pass
class EmptyPDFError(ParseError): pass
class ImageOnlyPDFError(ParseError): pass
class FileSizeError(ParseError): pass
class PageLimitError(ParseError): pass
class LLMError(Exception): pass
