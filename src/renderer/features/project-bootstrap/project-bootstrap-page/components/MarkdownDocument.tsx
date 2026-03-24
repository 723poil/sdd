import { Fragment } from 'react';

interface MarkdownDocumentProps {
  markdown: string;
}

interface MarkdownHeadingBlock {
  type: 'heading';
  depth: number;
  text: string;
}

interface MarkdownParagraphBlock {
  type: 'paragraph';
  text: string;
}

interface MarkdownListBlock {
  type: 'list';
  items: string[];
  ordered: boolean;
}

interface MarkdownCodeBlock {
  type: 'code';
  code: string;
  language: string | null;
}

interface MarkdownBlockquoteBlock {
  type: 'blockquote';
  text: string;
}

type MarkdownBlock =
  | MarkdownHeadingBlock
  | MarkdownParagraphBlock
  | MarkdownListBlock
  | MarkdownCodeBlock
  | MarkdownBlockquoteBlock;

export function MarkdownDocument(props: MarkdownDocumentProps) {
  const blocks = parseMarkdown(props.markdown);

  return (
    <div className="markdown-document">
      {blocks.map((block, index) => renderBlock(block, index))}
    </div>
  );
}

function renderBlock(block: MarkdownBlock, index: number) {
  switch (block.type) {
    case 'heading':
      return renderHeading(block, index);
    case 'paragraph':
      return (
        <p className="markdown-document__paragraph" key={index}>
          {renderInlineText(block.text)}
        </p>
      );
    case 'blockquote':
      return (
        <blockquote className="markdown-document__blockquote" key={index}>
          {renderInlineText(block.text)}
        </blockquote>
      );
    case 'list': {
      const ListTag = block.ordered ? 'ol' : 'ul';
      return (
        <ListTag
          className={`markdown-document__list ${
            block.ordered ? 'markdown-document__list--ordered' : 'markdown-document__list--unordered'
          }`}
          key={index}
        >
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInlineText(item)}</li>
          ))}
        </ListTag>
      );
    }
    case 'code':
      return (
        <section
          className={`markdown-document__code-block ${
            block.language === 'mermaid' ? 'markdown-document__code-block--mermaid' : ''
          }`}
          key={index}
        >
          <div className="markdown-document__code-label">
            {block.language === 'mermaid'
              ? 'Mermaid'
              : block.language
                ? block.language
                : 'code'}
          </div>
          <pre>
            <code>{block.code}</code>
          </pre>
        </section>
      );
  }
}

function renderHeading(block: MarkdownHeadingBlock, index: number) {
  const className = `markdown-document__heading markdown-document__heading--h${block.depth}`;

  switch (Math.min(Math.max(block.depth, 1), 6)) {
    case 1:
      return (
        <h1 className={className} key={index}>
          {block.text}
        </h1>
      );
    case 2:
      return (
        <h2 className={className} key={index}>
          {block.text}
        </h2>
      );
    case 3:
      return (
        <h3 className={className} key={index}>
          {block.text}
        </h3>
      );
    case 4:
      return (
        <h4 className={className} key={index}>
          {block.text}
        </h4>
      );
    case 5:
      return (
        <h5 className={className} key={index}>
          {block.text}
        </h5>
      );
    default:
      return (
        <h6 className={className} key={index}>
          {block.text}
        </h6>
      );
  }
}

function renderInlineText(text: string) {
  const parts = text.split(/(`[^`]+`)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }

    return <Fragment key={index}>{part}</Fragment>;
  });
}

function parseMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown.replaceAll('\r\n', '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];
  let listOrdered = false;
  let blockquoteLines: string[] = [];
  let codeLines: string[] = [];
  let codeLanguage: string | null = null;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) {
      return;
    }

    blocks.push({
      type: 'paragraph',
      text: paragraphLines.join(' ').trim(),
    });
    paragraphLines = [];
  };

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }

    blocks.push({
      type: 'list',
      items: [...listItems],
      ordered: listOrdered,
    });
    listItems = [];
  };

  const flushBlockquote = () => {
    if (blockquoteLines.length === 0) {
      return;
    }

    blocks.push({
      type: 'blockquote',
      text: blockquoteLines.join(' ').trim(),
    });
    blockquoteLines = [];
  };

  for (const line of lines) {
    const fenceMatch = line.match(/^```([\w-]+)?\s*$/);
    if (fenceMatch) {
      flushParagraph();
      flushList();
      flushBlockquote();

      if (codeLanguage !== null || codeLines.length > 0) {
        blocks.push({
          type: 'code',
          code: codeLines.join('\n').trimEnd(),
          language: codeLanguage,
        });
        codeLines = [];
        codeLanguage = null;
      } else {
        codeLanguage = (fenceMatch[1] ?? '').trim() || null;
      }
      continue;
    }

    if (codeLanguage !== null || codeLines.length > 0) {
      codeLines.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (trimmed.length === 0) {
      flushParagraph();
      flushList();
      flushBlockquote();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      flushBlockquote();
      blocks.push({
        type: 'heading',
        depth: (headingMatch[1] ?? '').length,
        text: (headingMatch[2] ?? '').trim(),
      });
      continue;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      flushBlockquote();
      if (listItems.length > 0 && !listOrdered) {
        flushList();
      }
      listOrdered = true;
      listItems.push((orderedMatch[1] ?? '').trim());
      continue;
    }

    const unorderedMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (unorderedMatch) {
      flushParagraph();
      flushBlockquote();
      if (listItems.length > 0 && listOrdered) {
        flushList();
      }
      listOrdered = false;
      listItems.push((unorderedMatch[1] ?? '').trim());
      continue;
    }

    const blockquoteMatch = trimmed.match(/^>\s+(.+)$/);
    if (blockquoteMatch) {
      flushParagraph();
      flushList();
      blockquoteLines.push((blockquoteMatch[1] ?? '').trim());
      continue;
    }

    flushList();
    flushBlockquote();
    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushList();
  flushBlockquote();

  if (codeLanguage !== null || codeLines.length > 0) {
    blocks.push({
      type: 'code',
      code: codeLines.join('\n').trimEnd(),
      language: codeLanguage,
    });
  }

  return blocks;
}
